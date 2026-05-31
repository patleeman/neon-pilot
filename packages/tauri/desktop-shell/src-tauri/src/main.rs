use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use std::time::{SystemTime, UNIX_EPOCH};

use base64::{engine::general_purpose, Engine as _};
use neon_pilot_host_core::{
    apply_sqlite_migrations, delete_file_secret, get_file_secret, import_extension_bundle,
    install_extension_package, list_file_secret_keys, list_scoped_dir, read_scoped_text,
    read_tauri_app_preferences, read_tauri_window_state, remove_scoped_path,
    resolve_repo_root as resolve_host_repo_root, scoped_path, set_file_secret,
    start_host_core_rpc_server, update_tauri_app_preferences, update_tauri_window_state,
    validate_extension_package, write_scoped_text, HostCoreRpcServer, JsSidecarConfig,
    JsSidecarHandle, JsSidecarReady, JsSidecarStatus, SqliteMigration, TauriAppPreferencesPatch,
    TauriWindowState,
};
use serde::{Deserialize, Serialize};
use tauri::{
    menu::{AboutMetadata, Menu, MenuItem, PredefinedMenuItem, Submenu},
    webview::{PageLoadEvent, WebviewBuilder},
    LogicalPosition, LogicalSize, Manager, PhysicalPosition, PhysicalSize, Position, RunEvent,
    Size, State, TitleBarStyle, WebviewUrl, WebviewWindowBuilder, WindowEvent,
};
use tokio::sync::Mutex;

const MAIN_WINDOW_LABEL: &str = "main";

#[derive(Default)]
struct HostState {
    sidecar: Mutex<Option<JsSidecarHandle>>,
    host_core_rpc: Mutex<Option<HostCoreRpcServer>>,
    workbench_browser_bridge: Mutex<Option<WorkbenchBrowserBridgeServer>>,
}

struct WorkbenchBrowserBridgeServer {
    port: u16,
    token: String,
    shutdown: Option<tokio::sync::oneshot::Sender<()>>,
}

impl Drop for WorkbenchBrowserBridgeServer {
    fn drop(&mut self) {
        if let Some(shutdown) = self.shutdown.take() {
            let _ = shutdown.send(());
        }
    }
}

struct ShellState {
    quit_confirmed: AtomicBool,
    quitting: AtomicBool,
    skip_quit_confirmation: bool,
    workbench_browser: Mutex<HashMap<String, WorkbenchBrowserEntry>>,
}

impl ShellState {
    fn from_args(args: impl IntoIterator<Item = String>) -> Self {
        Self {
            quit_confirmed: AtomicBool::new(false),
            quitting: AtomicBool::new(false),
            skip_quit_confirmation: args
                .into_iter()
                .any(|arg| arg == "--no-quit-confirmation" || arg == "--skip-quit-confirmation"),
            workbench_browser: Mutex::new(HashMap::new()),
        }
    }

    fn allow_quit_without_prompt(&self) -> bool {
        self.skip_quit_confirmation || self.quit_confirmed.load(Ordering::SeqCst)
    }

    fn confirm_quit(&self) {
        self.quit_confirmed.store(true, Ordering::SeqCst);
    }

    fn begin_quit(&self) {
        self.quitting.store(true, Ordering::SeqCst);
    }

    fn is_quitting(&self) -> bool {
        self.quitting.load(Ordering::SeqCst)
    }
}

struct WorkbenchBrowserEntry {
    webview: tauri::Webview,
    state: WorkbenchBrowserState,
    history: Vec<String>,
    history_index: usize,
    bounds: Option<WorkbenchBrowserBounds>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ApiDispatchRequest {
    method: String,
    path: String,
    body: Option<serde_json::Value>,
    headers: Option<HashMap<String, String>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ApiDispatchResponse {
    status_code: u16,
    headers: HashMap<String, String>,
    body: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopEnvironment {
    is_tauri: bool,
    active_host_id: String,
    active_host_label: String,
    active_host_kind: String,
    active_host_summary: String,
    launch_mode: String,
    launch_label: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct NavigationState {
    can_go_back: bool,
    can_go_forward: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct OpenPathResult {
    path: String,
    opened: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct OpenUrlResult {
    url: String,
    opened: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ClipboardWriteResult {
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct FolderPickerResult {
    path: Option<String>,
    cancelled: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WorkbenchBrowserBoundsInput {
    visible: bool,
    #[serde(default)]
    session_key: Option<String>,
    #[serde(default)]
    bounds: Option<WorkbenchBrowserBounds>,
    #[serde(default)]
    deactivate: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WorkbenchBrowserBounds {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WorkbenchBrowserNavigateInput {
    url: String,
    #[serde(default)]
    session_key: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WorkbenchBrowserSessionInput {
    #[serde(default)]
    session_key: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct WorkbenchBrowserState {
    url: String,
    title: String,
    loading: bool,
    can_go_back: bool,
    can_go_forward: bool,
    active: bool,
    browser_revision: u64,
    last_snapshot_revision: u64,
    changed_since_last_snapshot: bool,
    last_change_reason: String,
    last_changed_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct WorkbenchBrowserSnapshot {
    #[serde(flatten)]
    state: WorkbenchBrowserState,
    text: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WorkbenchBrowserBridgeRequest {
    method: String,
    #[serde(default)]
    args: Vec<serde_json::Value>,
}

#[tauri::command]
async fn host_status(state: State<'_, Arc<HostState>>) -> Result<JsSidecarStatus, String> {
    let sidecar = state.sidecar.lock().await;
    match sidecar.as_ref() {
        Some(sidecar) => Ok(sidecar.status().await),
        None => Ok(JsSidecarStatus {
            running: false,
            ready: None,
        }),
    }
}

#[tauri::command]
async fn get_environment(app: tauri::AppHandle) -> DesktopEnvironment {
    DesktopEnvironment {
        is_tauri: true,
        active_host_id: "local".to_string(),
        active_host_label: "Local".to_string(),
        active_host_kind: "local".to_string(),
        active_host_summary: "Local Tauri runtime is available.".to_string(),
        launch_mode: "dev".to_string(),
        launch_label: app.package_info().name.clone(),
    }
}

#[tauri::command]
async fn get_navigation_state(_window: tauri::Window) -> NavigationState {
    NavigationState {
        can_go_back: false,
        can_go_forward: false,
    }
}

#[tauri::command]
async fn open_path(target_path: String) -> OpenPathResult {
    let normalized = target_path.trim().to_string();
    if normalized.is_empty() {
        return OpenPathResult {
            path: normalized,
            opened: false,
            error: Some("Path is required.".to_string()),
        };
    }

    match open::that(&normalized) {
        Ok(()) => OpenPathResult {
            path: normalized,
            opened: true,
            error: None,
        },
        Err(error) => OpenPathResult {
            path: normalized,
            opened: false,
            error: Some(error.to_string()),
        },
    }
}

#[tauri::command]
async fn open_external_url(target_url: String) -> OpenUrlResult {
    let normalized = target_url.trim().to_string();
    if normalized.is_empty() {
        return OpenUrlResult {
            url: normalized,
            opened: false,
            error: Some("URL is required.".to_string()),
        };
    }

    let Ok(parsed) = reqwest::Url::parse(&normalized) else {
        return OpenUrlResult {
            url: normalized,
            opened: false,
            error: Some("Invalid URL.".to_string()),
        };
    };
    if parsed.scheme() != "http" && parsed.scheme() != "https" {
        return OpenUrlResult {
            url: normalized,
            opened: false,
            error: Some("Only http and https URLs can be opened.".to_string()),
        };
    }

    match open::that(parsed.as_str()) {
        Ok(()) => OpenUrlResult {
            url: normalized,
            opened: true,
            error: None,
        },
        Err(error) => OpenUrlResult {
            url: normalized,
            opened: false,
            error: Some(error.to_string()),
        },
    }
}

#[tauri::command]
async fn write_clipboard_text(text: String) -> ClipboardWriteResult {
    match arboard::Clipboard::new().and_then(|mut clipboard| clipboard.set_text(text)) {
        Ok(()) => ClipboardWriteResult {
            ok: true,
            error: None,
        },
        Err(error) => ClipboardWriteResult {
            ok: false,
            error: Some(error.to_string()),
        },
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PickFolderInput {
    cwd: Option<String>,
    prompt: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ScopedPathInput {
    root: String,
    path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ScopedWriteTextInput {
    root: String,
    path: String,
    text: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SecretInput {
    key: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SecretSetInput {
    key: String,
    value: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SqliteMigrateInput {
    root: String,
    path: String,
    migrations: Vec<SqliteMigration>,
}

#[tauri::command]
async fn pick_folder(input: Option<PickFolderInput>) -> Result<FolderPickerResult, String> {
    tokio::task::spawn_blocking(move || {
        let mut dialog = rfd::FileDialog::new();
        if let Some(prompt) = input.as_ref().and_then(|input| input.prompt.as_deref()) {
            if !prompt.trim().is_empty() {
                dialog = dialog.set_title(prompt);
            }
        }
        if let Some(cwd) = input.as_ref().and_then(|input| input.cwd.as_deref()) {
            if !cwd.trim().is_empty() {
                dialog = dialog.set_directory(cwd);
            }
        }
        let selected = dialog.pick_folder();
        let cancelled = selected.is_none();
        FolderPickerResult {
            path: selected.map(|path| path.to_string_lossy().to_string()),
            cancelled,
        }
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
async fn set_workbench_browser_bounds(
    state: State<'_, Arc<ShellState>>,
    app: tauri::AppHandle,
    input: WorkbenchBrowserBoundsInput,
) -> Result<Option<WorkbenchBrowserState>, String> {
    let session_key = normalize_browser_session_key(input.session_key.as_deref());
    if !input.visible {
        let mut browser = state.workbench_browser.lock().await;
        let Some(entry) = browser.get_mut(&session_key) else {
            return Ok(None);
        };
        entry.state.active = !input.deactivate;
        if input.deactivate {
            entry.state.active = false;
        }
        entry.webview.hide().map_err(|error| error.to_string())?;
        return Ok(Some(entry.state.clone()));
    }

    ensure_workbench_browser_entry(&state, &app, &session_key, input.bounds.as_ref()).await?;
    let mut browser = state.workbench_browser.lock().await;
    let entry = browser
        .get_mut(&session_key)
        .ok_or_else(|| "Workbench Browser entry was not created.".to_string())?;
    if let Some(bounds) = input.bounds.as_ref() {
        apply_workbench_browser_bounds(&entry.webview, bounds)?;
        entry.bounds = Some(bounds.clone());
    }
    entry.state.active = true;
    entry.webview.show().map_err(|error| error.to_string())?;
    Ok(Some(entry.state.clone()))
}

#[tauri::command]
async fn get_workbench_browser_state(
    state: State<'_, Arc<ShellState>>,
    input: Option<WorkbenchBrowserSessionInput>,
) -> Result<Option<WorkbenchBrowserState>, String> {
    let session_key =
        normalize_browser_session_key(input.and_then(|value| value.session_key).as_deref());
    let browser = state.workbench_browser.lock().await;
    Ok(browser.get(&session_key).map(|entry| entry.state.clone()))
}

#[tauri::command]
async fn navigate_workbench_browser(
    state: State<'_, Arc<ShellState>>,
    app: tauri::AppHandle,
    input: WorkbenchBrowserNavigateInput,
) -> Result<WorkbenchBrowserState, String> {
    let session_key = normalize_browser_session_key(input.session_key.as_deref());
    let url = parse_workbench_browser_url(&input.url)?;
    ensure_workbench_browser_entry(&state, &app, &session_key, None).await?;
    let mut browser = state.workbench_browser.lock().await;
    let entry = browser
        .get_mut(&session_key)
        .ok_or_else(|| "Workbench Browser entry was not created.".to_string())?;
    entry
        .webview
        .navigate(url.clone())
        .map_err(|error| error.to_string())?;
    record_browser_navigation(entry, url.as_str(), "navigate");
    Ok(entry.state.clone())
}

#[tauri::command]
async fn go_back_workbench_browser(
    state: State<'_, Arc<ShellState>>,
    input: Option<WorkbenchBrowserSessionInput>,
) -> Result<WorkbenchBrowserState, String> {
    let session_key =
        normalize_browser_session_key(input.and_then(|value| value.session_key).as_deref());
    let mut browser = state.workbench_browser.lock().await;
    let entry = browser
        .get_mut(&session_key)
        .ok_or_else(|| "Workbench Browser is not active for this tab.".to_string())?;
    if entry.history_index > 0 {
        entry.history_index -= 1;
        let url = tauri::Url::parse(&entry.history[entry.history_index])
            .map_err(|error| error.to_string())?;
        entry
            .webview
            .navigate(url)
            .map_err(|error| error.to_string())?;
        update_browser_history_flags(entry);
    }
    Ok(entry.state.clone())
}

#[tauri::command]
async fn go_forward_workbench_browser(
    state: State<'_, Arc<ShellState>>,
    input: Option<WorkbenchBrowserSessionInput>,
) -> Result<WorkbenchBrowserState, String> {
    let session_key =
        normalize_browser_session_key(input.and_then(|value| value.session_key).as_deref());
    let mut browser = state.workbench_browser.lock().await;
    let entry = browser
        .get_mut(&session_key)
        .ok_or_else(|| "Workbench Browser is not active for this tab.".to_string())?;
    if entry.history_index + 1 < entry.history.len() {
        entry.history_index += 1;
        let url = tauri::Url::parse(&entry.history[entry.history_index])
            .map_err(|error| error.to_string())?;
        entry
            .webview
            .navigate(url)
            .map_err(|error| error.to_string())?;
        update_browser_history_flags(entry);
    }
    Ok(entry.state.clone())
}

#[tauri::command]
async fn reload_workbench_browser(
    state: State<'_, Arc<ShellState>>,
    input: Option<WorkbenchBrowserSessionInput>,
) -> Result<WorkbenchBrowserState, String> {
    let session_key =
        normalize_browser_session_key(input.and_then(|value| value.session_key).as_deref());
    let mut browser = state.workbench_browser.lock().await;
    let entry = browser
        .get_mut(&session_key)
        .ok_or_else(|| "Workbench Browser is not active for this tab.".to_string())?;
    entry.webview.reload().map_err(|error| error.to_string())?;
    entry.state.loading = true;
    entry.state.last_change_reason = "reload".to_string();
    Ok(entry.state.clone())
}

#[tauri::command]
async fn stop_workbench_browser(
    state: State<'_, Arc<ShellState>>,
    input: Option<WorkbenchBrowserSessionInput>,
) -> Result<WorkbenchBrowserState, String> {
    let session_key =
        normalize_browser_session_key(input.and_then(|value| value.session_key).as_deref());
    let mut browser = state.workbench_browser.lock().await;
    let entry = browser
        .get_mut(&session_key)
        .ok_or_else(|| "Workbench Browser is not active for this tab.".to_string())?;
    entry
        .webview
        .eval("window.stop();")
        .map_err(|error| error.to_string())?;
    entry.state.loading = false;
    entry.state.last_change_reason = "stop".to_string();
    Ok(entry.state.clone())
}

#[tauri::command]
async fn snapshot_workbench_browser(
    state: State<'_, Arc<ShellState>>,
    input: Option<WorkbenchBrowserSessionInput>,
) -> Result<WorkbenchBrowserSnapshot, String> {
    let session_key =
        normalize_browser_session_key(input.and_then(|value| value.session_key).as_deref());
    let (webview, mut current_state) = {
        let browser = state.workbench_browser.lock().await;
        let entry = browser
            .get(&session_key)
            .ok_or_else(|| "Workbench Browser is not active for this tab.".to_string())?;
        (entry.webview.clone(), entry.state.clone())
    };
    let text = eval_workbench_browser_text(&webview).await?;
    current_state.last_snapshot_revision = current_state.browser_revision;
    current_state.changed_since_last_snapshot = false;
    {
        let mut browser = state.workbench_browser.lock().await;
        if let Some(entry) = browser.get_mut(&session_key) {
            entry.state.last_snapshot_revision = current_state.last_snapshot_revision;
            entry.state.changed_since_last_snapshot = false;
        }
    }
    Ok(WorkbenchBrowserSnapshot {
        state: current_state,
        text,
    })
}

#[tauri::command]
async fn read_desktop_app_preferences(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    read_tauri_app_preferences(app.package_info().version.to_string())
        .and_then(|state| serde_json::to_value(state).map_err(Into::into))
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn update_desktop_app_preferences(
    app: tauri::AppHandle,
    input: TauriAppPreferencesPatch,
) -> Result<serde_json::Value, String> {
    update_tauri_app_preferences(input, app.package_info().version.to_string())
        .and_then(|state| serde_json::to_value(state).map_err(Into::into))
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn check_for_updates(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    read_desktop_app_preferences(app).await
}

#[tauri::command]
async fn validate_extension_package_command(
    package_root: String,
) -> Result<serde_json::Value, String> {
    validate_extension_package(PathBuf::from(package_root))
        .and_then(|report| serde_json::to_value(report).map_err(Into::into))
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn install_extension_package_command(
    package_root: String,
) -> Result<serde_json::Value, String> {
    install_extension_package(PathBuf::from(package_root))
        .and_then(|report| serde_json::to_value(report).map_err(Into::into))
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn import_extension_bundle_command(zip_path: String) -> Result<serde_json::Value, String> {
    import_extension_bundle(PathBuf::from(zip_path))
        .and_then(|report| serde_json::to_value(report).map_err(Into::into))
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn scoped_resolve_path(input: ScopedPathInput) -> Result<serde_json::Value, String> {
    scoped_path(input.root, input.path)
        .and_then(|path| serde_json::to_value(path).map_err(Into::into))
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn scoped_read_text(input: ScopedPathInput) -> Result<String, String> {
    read_scoped_text(input.root, input.path).map_err(|error| error.to_string())
}

#[tauri::command]
async fn scoped_write_text(input: ScopedWriteTextInput) -> Result<serde_json::Value, String> {
    write_scoped_text(input.root, input.path, &input.text)
        .and_then(|path| serde_json::to_value(path).map_err(Into::into))
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn scoped_list_dir(input: ScopedPathInput) -> Result<serde_json::Value, String> {
    list_scoped_dir(input.root, input.path)
        .and_then(|entries| serde_json::to_value(entries).map_err(Into::into))
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn scoped_remove_path(input: ScopedPathInput) -> Result<serde_json::Value, String> {
    remove_scoped_path(input.root, input.path)
        .and_then(|path| serde_json::to_value(path).map_err(Into::into))
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn get_secret(input: SecretInput) -> Result<Option<String>, String> {
    get_file_secret(&input.key).map_err(|error| error.to_string())
}

#[tauri::command]
async fn set_secret(input: SecretSetInput) -> Result<serde_json::Value, String> {
    set_file_secret(&input.key, &input.value)
        .and_then(|status| serde_json::to_value(status).map_err(Into::into))
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn delete_secret(input: SecretInput) -> Result<serde_json::Value, String> {
    delete_file_secret(&input.key)
        .and_then(|status| serde_json::to_value(status).map_err(Into::into))
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn list_secret_keys() -> Result<Vec<String>, String> {
    list_file_secret_keys().map_err(|error| error.to_string())
}

#[tauri::command]
async fn apply_sqlite_migrations_command(input: SqliteMigrateInput) -> Result<u32, String> {
    let db_path = scoped_path(input.root, input.path)
        .map(|path| path.absolute_path)
        .map_err(|error| error.to_string())?;
    apply_sqlite_migrations(db_path, &input.migrations).map_err(|error| error.to_string())
}

#[tauri::command]
async fn start_js_sidecar(
    state: State<'_, Arc<HostState>>,
    app: tauri::AppHandle,
) -> Result<JsSidecarStatus, String> {
    let ready = ensure_js_sidecar(&state, &app).await?;
    Ok(JsSidecarStatus {
        running: true,
        ready: Some(ready),
    })
}

#[tauri::command]
async fn dispatch_local_api(
    state: State<'_, Arc<HostState>>,
    app: tauri::AppHandle,
    request: ApiDispatchRequest,
) -> Result<ApiDispatchResponse, String> {
    let ready = ensure_js_sidecar(&state, &app).await?;
    let client = reqwest::Client::new();
    let response = client
        .post(format!("http://127.0.0.1:{}/dispatch", ready.port))
        .bearer_auth(&ready.token)
        .json(&serde_json::json!({ "request": request }))
        .send()
        .await
        .map_err(|error| error.to_string())?;

    let status_code = response.status().as_u16();
    let headers = response
        .headers()
        .iter()
        .filter_map(|(key, value)| {
            value
                .to_str()
                .ok()
                .map(|value| (key.to_string(), value.to_string()))
        })
        .collect();
    let body = response.text().await.map_err(|error| error.to_string())?;
    Ok(ApiDispatchResponse {
        status_code,
        headers,
        body,
    })
}

async fn ensure_js_sidecar(
    state: &State<'_, Arc<HostState>>,
    app: &tauri::AppHandle,
) -> Result<JsSidecarReady, String> {
    let mut current = state.sidecar.lock().await;
    if let Some(sidecar) = current.as_ref() {
        let status = sidecar.status().await;
        if let Some(ready) = status.ready {
            return Ok(ready);
        }
    }

    let repo_root = resolve_repo_root(app)?;
    let entry_file = repo_root.join("packages/desktop/dist/backend/local-backend-child.js");
    let token = format!("tauri-{}", std::process::id());
    let host_core_rpc = ensure_host_core_rpc(state).await?;
    let mut sidecar_env = HashMap::new();
    sidecar_env.insert(
        "NEON_PILOT_TAURI_HOST_CORE_PORT".to_string(),
        host_core_rpc.port.to_string(),
    );
    sidecar_env.insert(
        "NEON_PILOT_TAURI_HOST_CORE_TOKEN".to_string(),
        host_core_rpc.token.clone(),
    );
    let browser_bridge = ensure_workbench_browser_bridge(state, app).await?;
    sidecar_env.insert(
        "NEON_PILOT_TAURI_BROWSER_BRIDGE_URL".to_string(),
        format!("http://127.0.0.1:{}/browser", browser_bridge.port),
    );
    sidecar_env.insert(
        "NEON_PILOT_TAURI_BROWSER_BRIDGE_TOKEN".to_string(),
        browser_bridge.token,
    );
    sidecar_env.insert(
        "NEON_PILOT_REPO_ROOT".to_string(),
        repo_root.to_string_lossy().to_string(),
    );
    sidecar_env.insert(
        "NEON_PILOT_DESKTOP_APP_PATH".to_string(),
        repo_root
            .join("packages/desktop")
            .to_string_lossy()
            .to_string(),
    );
    sidecar_env.insert(
        "NEON_PILOT_TAURI_PARENT_PID".to_string(),
        std::process::id().to_string(),
    );
    let sidecar = JsSidecarHandle::launch(JsSidecarConfig {
        node_command: "node".to_string(),
        entry_file,
        repo_root,
        token,
        env: sidecar_env,
        ready_timeout_ms: Some(20_000),
        launch_mode: Default::default(),
    })
    .await
    .map_err(|error| error.to_string())?;
    let status = sidecar.status().await;
    let ready = status
        .ready
        .clone()
        .ok_or_else(|| "JS sidecar did not report readiness.".to_string())?;
    *current = Some(sidecar);
    Ok(ready)
}

fn shutdown_js_sidecar<R: tauri::Runtime>(app: &tauri::AppHandle<R>) {
    let Some(host_state) = app.try_state::<Arc<HostState>>() else {
        return;
    };

    tauri::async_runtime::block_on(async {
        let sidecar = {
            let mut current = host_state.sidecar.lock().await;
            current.take()
        };
        if let Some(sidecar) = sidecar {
            sidecar.shutdown().await;
        }
    });
}

fn finish_quit<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> ! {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        persist_webview_window_state(&window);
    }
    shutdown_js_sidecar(app);
    app.exit(0);
    std::process::exit(0);
}

async fn ensure_host_core_rpc(
    state: &State<'_, Arc<HostState>>,
) -> Result<HostCoreRpcServerStatus, String> {
    let mut current = state.host_core_rpc.lock().await;
    if let Some(server) = current.as_ref() {
        return Ok(HostCoreRpcServerStatus {
            port: server.port,
            token: server.token.clone(),
        });
    }
    let token = format!("host-core-{}", std::process::id());
    let server = start_host_core_rpc_server(token)
        .await
        .map_err(|error| error.to_string())?;
    let status = HostCoreRpcServerStatus {
        port: server.port,
        token: server.token.clone(),
    };
    *current = Some(server);
    Ok(status)
}

async fn ensure_workbench_browser_bridge(
    state: &State<'_, Arc<HostState>>,
    app: &tauri::AppHandle,
) -> Result<WorkbenchBrowserBridgeStatus, String> {
    let mut current = state.workbench_browser_bridge.lock().await;
    if let Some(server) = current.as_ref() {
        return Ok(WorkbenchBrowserBridgeStatus {
            port: server.port,
            token: server.token.clone(),
        });
    }
    let shell_state = app
        .try_state::<Arc<ShellState>>()
        .ok_or_else(|| "Tauri shell state is not available.".to_string())?
        .inner()
        .clone();
    let token = format!("browser-bridge-{}", std::process::id());
    let server = start_workbench_browser_bridge_server(shell_state, token)
        .await
        .map_err(|error| error.to_string())?;
    let status = WorkbenchBrowserBridgeStatus {
        port: server.port,
        token: server.token.clone(),
    };
    *current = Some(server);
    Ok(status)
}

struct HostCoreRpcServerStatus {
    port: u16,
    token: String,
}

struct WorkbenchBrowserBridgeStatus {
    port: u16,
    token: String,
}

fn resolve_repo_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    if let Ok(value) = std::env::var("NEON_PILOT_REPO_ROOT") {
        let path = PathBuf::from(value);
        if resolve_host_repo_root(&path).is_ok() {
            return Ok(path);
        }
    }

    let current = std::env::current_dir().map_err(|error| error.to_string())?;
    if let Ok(repo_root) = resolve_host_repo_root(&current) {
        return Ok(repo_root);
    }

    if let Ok(resource_dir) = app.path().resource_dir() {
        if let Ok(repo_root) = resolve_host_repo_root(&resource_dir) {
            return Ok(repo_root);
        }
        let staged_resources = resource_dir.join("resources");
        if let Ok(repo_root) = resolve_host_repo_root(&staged_resources) {
            return Ok(repo_root);
        }
    }

    Err("Could not resolve Neon Pilot repo root for Tauri host.".to_string())
}

fn normalize_browser_session_key(value: Option<&str>) -> String {
    let trimmed = value.unwrap_or("default").trim();
    if trimmed.is_empty() {
        "default".to_string()
    } else {
        trimmed.to_string()
    }
}

fn browser_webview_label(session_key: &str) -> String {
    let mut sanitized = String::with_capacity(session_key.len());
    for character in session_key.chars() {
        if character.is_ascii_alphanumeric() || character == '-' || character == '_' {
            sanitized.push(character);
        } else {
            sanitized.push('-');
        }
    }
    format!("workbench-browser-{}", sanitized)
}

fn parse_workbench_browser_url(value: &str) -> Result<tauri::Url, String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return tauri::Url::parse("about:blank").map_err(|error| error.to_string());
    }
    if trimmed == "about:blank" {
        return tauri::Url::parse(trimmed).map_err(|error| error.to_string());
    }
    let normalized = if trimmed.contains("://") {
        trimmed.to_string()
    } else {
        format!("https://{trimmed}")
    };
    let url = tauri::Url::parse(&normalized).map_err(|error| error.to_string())?;
    if !matches!(url.scheme(), "http" | "https" | "about") {
        return Err(
            "Only http, https, and about URLs can be opened in Workbench Browser.".to_string(),
        );
    }
    Ok(url)
}

async fn ensure_workbench_browser_entry(
    state: &State<'_, Arc<ShellState>>,
    app: &tauri::AppHandle,
    session_key: &str,
    bounds: Option<&WorkbenchBrowserBounds>,
) -> Result<(), String> {
    let mut browser = state.workbench_browser.lock().await;
    if browser.contains_key(session_key) {
        return Ok(());
    }

    let window = app
        .get_window(MAIN_WINDOW_LABEL)
        .ok_or_else(|| "Main Tauri window is not available.".to_string())?;
    let initial_url = tauri::Url::parse("about:blank").map_err(|error| error.to_string())?;
    let label = browser_webview_label(session_key);
    let page_load_session_key = session_key.to_string();
    let title_session_key = session_key.to_string();
    let builder = WebviewBuilder::new(&label, WebviewUrl::External(initial_url.clone()))
        .on_page_load(move |webview, payload| {
            let session_key = page_load_session_key.clone();
            let url = payload.url().to_string();
            let loading = matches!(payload.event(), PageLoadEvent::Started);
            if let Some(shell_state) = webview.app_handle().try_state::<Arc<ShellState>>() {
                let shell_state = shell_state.inner().clone();
                tauri::async_runtime::spawn(async move {
                    let mut browser = shell_state.workbench_browser.lock().await;
                    if let Some(entry) = browser.get_mut(&session_key) {
                        entry.state.url = url;
                        entry.state.loading = loading;
                        mark_browser_changed(
                            &mut entry.state,
                            if loading {
                                "load-started"
                            } else {
                                "load-finished"
                            },
                        );
                    }
                });
            }
        })
        .on_document_title_changed(move |webview, title| {
            let session_key = title_session_key.clone();
            if let Some(shell_state) = webview.app_handle().try_state::<Arc<ShellState>>() {
                let shell_state = shell_state.inner().clone();
                tauri::async_runtime::spawn(async move {
                    let mut browser = shell_state.workbench_browser.lock().await;
                    if let Some(entry) = browser.get_mut(&session_key) {
                        entry.state.title = title;
                        mark_browser_changed(&mut entry.state, "title-changed");
                    }
                });
            }
        });

    let (position, size) = bounds
        .map(|bounds| {
            (
                LogicalPosition::new(bounds.x as f64, bounds.y as f64),
                LogicalSize::new(bounds.width.max(1) as f64, bounds.height.max(1) as f64),
            )
        })
        .unwrap_or_else(|| (LogicalPosition::new(0.0, 0.0), LogicalSize::new(1.0, 1.0)));
    let webview = window
        .add_child(builder, position, size)
        .map_err(|error| error.to_string())?;
    webview.hide().map_err(|error| error.to_string())?;

    let entry = WorkbenchBrowserEntry {
        webview,
        state: WorkbenchBrowserState {
            url: initial_url.to_string(),
            title: "Browser".to_string(),
            loading: false,
            can_go_back: false,
            can_go_forward: false,
            active: false,
            browser_revision: 0,
            last_snapshot_revision: 0,
            changed_since_last_snapshot: false,
            last_change_reason: "created".to_string(),
            last_changed_at: now_timestamp_string(),
        },
        history: vec![initial_url.to_string()],
        history_index: 0,
        bounds: bounds.cloned(),
    };
    browser.insert(session_key.to_string(), entry);
    Ok(())
}

fn apply_workbench_browser_bounds(
    webview: &tauri::Webview,
    bounds: &WorkbenchBrowserBounds,
) -> Result<(), String> {
    webview
        .set_position(Position::Logical(LogicalPosition {
            x: bounds.x as f64,
            y: bounds.y as f64,
        }))
        .map_err(|error| error.to_string())?;
    webview
        .set_size(Size::Logical(LogicalSize {
            width: bounds.width.max(1) as f64,
            height: bounds.height.max(1) as f64,
        }))
        .map_err(|error| error.to_string())
}

fn record_browser_navigation(entry: &mut WorkbenchBrowserEntry, url: &str, reason: &str) {
    if entry.history.get(entry.history_index).map(String::as_str) != Some(url) {
        entry.history.truncate(entry.history_index + 1);
        entry.history.push(url.to_string());
        entry.history_index = entry.history.len().saturating_sub(1);
    }
    entry.state.url = url.to_string();
    entry.state.loading = true;
    update_browser_history_flags(entry);
    mark_browser_changed(&mut entry.state, reason);
}

fn update_browser_history_flags(entry: &mut WorkbenchBrowserEntry) {
    entry.state.can_go_back = entry.history_index > 0;
    entry.state.can_go_forward = entry.history_index + 1 < entry.history.len();
}

fn mark_browser_changed(state: &mut WorkbenchBrowserState, reason: &str) {
    state.browser_revision = state.browser_revision.saturating_add(1);
    state.changed_since_last_snapshot = state.browser_revision != state.last_snapshot_revision;
    state.last_change_reason = reason.to_string();
    state.last_changed_at = now_timestamp_string();
}

async fn eval_workbench_browser_text(webview: &tauri::Webview) -> Result<String, String> {
    let (tx, rx) = tokio::sync::oneshot::channel::<String>();
    let tx = Arc::new(std::sync::Mutex::new(Some(tx)));
    webview
        .eval_with_callback(
            r#"
(() => {
  const title = document.title || '';
  const url = location.href;
  const text = document.body?.innerText || document.documentElement?.innerText || '';
  return JSON.stringify({ title, url, text });
})()
"#,
            move |value| {
                if let Ok(mut sender) = tx.lock() {
                    if let Some(sender) = sender.take() {
                        let _ = sender.send(value);
                    }
                }
            },
        )
        .map_err(|error| error.to_string())?;
    let value = tokio::time::timeout(std::time::Duration::from_secs(10), rx)
        .await
        .map_err(|_| "Timed out reading Workbench Browser snapshot.".to_string())?
        .map_err(|_| "Workbench Browser snapshot callback was dropped.".to_string())?;
    let parsed: serde_json::Value =
        serde_json::from_str(&value).unwrap_or(serde_json::Value::String(value));
    if let Some(serialized) = parsed.as_str() {
        let nested: serde_json::Value = serde_json::from_str(serialized)
            .unwrap_or_else(|_| serde_json::json!({ "text": serialized }));
        return Ok(nested
            .get("text")
            .and_then(|value| value.as_str())
            .unwrap_or_default()
            .to_string());
    }
    Ok(parsed
        .get("text")
        .and_then(|value| value.as_str())
        .unwrap_or_default()
        .to_string())
}

struct WorkbenchBrowserBridgeState {
    shell_state: Arc<ShellState>,
    token: String,
}

async fn start_workbench_browser_bridge_server(
    shell_state: Arc<ShellState>,
    token: String,
) -> anyhow::Result<WorkbenchBrowserBridgeServer> {
    use axum::routing::post;
    use axum::Router;

    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await?;
    let port = listener.local_addr()?.port();
    let (shutdown_tx, shutdown_rx) = tokio::sync::oneshot::channel::<()>();
    let state = Arc::new(WorkbenchBrowserBridgeState {
        shell_state,
        token: token.clone(),
    });
    let app = Router::new()
        .route("/browser", post(workbench_browser_bridge_request))
        .with_state(state);
    tokio::spawn(async move {
        let server = axum::serve(listener, app).with_graceful_shutdown(async {
            let _ = shutdown_rx.await;
        });
        if let Err(error) = server.await {
            tracing::warn!("workbench browser bridge failed: {error}");
        }
    });
    Ok(WorkbenchBrowserBridgeServer {
        port,
        token,
        shutdown: Some(shutdown_tx),
    })
}

async fn workbench_browser_bridge_request(
    axum::extract::State(state): axum::extract::State<Arc<WorkbenchBrowserBridgeState>>,
    headers: axum::http::HeaderMap,
    axum::Json(request): axum::Json<WorkbenchBrowserBridgeRequest>,
) -> Result<axum::Json<serde_json::Value>, WorkbenchBrowserBridgeError> {
    authorize_workbench_browser_bridge(&state, &headers)?;
    let result = dispatch_workbench_browser_bridge_request(&state.shell_state, request)
        .await
        .map_err(WorkbenchBrowserBridgeError::from)?;
    Ok(axum::Json(
        serde_json::json!({ "ok": true, "result": result }),
    ))
}

async fn dispatch_workbench_browser_bridge_request(
    shell_state: &Arc<ShellState>,
    request: WorkbenchBrowserBridgeRequest,
) -> Result<serde_json::Value, String> {
    match request.method.as_str() {
        "isActive" => {
            let browser = shell_state.workbench_browser.lock().await;
            Ok(serde_json::json!(browser
                .values()
                .any(|entry| entry.state.active)))
        }
        "listTabs" => {
            let browser = shell_state.workbench_browser.lock().await;
            let tabs = browser
                .iter()
                .map(|(session_key, entry)| {
                    serde_json::json!({
                        "sessionKey": session_key,
                        "url": entry.state.url,
                        "title": entry.state.title,
                    })
                })
                .collect::<Vec<_>>();
            Ok(serde_json::json!(tabs))
        }
        "snapshot" => {
            let tab_id = request.args.get(1).and_then(|value| value.as_str());
            let (session_key, webview, mut current_state, _bounds) =
                resolve_browser_bridge_entry(shell_state, tab_id).await?;
            let text = eval_workbench_browser_text(&webview).await?;
            current_state.last_snapshot_revision = current_state.browser_revision;
            current_state.changed_since_last_snapshot = false;
            {
                let mut browser = shell_state.workbench_browser.lock().await;
                if let Some(entry) = browser.get_mut(&session_key) {
                    entry.state.last_snapshot_revision = current_state.last_snapshot_revision;
                    entry.state.changed_since_last_snapshot = false;
                }
            }
            serde_json::to_value(WorkbenchBrowserSnapshot {
                state: current_state,
                text,
            })
            .map_err(|error| error.to_string())
        }
        "screenshot" => {
            let tab_id = request.args.get(1).and_then(|value| value.as_str());
            let (_session_key, _webview, current_state, bounds) =
                resolve_browser_bridge_entry(shell_state, tab_id).await?;
            let bounds = bounds
                .ok_or_else(|| "Workbench Browser bounds are not available yet.".to_string())?;
            let data_base64 = capture_workbench_browser_screenshot(&bounds).await?;
            serde_json::to_value(serde_json::json!({
                "dataBase64": data_base64,
                "mimeType": "image/png",
                "url": current_state.url,
                "title": current_state.title,
                "viewport": {
                    "x": bounds.x,
                    "y": bounds.y,
                    "width": bounds.width,
                    "height": bounds.height,
                },
                "capturedAt": now_timestamp_string(),
            }))
            .map_err(|error| error.to_string())
        }
        "cdp" => Err(
            "Workbench Browser CDP is not supported by the Tauri webview bridge yet.".to_string(),
        ),
        _ => Err(format!(
            "Unknown Workbench Browser bridge method: {}",
            request.method
        )),
    }
}

async fn resolve_browser_bridge_entry(
    shell_state: &Arc<ShellState>,
    tab_id: Option<&str>,
) -> Result<
    (
        String,
        tauri::Webview,
        WorkbenchBrowserState,
        Option<WorkbenchBrowserBounds>,
    ),
    String,
> {
    let browser = shell_state.workbench_browser.lock().await;
    let session_key = tab_id
        .map(|tab_id| format!("@global:tab-{tab_id}"))
        .filter(|session_key| browser.contains_key(session_key))
        .or_else(|| {
            browser
                .iter()
                .find(|(_, entry)| entry.state.active)
                .map(|(session_key, _)| session_key.clone())
        })
        .or_else(|| browser.keys().next().cloned())
        .ok_or_else(|| "Workbench Browser is not active for this conversation.".to_string())?;
    let entry = browser
        .get(&session_key)
        .ok_or_else(|| "Workbench Browser is not active for this conversation.".to_string())?;
    Ok((
        session_key,
        entry.webview.clone(),
        entry.state.clone(),
        entry.bounds.clone(),
    ))
}

async fn capture_workbench_browser_screenshot(
    bounds: &WorkbenchBrowserBounds,
) -> Result<String, String> {
    #[cfg(target_os = "macos")]
    {
        let bounds = bounds.clone();
        return tauri::async_runtime::spawn_blocking(move || {
            let temp_path = std::env::temp_dir().join(format!(
                "neon-pilot-workbench-browser-{}-{}.png",
                std::process::id(),
                SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .map(|duration| duration.as_nanos())
                    .unwrap_or_default()
            ));
            let region = format!(
                "{},{},{},{}",
                bounds.x.max(0),
                bounds.y.max(0),
                bounds.width.max(1),
                bounds.height.max(1)
            );
            let output = Command::new("screencapture")
                .args(["-x", "-R", region.as_str()])
                .arg(&temp_path)
                .output()
                .map_err(|error| error.to_string())?;
            if !output.status.success() {
                let stderr = String::from_utf8_lossy(&output.stderr);
                let _ = fs::remove_file(&temp_path);
                return Err(format!(
                    "macOS screenshot capture failed with status {}: {}",
                    output.status,
                    stderr.trim()
                ));
            }
            let data = fs::read(&temp_path).map_err(|error| error.to_string())?;
            let _ = fs::remove_file(&temp_path);
            if data.is_empty() {
                return Err("macOS screenshot capture returned an empty image.".to_string());
            }
            Ok(general_purpose::STANDARD.encode(data))
        })
        .await
        .map_err(|error| error.to_string())?;
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = bounds;
        Err("Workbench Browser screenshots are currently only available on macOS.".to_string())
    }
}

fn authorize_workbench_browser_bridge(
    state: &WorkbenchBrowserBridgeState,
    headers: &axum::http::HeaderMap,
) -> Result<(), WorkbenchBrowserBridgeError> {
    let expected = format!("Bearer {}", state.token);
    let actual = headers
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok());
    if actual != Some(expected.as_str()) {
        return Err(WorkbenchBrowserBridgeError::unauthorized());
    }
    Ok(())
}

struct WorkbenchBrowserBridgeError {
    status: axum::http::StatusCode,
    message: String,
}

impl WorkbenchBrowserBridgeError {
    fn unauthorized() -> Self {
        Self {
            status: axum::http::StatusCode::UNAUTHORIZED,
            message: "Unauthorized".to_string(),
        }
    }
}

impl From<String> for WorkbenchBrowserBridgeError {
    fn from(message: String) -> Self {
        Self {
            status: axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            message,
        }
    }
}

impl axum::response::IntoResponse for WorkbenchBrowserBridgeError {
    fn into_response(self) -> axum::response::Response {
        (
            self.status,
            axum::Json(serde_json::json!({
                "ok": false,
                "error": self.message,
            })),
        )
            .into_response()
    }
}

fn now_timestamp_string() -> String {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_secs().to_string())
        .unwrap_or_else(|_| "0".to_string())
}

fn build_app_menu<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<Menu<R>> {
    let package = app.package_info();
    let about_metadata = AboutMetadata {
        name: Some("Neon Pilot".to_string()),
        version: Some(package.version.to_string()),
        ..Default::default()
    };

    let app_menu = Submenu::with_items(
        app,
        "Neon Pilot",
        true,
        &[
            &PredefinedMenuItem::about(app, None, Some(about_metadata))?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "settings", "Settings...", true, Some("CmdOrCtrl+,"))?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::services(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::hide(app, None)?,
            &PredefinedMenuItem::hide_others(app, None)?,
            &PredefinedMenuItem::show_all(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "quit", "Quit Neon Pilot", true, Some("CmdOrCtrl+Q"))?,
        ],
    )?;

    let file_menu = Submenu::with_items(
        app,
        "File",
        true,
        &[
            &MenuItem::with_id(
                app,
                "new-conversation",
                "New Conversation",
                true,
                Some("CmdOrCtrl+N"),
            )?,
            &MenuItem::with_id(
                app,
                "close-conversation",
                "Close Conversation",
                true,
                Some("CmdOrCtrl+W"),
            )?,
            &MenuItem::with_id(
                app,
                "reopen-closed-conversation",
                "Reopen Closed Conversation",
                true,
                Some("CmdOrCtrl+Shift+T"),
            )?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(
                app,
                "previous-conversation",
                "Previous Conversation",
                true,
                Some("CmdOrCtrl+["),
            )?,
            &MenuItem::with_id(
                app,
                "next-conversation",
                "Next Conversation",
                true,
                Some("CmdOrCtrl+]"),
            )?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(
                app,
                "toggle-conversation-pin",
                "Toggle Pinned",
                true,
                Some("CmdOrCtrl+Alt+P"),
            )?,
            &MenuItem::with_id(
                app,
                "toggle-conversation-archive",
                "Archive / Restore",
                true,
                Some("CmdOrCtrl+Alt+A"),
            )?,
            &MenuItem::with_id(
                app,
                "rename-conversation",
                "Rename Conversation",
                true,
                Some("CmdOrCtrl+Alt+R"),
            )?,
            &MenuItem::with_id(
                app,
                "edit-working-directory",
                "Edit Working Directory",
                true,
                Some("CmdOrCtrl+Shift+L"),
            )?,
        ],
    )?;

    let edit_menu = Submenu::with_items(
        app,
        "Edit",
        true,
        &[
            &PredefinedMenuItem::undo(app, None)?,
            &PredefinedMenuItem::redo(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::cut(app, None)?,
            &PredefinedMenuItem::copy(app, None)?,
            &PredefinedMenuItem::paste(app, None)?,
            &PredefinedMenuItem::select_all(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "find-in-page", "Find", true, Some("CmdOrCtrl+F"))?,
        ],
    )?;

    let view_menu = Submenu::with_items(
        app,
        "View",
        true,
        &[
            &MenuItem::with_id(
                app,
                "show-conversation-mode",
                "Conversation Mode",
                true,
                Some("F1"),
            )?,
            &MenuItem::with_id(
                app,
                "show-workbench-mode",
                "Workbench Mode",
                true,
                Some("F2"),
            )?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(
                app,
                "toggle-sidebar",
                "Toggle Left Sidebar",
                true,
                Some("CmdOrCtrl+/"),
            )?,
            &MenuItem::with_id(
                app,
                "toggle-right-rail",
                "Toggle Right Rail",
                true,
                Some("CmdOrCtrl+\\"),
            )?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::fullscreen(app, None)?,
        ],
    )?;

    let window_menu = Submenu::with_items(
        app,
        "Window",
        true,
        &[
            &PredefinedMenuItem::minimize(app, None)?,
            &PredefinedMenuItem::maximize(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::close_window(app, None)?,
        ],
    )?;

    Menu::with_items(
        app,
        &[&app_menu, &file_menu, &edit_menu, &view_menu, &window_menu],
    )
}

fn restore_main_window_state<R: tauri::Runtime>(app: &tauri::AppHandle<R>) {
    let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) else {
        return;
    };
    let Ok(state) = read_tauri_window_state() else {
        return;
    };

    let restored_size = PhysicalSize {
        width: state.width.max(960),
        height: state.height.max(640),
    };
    if state.width > 0 && state.height > 0 {
        if let Err(error) = window.set_size(Size::Physical(restored_size)) {
            tracing::warn!("failed to restore Tauri window size: {error}");
        }
    }

    if let (Some(x), Some(y)) = (state.x, state.y) {
        let position = clamp_window_position(app, PhysicalPosition { x, y }, restored_size);
        if let Err(error) = window.set_position(Position::Physical(position)) {
            tracing::warn!("failed to restore Tauri window position: {error}");
        }
    }
}

fn ensure_main_window<R: tauri::Runtime>(app: &tauri::AppHandle<R>) {
    if app.get_webview_window(MAIN_WINDOW_LABEL).is_some() {
        return;
    }

    if let Err(error) =
        WebviewWindowBuilder::new(app, MAIN_WINDOW_LABEL, WebviewUrl::App("index.html".into()))
            .title("Neon Pilot")
            .inner_size(1280.0, 860.0)
            .min_inner_size(960.0, 640.0)
            .decorations(true)
            .title_bar_style(TitleBarStyle::Overlay)
            .hidden_title(true)
            .traffic_light_position(Position::Logical(LogicalPosition { x: 14.0, y: 24.0 }))
            .build()
    {
        tracing::warn!("failed to create main Tauri window: {error}");
    }
}

fn clamp_window_position<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    position: PhysicalPosition<i32>,
    size: PhysicalSize<u32>,
) -> PhysicalPosition<i32> {
    let monitors = app.available_monitors().unwrap_or_default();
    let target = monitors.iter().find(|monitor| {
        let monitor_position = monitor.position();
        let monitor_size = monitor.size();
        position.x >= monitor_position.x
            && position.y >= monitor_position.y
            && position.x < monitor_position.x + monitor_size.width as i32
            && position.y < monitor_position.y + monitor_size.height as i32
    });
    let monitor = target.or_else(|| monitors.first());
    let Some(monitor) = monitor else {
        return position;
    };

    let monitor_position = monitor.position();
    let monitor_size = monitor.size();
    let max_x = monitor_position.x + (monitor_size.width as i32 - size.width as i32).max(0);
    let max_y = monitor_position.y + (monitor_size.height as i32 - size.height as i32).max(0);
    PhysicalPosition {
        x: position.x.clamp(monitor_position.x, max_x),
        y: position.y.clamp(monitor_position.y, max_y),
    }
}

fn persist_window_state<R: tauri::Runtime>(window: &tauri::Window<R>) {
    let position = window.outer_position().ok();
    let size = window.outer_size().ok();
    persist_tauri_window_state(position, size);
}

fn persist_webview_window_state<R: tauri::Runtime>(window: &tauri::WebviewWindow<R>) {
    let position = window.outer_position().ok();
    let size = window.outer_size().ok();
    persist_tauri_window_state(position, size);
}

fn persist_tauri_window_state(
    position: Option<PhysicalPosition<i32>>,
    size: Option<PhysicalSize<u32>>,
) {
    let Some(size) = size else {
        return;
    };

    if let Err(error) = update_tauri_window_state(TauriWindowState {
        x: position.map(|position| position.x),
        y: position.map(|position| position.y),
        width: size.width,
        height: size.height,
    }) {
        tracing::warn!("failed to persist Tauri window state: {error}");
    }
}

#[cfg(target_os = "macos")]
fn set_app_activation_policy<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    policy: tauri::ActivationPolicy,
) {
    if let Err(error) = app.set_activation_policy(policy) {
        tracing::warn!("failed to update macOS activation policy: {error}");
    }
}

#[cfg(not(target_os = "macos"))]
fn set_app_activation_policy<R: tauri::Runtime>(_app: &tauri::AppHandle<R>, _policy: ()) {}

#[cfg(target_os = "macos")]
fn enter_foreground_app_mode<R: tauri::Runtime>(app: &tauri::AppHandle<R>) {
    set_app_activation_policy(app, tauri::ActivationPolicy::Regular);
}

#[cfg(not(target_os = "macos"))]
fn enter_foreground_app_mode<R: tauri::Runtime>(_app: &tauri::AppHandle<R>) {}

#[cfg(target_os = "macos")]
fn enter_background_app_mode<R: tauri::Runtime>(app: &tauri::AppHandle<R>) {
    set_app_activation_policy(app, tauri::ActivationPolicy::Accessory);
}

#[cfg(not(target_os = "macos"))]
fn enter_background_app_mode<R: tauri::Runtime>(_app: &tauri::AppHandle<R>) {}

fn show_main_window<R: tauri::Runtime>(app: &tauri::AppHandle<R>) {
    let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) else {
        return;
    };

    enter_foreground_app_mode(app);
    if window.is_minimized().unwrap_or(false) {
        let _ = window.unminimize();
    }
    if let Err(error) = window.show() {
        tracing::warn!("failed to show main Tauri window: {error}");
    }
    if let Err(error) = window.set_focus() {
        tracing::warn!("failed to focus main Tauri window: {error}");
    }
}

fn dispatch_shortcut_event<R: tauri::Runtime>(app: &tauri::AppHandle<R>, action: &str) {
    let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) else {
        return;
    };
    let Ok(action_json) = serde_json::to_string(action) else {
        return;
    };
    let script = format!(
        "window.dispatchEvent(new CustomEvent('neon-pilot-desktop-shortcut', {{ detail: {{ action: {} }} }}));",
        action_json
    );
    if let Err(error) = window.eval(script) {
        tracing::warn!("failed to dispatch desktop shortcut event: {error}");
    }
}

fn dispatch_navigation_event<R: tauri::Runtime>(app: &tauri::AppHandle<R>, route: &str) {
    let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) else {
        return;
    };
    let Ok(route_json) = serde_json::to_string(route) else {
        return;
    };
    let script = format!(
        "window.dispatchEvent(new CustomEvent('neon-pilot-desktop-navigate', {{ detail: {{ route: {} }} }}));",
        route_json
    );
    if let Err(error) = window.eval(script) {
        tracing::warn!("failed to dispatch desktop navigation event: {error}");
    }
}

fn handle_native_menu_event<R: tauri::Runtime>(app: &tauri::AppHandle<R>, id: &str) {
    match id {
        "new-conversation" => dispatch_navigation_event(app, "/conversations/new"),
        "settings" => dispatch_navigation_event(app, "/settings"),
        "quit" => request_quit(app),
        "close-conversation"
        | "reopen-closed-conversation"
        | "previous-conversation"
        | "next-conversation"
        | "toggle-conversation-pin"
        | "toggle-conversation-archive"
        | "rename-conversation"
        | "edit-working-directory"
        | "find-in-page"
        | "show-conversation-mode"
        | "show-workbench-mode"
        | "toggle-sidebar"
        | "toggle-right-rail" => dispatch_shortcut_event(app, id),
        _ => {}
    }
}

fn request_quit<R: tauri::Runtime>(app: &tauri::AppHandle<R>) {
    if let Some(state) = app.try_state::<Arc<ShellState>>() {
        if state.allow_quit_without_prompt() || confirm_quit_dialog() {
            state.begin_quit();
            state.confirm_quit();
            finish_quit(app);
        }
    } else if confirm_quit_dialog() {
        finish_quit(app);
    }
}

fn confirm_quit_dialog() -> bool {
    let result = rfd::MessageDialog::new()
        .set_level(rfd::MessageLevel::Info)
        .set_title("Quit Neon Pilot?")
        .set_description(
            "Closing the window only hides it. Quitting closes the menu bar app and stops the local runtime until you reopen it.",
        )
        .set_buttons(rfd::MessageButtons::OkCancelCustom(
            "Quit Neon Pilot".to_string(),
            "Cancel".to_string(),
        ))
        .show();
    match result {
        rfd::MessageDialogResult::Ok => true,
        rfd::MessageDialogResult::Custom(value) => value == "Quit Neon Pilot",
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_blank_browser_session_key() {
        assert_eq!(normalize_browser_session_key(None), "default");
        assert_eq!(normalize_browser_session_key(Some("  ")), "default");
        assert_eq!(
            normalize_browser_session_key(Some("@global:tab-1")),
            "@global:tab-1"
        );
    }

    #[test]
    fn sanitizes_browser_webview_label() {
        assert_eq!(
            browser_webview_label("@global:tab-alpha/beta"),
            "workbench-browser--global-tab-alpha-beta"
        );
    }

    #[test]
    fn parses_browser_urls_like_the_desktop_url_bar() {
        assert_eq!(
            parse_workbench_browser_url("example.com")
                .expect("url")
                .as_str(),
            "https://example.com/"
        );
        assert_eq!(
            parse_workbench_browser_url("about:blank")
                .expect("url")
                .as_str(),
            "about:blank"
        );
        assert!(parse_workbench_browser_url("file:///tmp/nope").is_err());
    }
}

fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .with_writer(std::io::stderr)
        .init();

    let host_state = Arc::new(HostState::default());
    let shell_state = Arc::new(ShellState::from_args(std::env::args()));
    tauri::Builder::default()
        .manage(host_state)
        .manage(shell_state)
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_main_window(app);
        }))
        .menu(build_app_menu)
        .on_menu_event(|app, event| {
            handle_native_menu_event(app, event.id().as_ref());
        })
        .setup(|app| {
            ensure_main_window(app.handle());
            restore_main_window_state(app.handle());
            enter_foreground_app_mode(app.handle());
            show_main_window(app.handle());
            Ok(())
        })
        .on_window_event(|window, event| match event {
            WindowEvent::CloseRequested { api, .. } => {
                if let Some(state) = window.app_handle().try_state::<Arc<ShellState>>() {
                    if state.is_quitting() || state.skip_quit_confirmation {
                        state.begin_quit();
                        persist_window_state(window);
                        shutdown_js_sidecar(&window.app_handle());
                        return;
                    }
                }
                api.prevent_close();
                persist_window_state(window);
                if let Err(error) = window.hide() {
                    tracing::warn!("failed to hide main Tauri window: {error}");
                }
                enter_background_app_mode(&window.app_handle());
            }
            WindowEvent::Moved(_) | WindowEvent::Resized(_) => {
                persist_window_state(window);
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            apply_sqlite_migrations_command,
            check_for_updates,
            delete_secret,
            get_environment,
            get_navigation_state,
            get_secret,
            get_workbench_browser_state,
            go_back_workbench_browser,
            go_forward_workbench_browser,
            host_status,
            import_extension_bundle_command,
            install_extension_package_command,
            list_secret_keys,
            navigate_workbench_browser,
            open_external_url,
            open_path,
            pick_folder,
            read_desktop_app_preferences,
            reload_workbench_browser,
            scoped_list_dir,
            scoped_read_text,
            scoped_remove_path,
            scoped_resolve_path,
            scoped_write_text,
            set_secret,
            set_workbench_browser_bounds,
            snapshot_workbench_browser,
            start_js_sidecar,
            stop_workbench_browser,
            dispatch_local_api,
            update_desktop_app_preferences,
            validate_extension_package_command,
            write_clipboard_text
        ])
        .build(tauri::generate_context!())
        .expect("error while building Neon Pilot Tauri host")
        .run(|app, event| match event {
            RunEvent::Reopen {
                has_visible_windows,
                ..
            } => {
                if !has_visible_windows {
                    show_main_window(app);
                }
            }
            RunEvent::ExitRequested { code, api, .. } => {
                let Some(state) = app.try_state::<Arc<ShellState>>() else {
                    return;
                };
                if code.is_some() && state.is_quitting() {
                    return;
                }
                if state.allow_quit_without_prompt() {
                    api.prevent_exit();
                    state.begin_quit();
                    state.confirm_quit();
                    finish_quit(app);
                }
                api.prevent_exit();
                if confirm_quit_dialog() {
                    state.begin_quit();
                    state.confirm_quit();
                    finish_quit(app);
                }
            }
            RunEvent::Exit => {
                shutdown_js_sidecar(app);
            }
            _ => {}
        });
}
