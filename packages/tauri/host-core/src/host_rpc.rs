use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::{Arc, Mutex as StdMutex};
use std::thread;

use anyhow::{anyhow, Context};
use axum::extract::State;
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use portable_pty::{native_pty_system, Child as PtyChild, CommandBuilder, MasterPty, PtySize};
use serde::{Deserialize, Serialize};
use serde_json::json;
use tokio::io::{AsyncRead, AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio::process::{Child, Command};
use tokio::sync::{oneshot, Mutex};
use tracing::warn;

use crate::extension_install::{import_extension_bundle, install_extension_package};
use crate::extension_package::validate_extension_package;
use crate::filesystem::{
    list_scoped_dir, read_scoped_text, remove_scoped_path, scoped_path, write_scoped_text,
};
use crate::process::{
    exec_host_process, validate_process_args, validate_process_command, validate_process_cwd,
    validate_process_env, HostProcessExecInput, ProcessWrapperMetadata,
};
use crate::secrets::{
    delete_host_secret, get_host_secret, list_file_secret_keys, set_host_secret, HostSecretBackend,
};
use crate::sqlite::{apply_sqlite_migrations, SqliteMigration};

#[derive(Debug)]
pub struct HostCoreRpcServer {
    pub port: u16,
    pub token: String,
    shutdown: Option<oneshot::Sender<()>>,
}

impl HostCoreRpcServer {
    pub async fn shutdown(mut self) {
        if let Some(shutdown) = self.shutdown.take() {
            let _ = shutdown.send(());
        }
    }
}

#[derive(Default)]
struct HostCoreRpcState {
    token: String,
    processes: Mutex<HashMap<String, RpcProcess>>,
}

struct RpcProcess {
    kind: RpcProcessKind,
    stdout: Arc<StdMutex<String>>,
    stderr: Arc<StdMutex<String>>,
    exited: Option<RpcProcessExit>,
}

enum RpcProcessKind {
    Pipe { child: Child },
    Pty {
        child: Box<dyn PtyChild + Send + Sync>,
        master: Box<dyn MasterPty + Send>,
        writer: Box<dyn Write + Send>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RpcProcessExit {
    code: Option<i32>,
    signal: Option<String>,
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
    #[serde(default)]
    backend: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SecretSetInput {
    key: String,
    value: String,
    #[serde(default)]
    backend: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SqliteMigrateInput {
    root: String,
    path: String,
    migrations: Vec<SqliteMigration>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SpawnInput {
    command: String,
    #[serde(default)]
    args: Vec<String>,
    #[serde(default)]
    cwd: Option<String>,
    #[serde(default)]
    env: HashMap<String, String>,
    #[serde(default)]
    pty: Option<PtySpawnInput>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PtySpawnInput {
    #[serde(default = "default_pty_cols")]
    cols: u16,
    #[serde(default = "default_pty_rows")]
    rows: u16,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProcessIdInput {
    id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProcessWriteInput {
    id: String,
    data: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProcessResizeInput {
    id: String,
    cols: u16,
    rows: u16,
}

pub async fn start_host_core_rpc_server(token: String) -> anyhow::Result<HostCoreRpcServer> {
    let listener = TcpListener::bind("127.0.0.1:0").await?;
    let port = listener.local_addr()?.port();
    let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();
    let state = Arc::new(HostCoreRpcState {
        token: token.clone(),
        processes: Mutex::new(HashMap::new()),
    });
    let app = Router::new()
        .route("/health", get(health))
        .route("/process/exec", post(process_exec))
        .route("/process/spawn", post(process_spawn))
        .route("/process/read", post(process_read))
        .route("/process/write", post(process_write))
        .route("/process/resize", post(process_resize))
        .route("/process/kill", post(process_kill))
        .route("/filesystem/resolve", post(filesystem_resolve))
        .route("/filesystem/read-text", post(filesystem_read_text))
        .route("/filesystem/write-text", post(filesystem_write_text))
        .route("/filesystem/list", post(filesystem_list))
        .route("/filesystem/remove", post(filesystem_remove))
        .route("/secrets/get", post(secret_get))
        .route("/secrets/set", post(secret_set))
        .route("/secrets/delete", post(secret_delete))
        .route("/secrets/list-keys", post(secret_list_keys))
        .route("/sqlite/migrate", post(sqlite_migrate))
        .route("/extensions/validate", post(extension_validate))
        .route("/extensions/install", post(extension_install))
        .route("/extensions/import-bundle", post(extension_import_bundle))
        .with_state(state);
    tokio::spawn(async move {
        let server = axum::serve(listener, app).with_graceful_shutdown(async {
            let _ = shutdown_rx.await;
        });
        if let Err(error) = server.await {
            warn!("host-core RPC server failed: {error}");
        }
    });
    Ok(HostCoreRpcServer {
        port,
        token,
        shutdown: Some(shutdown_tx),
    })
}

async fn health(State(state): State<Arc<HostCoreRpcState>>, headers: HeaderMap) -> RpcResult {
    authorize(&state, &headers)?;
    Ok(Json(json!({ "ok": true })))
}

async fn process_exec(
    State(state): State<Arc<HostCoreRpcState>>,
    headers: HeaderMap,
    Json(input): Json<HostProcessExecInput>,
) -> RpcResult {
    authorize(&state, &headers)?;
    let result = exec_host_process(input).await?;
    Ok(Json(serde_json::to_value(result)?))
}

async fn process_spawn(
    State(state): State<Arc<HostCoreRpcState>>,
    headers: HeaderMap,
    Json(input): Json<SpawnInput>,
) -> RpcResult {
    authorize(&state, &headers)?;
    validate_process_command(&input.command)?;
    validate_process_args(&input.args)?;
    validate_process_cwd(input.cwd.as_deref())?;
    validate_process_env(&input.env)?;
    if input.pty.is_some() {
        return spawn_pty_process(state, input).await;
    }
    spawn_pipe_process(state, input).await
}

async fn spawn_pipe_process(state: Arc<HostCoreRpcState>, input: SpawnInput) -> RpcResult {
    let id = uuid_like();
    let mut command = Command::new(&input.command);
    command
        .args(&input.args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if let Some(cwd) = input.cwd.as_deref() {
        command.current_dir(PathBuf::from(cwd));
    }
    if !input.env.is_empty() {
        command.envs(&input.env);
    }
    let mut child = command
        .spawn()
        .with_context(|| format!("launching {}", input.command))?;
    let pid = child.id();
    let stdout = Arc::new(StdMutex::new(String::new()));
    let stderr = Arc::new(StdMutex::new(String::new()));
    if let Some(out) = child.stdout.take() {
        capture_async_stream(out, stdout.clone());
    }
    if let Some(err) = child.stderr.take() {
        capture_async_stream(err, stderr.clone());
    }
    state.processes.lock().await.insert(
        id.clone(),
        RpcProcess {
            kind: RpcProcessKind::Pipe { child },
            stdout,
            stderr,
            exited: None,
        },
    );
    Ok(Json(json!({
        "id": id,
        "pid": pid,
        "usingPty": false,
        "executionWrappers": rust_wrappers()
    })))
}

async fn spawn_pty_process(state: Arc<HostCoreRpcState>, input: SpawnInput) -> RpcResult {
    let pty = input.pty.unwrap_or(PtySpawnInput {
        cols: default_pty_cols(),
        rows: default_pty_rows(),
    });
    let cols = pty.cols.max(1);
    let rows = pty.rows.max(1);
    let pty_system = native_pty_system();
    let pair = pty_system.openpty(PtySize {
        rows,
        cols,
        pixel_width: 0,
        pixel_height: 0,
    })?;
    let mut command = CommandBuilder::new(&input.command);
    command.args(&input.args);
    if let Some(cwd) = input.cwd.as_deref() {
        command.cwd(cwd);
    }
    for (key, value) in &input.env {
        command.env(key, value);
    }
    let child = pair
        .slave
        .spawn_command(command)
        .with_context(|| format!("launching {} in pty", input.command))?;
    let pid = child.process_id();
    let stdout = Arc::new(StdMutex::new(String::new()));
    let stderr = Arc::new(StdMutex::new(String::new()));
    capture_blocking_reader(pair.master.try_clone_reader()?, stdout.clone());
    let writer = pair.master.take_writer()?;
    let id = uuid_like();
    state.processes.lock().await.insert(
        id.clone(),
        RpcProcess {
            kind: RpcProcessKind::Pty {
                child,
                master: pair.master,
                writer,
            },
            stdout,
            stderr,
            exited: None,
        },
    );
    Ok(Json(json!({
        "id": id,
        "pid": pid,
        "usingPty": true,
        "executionWrappers": rust_wrappers()
    })))
}

async fn process_read(
    State(state): State<Arc<HostCoreRpcState>>,
    headers: HeaderMap,
    Json(input): Json<ProcessIdInput>,
) -> RpcResult {
    authorize(&state, &headers)?;
    let mut processes = state.processes.lock().await;
    let process = processes
        .get_mut(&input.id)
        .ok_or_else(|| anyhow!("Unknown process id."))?;
    update_process_exit(process)?;
    Ok(Json(json!({
        "id": input.id,
        "stdout": clone_buffer(&process.stdout)?,
        "stderr": clone_buffer(&process.stderr)?,
        "exit": process.exited
    })))
}

async fn process_write(
    State(state): State<Arc<HostCoreRpcState>>,
    headers: HeaderMap,
    Json(input): Json<ProcessWriteInput>,
) -> RpcResult {
    authorize(&state, &headers)?;
    let mut processes = state.processes.lock().await;
    let process = processes
        .get_mut(&input.id)
        .ok_or_else(|| anyhow!("Unknown process id."))?;
    match &mut process.kind {
        RpcProcessKind::Pipe { child } => {
            if let Some(stdin) = child.stdin.as_mut() {
                stdin.write_all(input.data.as_bytes()).await?;
            }
        }
        RpcProcessKind::Pty { writer, .. } => {
            writer.write_all(input.data.as_bytes())?;
            writer.flush()?;
        }
    }
    Ok(Json(json!({ "ok": true })))
}

async fn process_resize(
    State(state): State<Arc<HostCoreRpcState>>,
    headers: HeaderMap,
    Json(input): Json<ProcessResizeInput>,
) -> RpcResult {
    authorize(&state, &headers)?;
    let mut processes = state.processes.lock().await;
    let process = processes
        .get_mut(&input.id)
        .ok_or_else(|| anyhow!("Unknown process id."))?;
    if let RpcProcessKind::Pty { master, .. } = &mut process.kind {
        master.resize(PtySize {
            rows: input.rows.max(1),
            cols: input.cols.max(1),
            pixel_width: 0,
            pixel_height: 0,
        })?;
    }
    Ok(Json(json!({ "ok": true })))
}

async fn process_kill(
    State(state): State<Arc<HostCoreRpcState>>,
    headers: HeaderMap,
    Json(input): Json<ProcessIdInput>,
) -> RpcResult {
    authorize(&state, &headers)?;
    let mut processes = state.processes.lock().await;
    let mut process = processes
        .remove(&input.id)
        .ok_or_else(|| anyhow!("Unknown process id."))?;
    match &mut process.kind {
        RpcProcessKind::Pipe { child } => {
            let _ = child.kill().await;
        }
        RpcProcessKind::Pty { child, .. } => {
            let _ = child.kill();
        }
    }
    Ok(Json(json!({ "ok": true })))
}

async fn filesystem_resolve(
    State(state): State<Arc<HostCoreRpcState>>,
    headers: HeaderMap,
    Json(input): Json<ScopedPathInput>,
) -> RpcResult {
    authorize(&state, &headers)?;
    Ok(Json(serde_json::to_value(scoped_path(
        input.root, input.path,
    )?)?))
}

async fn filesystem_read_text(
    State(state): State<Arc<HostCoreRpcState>>,
    headers: HeaderMap,
    Json(input): Json<ScopedPathInput>,
) -> RpcResult {
    authorize(&state, &headers)?;
    Ok(Json(
        json!({ "text": read_scoped_text(input.root, input.path)? }),
    ))
}

async fn filesystem_write_text(
    State(state): State<Arc<HostCoreRpcState>>,
    headers: HeaderMap,
    Json(input): Json<ScopedWriteTextInput>,
) -> RpcResult {
    authorize(&state, &headers)?;
    Ok(Json(serde_json::to_value(write_scoped_text(
        input.root,
        input.path,
        &input.text,
    )?)?))
}

async fn filesystem_list(
    State(state): State<Arc<HostCoreRpcState>>,
    headers: HeaderMap,
    Json(input): Json<ScopedPathInput>,
) -> RpcResult {
    authorize(&state, &headers)?;
    Ok(Json(serde_json::to_value(list_scoped_dir(
        input.root, input.path,
    )?)?))
}

async fn filesystem_remove(
    State(state): State<Arc<HostCoreRpcState>>,
    headers: HeaderMap,
    Json(input): Json<ScopedPathInput>,
) -> RpcResult {
    authorize(&state, &headers)?;
    Ok(Json(serde_json::to_value(remove_scoped_path(
        input.root, input.path,
    )?)?))
}

async fn secret_get(
    State(state): State<Arc<HostCoreRpcState>>,
    headers: HeaderMap,
    Json(input): Json<SecretInput>,
) -> RpcResult {
    authorize(&state, &headers)?;
    let backend = HostSecretBackend::from_id(input.backend.as_deref())?;
    Ok(Json(json!({ "value": get_host_secret(&input.key, backend)? })))
}

async fn secret_set(
    State(state): State<Arc<HostCoreRpcState>>,
    headers: HeaderMap,
    Json(input): Json<SecretSetInput>,
) -> RpcResult {
    authorize(&state, &headers)?;
    let backend = HostSecretBackend::from_id(input.backend.as_deref())?;
    Ok(Json(serde_json::to_value(set_host_secret(
        &input.key,
        &input.value,
        backend,
    )?)?))
}

async fn secret_delete(
    State(state): State<Arc<HostCoreRpcState>>,
    headers: HeaderMap,
    Json(input): Json<SecretInput>,
) -> RpcResult {
    authorize(&state, &headers)?;
    let backend = HostSecretBackend::from_id(input.backend.as_deref())?;
    Ok(Json(serde_json::to_value(delete_host_secret(
        &input.key,
        backend,
    )?)?))
}

async fn secret_list_keys(
    State(state): State<Arc<HostCoreRpcState>>,
    headers: HeaderMap,
) -> RpcResult {
    authorize(&state, &headers)?;
    Ok(Json(json!({ "keys": list_file_secret_keys()? })))
}

async fn sqlite_migrate(
    State(state): State<Arc<HostCoreRpcState>>,
    headers: HeaderMap,
    Json(input): Json<SqliteMigrateInput>,
) -> RpcResult {
    authorize(&state, &headers)?;
    let db_path = scoped_path(input.root, input.path)?.absolute_path;
    Ok(Json(
        json!({ "version": apply_sqlite_migrations(db_path, &input.migrations)? }),
    ))
}

async fn extension_validate(
    State(state): State<Arc<HostCoreRpcState>>,
    headers: HeaderMap,
    Json(input): Json<HashMap<String, String>>,
) -> RpcResult {
    authorize(&state, &headers)?;
    let package_root = input
        .get("packageRoot")
        .ok_or_else(|| anyhow!("packageRoot is required."))?;
    Ok(Json(serde_json::to_value(validate_extension_package(
        package_root,
    )?)?))
}

async fn extension_install(
    State(state): State<Arc<HostCoreRpcState>>,
    headers: HeaderMap,
    Json(input): Json<HashMap<String, String>>,
) -> RpcResult {
    authorize(&state, &headers)?;
    let package_root = input
        .get("packageRoot")
        .ok_or_else(|| anyhow!("packageRoot is required."))?;
    Ok(Json(serde_json::to_value(install_extension_package(
        package_root,
    )?)?))
}

async fn extension_import_bundle(
    State(state): State<Arc<HostCoreRpcState>>,
    headers: HeaderMap,
    Json(input): Json<HashMap<String, String>>,
) -> RpcResult {
    authorize(&state, &headers)?;
    let zip_path = input
        .get("zipPath")
        .ok_or_else(|| anyhow!("zipPath is required."))?;
    Ok(Json(serde_json::to_value(import_extension_bundle(
        zip_path,
    )?)?))
}

type RpcResult = Result<Json<serde_json::Value>, RpcError>;

struct RpcError(anyhow::Error);

impl IntoResponse for RpcError {
    fn into_response(self) -> Response {
        let status = if self.0.to_string() == "Unauthorized" {
            StatusCode::UNAUTHORIZED
        } else {
            StatusCode::INTERNAL_SERVER_ERROR
        };
        (status, Json(json!({ "error": self.0.to_string() }))).into_response()
    }
}

impl From<anyhow::Error> for RpcError {
    fn from(error: anyhow::Error) -> Self {
        Self(error)
    }
}

impl From<serde_json::Error> for RpcError {
    fn from(error: serde_json::Error) -> Self {
        Self(error.into())
    }
}

impl From<std::io::Error> for RpcError {
    fn from(error: std::io::Error) -> Self {
        Self(error.into())
    }
}

fn authorize(state: &HostCoreRpcState, headers: &HeaderMap) -> anyhow::Result<()> {
    let value = headers
        .get("authorization")
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default();
    if value == format!("Bearer {}", state.token) {
        return Ok(());
    }
    anyhow::bail!("Unauthorized")
}

fn update_process_exit(process: &mut RpcProcess) -> anyhow::Result<()> {
    if process.exited.is_some() {
        return Ok(());
    }
    match &mut process.kind {
        RpcProcessKind::Pipe { child } => {
            if let Some(status) = child.try_wait()? {
                process.exited = Some(RpcProcessExit {
                    code: status.code(),
                    signal: None,
                });
            }
        }
        RpcProcessKind::Pty { child, .. } => {
            if let Some(status) = child.try_wait()? {
                process.exited = Some(RpcProcessExit {
                    code: Some(status.exit_code() as i32),
                    signal: status.signal().map(ToString::to_string),
                });
            }
        }
    }
    Ok(())
}

fn capture_async_stream(
    mut stream: impl AsyncRead + Unpin + Send + 'static,
    target: Arc<StdMutex<String>>,
) {
    tokio::spawn(async move {
        let mut buffer = [0_u8; 8192];
        loop {
            match stream.read(&mut buffer).await {
                Ok(0) => break,
                Ok(count) => append_buffer(&target, &buffer[..count]),
                Err(_) => break,
            }
        }
    });
}

fn capture_blocking_reader(mut reader: Box<dyn Read + Send>, target: Arc<StdMutex<String>>) {
    thread::spawn(move || {
        let mut buffer = [0_u8; 8192];
        loop {
            match reader.read(&mut buffer) {
                Ok(0) => break,
                Ok(count) => append_buffer(&target, &buffer[..count]),
                Err(_) => break,
            }
        }
    });
}

fn append_buffer(target: &Arc<StdMutex<String>>, bytes: &[u8]) {
    if let Ok(mut target) = target.lock() {
        target.push_str(&String::from_utf8_lossy(bytes));
    }
}

fn clone_buffer(target: &Arc<StdMutex<String>>) -> anyhow::Result<String> {
    target
        .lock()
        .map(|value| value.clone())
        .map_err(|_| anyhow!("Process output buffer lock was poisoned."))
}

fn default_pty_cols() -> u16 {
    80
}

fn default_pty_rows() -> u16 {
    24
}

fn rust_wrappers() -> Vec<ProcessWrapperMetadata> {
    vec![ProcessWrapperMetadata {
        id: "tauri-host-core".to_string(),
        label: Some("Tauri Rust host core".to_string()),
    }]
}

fn uuid_like() -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or_default();
    format!("proc-{}-{now}", std::process::id())
}

#[cfg(test)]
mod tests {
    use reqwest::Client;

    use super::*;

    #[tokio::test]
    async fn serves_authorized_process_exec() {
        let server = start_host_core_rpc_server("test-token".to_string())
            .await
            .expect("server");
        let response = Client::new()
            .post(format!("http://127.0.0.1:{}/process/exec", server.port))
            .bearer_auth("test-token")
            .json(&json!({ "command": "node", "args": ["-e", "process.stdout.write('rpc-ok')"] }))
            .send()
            .await
            .expect("send");
        assert!(response.status().is_success());
        let body = response.json::<serde_json::Value>().await.expect("json");
        assert_eq!(body["stdout"], "rpc-ok");
        server.shutdown().await;
    }

    #[tokio::test]
    async fn serves_pty_spawn_read_resize_and_kill() {
        let server = start_host_core_rpc_server("test-token".to_string())
            .await
            .expect("server");
        let client = Client::new();
        let response = client
            .post(format!("http://127.0.0.1:{}/process/spawn", server.port))
            .bearer_auth("test-token")
            .json(&json!({
                "command": "sh",
                "args": ["-c", "printf pty-ok"],
                "pty": { "cols": 100, "rows": 30 }
            }))
            .send()
            .await
            .expect("spawn");
        assert!(response.status().is_success());
        let spawned = response.json::<serde_json::Value>().await.expect("json");
        assert_eq!(spawned["usingPty"], true);
        let id = spawned["id"].as_str().expect("id");

        let resize = client
            .post(format!("http://127.0.0.1:{}/process/resize", server.port))
            .bearer_auth("test-token")
            .json(&json!({ "id": id, "cols": 120, "rows": 40 }))
            .send()
            .await
            .expect("resize");
        assert!(resize.status().is_success());

        let mut body = serde_json::Value::Null;
        for _ in 0..20 {
            let response = client
                .post(format!("http://127.0.0.1:{}/process/read", server.port))
                .bearer_auth("test-token")
                .json(&json!({ "id": id }))
                .send()
                .await
                .expect("read");
            body = response.json::<serde_json::Value>().await.expect("json");
            if body["stdout"].as_str().unwrap_or_default().contains("pty-ok") {
                break;
            }
            tokio::time::sleep(std::time::Duration::from_millis(25)).await;
        }
        assert!(body["stdout"].as_str().unwrap_or_default().contains("pty-ok"));

        let kill = client
            .post(format!("http://127.0.0.1:{}/process/kill", server.port))
            .bearer_auth("test-token")
            .json(&json!({ "id": id }))
            .send()
            .await
            .expect("kill");
        assert!(kill.status().is_success());
        server.shutdown().await;
    }
}
