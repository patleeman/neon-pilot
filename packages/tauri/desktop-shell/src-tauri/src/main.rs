use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;

use neon_pilot_host_core::{
    read_tauri_app_preferences, resolve_repo_root as resolve_host_repo_root,
    update_tauri_app_preferences, validate_extension_package, JsSidecarConfig, JsSidecarHandle,
    JsSidecarReady, JsSidecarStatus, TauriAppPreferencesPatch,
};
use serde::{Deserialize, Serialize};
use tauri::{Manager, State};
use tokio::sync::Mutex;

#[derive(Default)]
struct HostState {
    sidecar: Mutex<Option<JsSidecarHandle>>,
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
    let sidecar = JsSidecarHandle::launch(JsSidecarConfig {
        node_command: "node".to_string(),
        entry_file,
        repo_root,
        token,
        env: HashMap::new(),
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
            check_for_updates,
            get_environment,
            get_navigation_state,
            host_status,
            open_external_url,
            open_path,
            pick_folder,
            read_desktop_app_preferences,
            start_js_sidecar,
            dispatch_local_api,
            update_desktop_app_preferences,
            validate_extension_package_command,
            write_clipboard_text
        ])
        .run(tauri::generate_context!())
        .expect("error while running Neon Pilot Tauri host");
}
