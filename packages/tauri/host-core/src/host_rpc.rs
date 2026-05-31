use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Arc;

use anyhow::{anyhow, Context};
use axum::extract::State;
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use serde_json::json;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpListener;
use tokio::process::{Child, Command};
use tokio::sync::{oneshot, Mutex};
use tracing::warn;

use crate::extension_install::install_extension_package;
use crate::extension_package::validate_extension_package;
use crate::filesystem::{
    list_scoped_dir, read_scoped_text, remove_scoped_path, scoped_path, write_scoped_text,
};
use crate::process::{exec_host_process, HostProcessExecInput, ProcessWrapperMetadata};
use crate::secrets::{delete_file_secret, get_file_secret, list_file_secret_keys, set_file_secret};
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

#[derive(Debug, Default)]
struct HostCoreRpcState {
    token: String,
    processes: Mutex<HashMap<String, RpcProcess>>,
}

#[derive(Debug)]
struct RpcProcess {
    child: Child,
    stdout: Arc<Mutex<String>>,
    stderr: Arc<Mutex<String>>,
    exited: Option<RpcProcessExit>,
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
    if input.command.trim().is_empty() {
        return Err(anyhow!("Process command is required.").into());
    }
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
    let stdout = Arc::new(Mutex::new(String::new()));
    let stderr = Arc::new(Mutex::new(String::new()));
    if let Some(out) = child.stdout.take() {
        capture_lines(out, stdout.clone());
    }
    if let Some(err) = child.stderr.take() {
        capture_lines(err, stderr.clone());
    }
    state.processes.lock().await.insert(
        id.clone(),
        RpcProcess {
            child,
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
    if process.exited.is_none() {
        if let Some(status) = process.child.try_wait()? {
            process.exited = Some(RpcProcessExit {
                code: status.code(),
                signal: None,
            });
        }
    }
    Ok(Json(json!({
        "id": input.id,
        "stdout": process.stdout.lock().await.clone(),
        "stderr": process.stderr.lock().await.clone(),
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
    if let Some(stdin) = process.child.stdin.as_mut() {
        stdin.write_all(input.data.as_bytes()).await?;
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
    let _ = process.child.kill().await;
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
    Ok(Json(json!({ "value": get_file_secret(&input.key)? })))
}

async fn secret_set(
    State(state): State<Arc<HostCoreRpcState>>,
    headers: HeaderMap,
    Json(input): Json<SecretSetInput>,
) -> RpcResult {
    authorize(&state, &headers)?;
    Ok(Json(serde_json::to_value(set_file_secret(
        &input.key,
        &input.value,
    )?)?))
}

async fn secret_delete(
    State(state): State<Arc<HostCoreRpcState>>,
    headers: HeaderMap,
    Json(input): Json<SecretInput>,
) -> RpcResult {
    authorize(&state, &headers)?;
    Ok(Json(serde_json::to_value(delete_file_secret(&input.key)?)?))
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

fn capture_lines(
    stream: impl tokio::io::AsyncRead + Unpin + Send + 'static,
    target: Arc<Mutex<String>>,
) {
    tokio::spawn(async move {
        let mut lines = BufReader::new(stream).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let mut target = target.lock().await;
            target.push_str(&line);
            target.push('\n');
        }
    });
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
}
