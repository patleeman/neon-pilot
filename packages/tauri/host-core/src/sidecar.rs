use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Arc;
use std::time::Duration;

use anyhow::{anyhow, Context};
use serde::{Deserialize, Serialize};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::Mutex;
use tokio::time::timeout;
use tracing::{debug, warn};

const DEFAULT_READY_TIMEOUT: Duration = Duration::from_secs(20);

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JsSidecarConfig {
    pub node_command: String,
    pub entry_file: PathBuf,
    pub repo_root: PathBuf,
    pub token: String,
    #[serde(default)]
    pub env: HashMap<String, String>,
    #[serde(default)]
    pub ready_timeout_ms: Option<u64>,
    #[serde(default)]
    pub launch_mode: SidecarLaunchMode,
}

#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SidecarLaunchMode {
    #[default]
    LocalBackendChild,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JsSidecarReady {
    pub port: u16,
    pub token: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JsSidecarStatus {
    pub running: bool,
    pub ready: Option<JsSidecarReady>,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
enum BackendMessage {
    #[serde(rename = "ready")]
    Ready { port: u16, token: String },
    #[serde(rename = "fatal")]
    Fatal { error: String },
}

#[derive(Debug)]
struct JsSidecarState {
    child: Child,
    ready: JsSidecarReady,
}

#[derive(Debug, Clone)]
pub struct JsSidecarHandle {
    state: Arc<Mutex<Option<JsSidecarState>>>,
}

impl JsSidecarHandle {
    pub async fn launch(config: JsSidecarConfig) -> anyhow::Result<Self> {
        let ready_timeout = config
            .ready_timeout_ms
            .map(Duration::from_millis)
            .unwrap_or(DEFAULT_READY_TIMEOUT);
        let mut command = Command::new(&config.node_command);
        command
            .arg(&config.entry_file)
            .current_dir(&config.repo_root)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .env("NEON_PILOT_BACKEND_TOKEN", &config.token)
            .env("NEON_PILOT_REPO_ROOT", &config.repo_root);

        for (key, value) in &config.env {
            command.env(key, value);
        }

        let mut child = command.spawn().with_context(|| {
            format!(
                "launching JS sidecar {} with {}",
                config.entry_file.display(),
                config.node_command
            )
        })?;

        if let Some(stderr) = child.stderr.take() {
            tokio::spawn(async move {
                let mut lines = BufReader::new(stderr).lines();
                while let Ok(Some(line)) = lines.next_line().await {
                    warn!(target: "neon_pilot_sidecar", "{line}");
                }
            });
        }

        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| anyhow!("JS sidecar stdout was not captured"))?;
        let mut lines = BufReader::new(stdout).lines();
        let ready = timeout(ready_timeout, async {
            while let Some(line) = lines.next_line().await? {
                debug!(target: "neon_pilot_sidecar", "{line}");
                let Ok(message) = serde_json::from_str::<BackendMessage>(&line) else {
                    continue;
                };
                match message {
                    BackendMessage::Ready { port, token } => {
                        return Ok(JsSidecarReady { port, token })
                    }
                    BackendMessage::Fatal { error } => return Err(anyhow!(error)),
                }
            }
            Err(anyhow!("JS sidecar exited before reporting ready"))
        })
        .await
        .context("timed out waiting for JS sidecar readiness")??;

        Ok(Self {
            state: Arc::new(Mutex::new(Some(JsSidecarState { child, ready }))),
        })
    }

    pub async fn status(&self) -> JsSidecarStatus {
        let state = self.state.lock().await;
        JsSidecarStatus {
            running: state.is_some(),
            ready: state.as_ref().map(|state| state.ready.clone()),
        }
    }

    pub async fn shutdown(&self) {
        let mut state = self.state.lock().await;
        let Some(mut sidecar) = state.take() else {
            return;
        };

        if let Err(error) = sidecar.child.kill().await {
            warn!("failed to stop JS sidecar: {error}");
        }
    }
}

#[cfg(test)]
mod tests {
    use std::fs::{remove_file, write};

    use super::*;

    #[tokio::test]
    async fn launches_node_sidecar_and_reads_ready_message() {
        let script_path = std::env::temp_dir().join(format!(
            "neon-pilot-sidecar-ready-{}-{}.mjs",
            std::process::id(),
            chrono_like_timestamp()
        ));
        write(
            &script_path,
            r#"
console.log(JSON.stringify({ type: 'ready', port: 3741, token: process.env.NEON_PILOT_BACKEND_TOKEN }));
setTimeout(() => {}, 30_000);
"#,
        )
        .expect("write mock sidecar");

        let sidecar = JsSidecarHandle::launch(JsSidecarConfig {
            node_command: "node".to_string(),
            entry_file: script_path.clone(),
            repo_root: std::env::current_dir().expect("current dir"),
            token: "test-token".to_string(),
            env: HashMap::new(),
            ready_timeout_ms: Some(5_000),
            launch_mode: SidecarLaunchMode::LocalBackendChild,
        })
        .await
        .expect("sidecar launches");

        let status = sidecar.status().await;
        assert!(status.running);
        assert_eq!(status.ready.expect("ready").token, "test-token");
        sidecar.shutdown().await;
        let _ = remove_file(script_path);
    }

    fn chrono_like_timestamp() -> u128 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("system time")
            .as_millis()
    }
}
