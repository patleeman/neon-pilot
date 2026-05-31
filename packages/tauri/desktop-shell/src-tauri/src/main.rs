use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;

use neon_pilot_host_core::{
    apply_sqlite_migrations, delete_file_secret, get_file_secret, install_extension_package,
    list_file_secret_keys, list_scoped_dir, read_scoped_text, read_tauri_app_preferences,
    remove_scoped_path, resolve_repo_root as resolve_host_repo_root, scoped_path, set_file_secret,
    start_host_core_rpc_server, update_tauri_app_preferences, validate_extension_package,
    write_scoped_text, HostCoreRpcServer, JsSidecarConfig, JsSidecarHandle, JsSidecarReady,
    JsSidecarStatus, SqliteMigration, TauriAppPreferencesPatch,
};
use serde::{Deserialize, Serialize};
use tauri::{Manager, State};
use tokio::sync::Mutex;

#[derive(Default)]
struct HostState {
    sidecar: Mutex<Option<JsSidecarHandle>>,
    host_core_rpc: Mutex<Option<HostCoreRpcServer>>,
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
    is_electron: bool,
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
        is_electron: false,
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

struct HostCoreRpcServerStatus {
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
    }

    Err("Could not resolve Neon Pilot repo root for Tauri host.".to_string())
}

fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .with_writer(std::io::stderr)
        .init();

    let host_state = Arc::new(HostState::default());
    tauri::Builder::default()
        .manage(host_state)
        .invoke_handler(tauri::generate_handler![
            apply_sqlite_migrations_command,
            check_for_updates,
            delete_secret,
            get_environment,
            get_navigation_state,
            get_secret,
            host_status,
            install_extension_package_command,
            list_secret_keys,
            open_external_url,
            open_path,
            pick_folder,
            read_desktop_app_preferences,
            scoped_list_dir,
            scoped_read_text,
            scoped_remove_path,
            scoped_resolve_path,
            scoped_write_text,
            set_secret,
            start_js_sidecar,
            dispatch_local_api,
            update_desktop_app_preferences,
            validate_extension_package_command,
            write_clipboard_text
        ])
        .run(tauri::generate_context!())
        .expect("error while running Neon Pilot Tauri host");
}
