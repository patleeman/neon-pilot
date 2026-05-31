use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::Duration;

use anyhow::Context;
use serde::{Deserialize, Serialize};
use tokio::process::Command;
use tokio::time::timeout;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HostProcessExecInput {
    pub command: String,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default)]
    pub cwd: Option<String>,
    #[serde(default)]
    pub env: HashMap<String, String>,
    #[serde(default)]
    pub timeout_ms: Option<u64>,
    #[serde(default)]
    pub max_buffer: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HostProcessExecResult {
    pub command: String,
    pub args: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cwd: Option<String>,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: Option<i32>,
    pub success: bool,
    pub execution_wrappers: Vec<ProcessWrapperMetadata>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProcessWrapperMetadata {
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
}

pub async fn exec_host_process(
    input: HostProcessExecInput,
) -> anyhow::Result<HostProcessExecResult> {
    validate_process_command(&input.command)?;
    validate_process_args(&input.args)?;
    validate_process_cwd(input.cwd.as_deref())?;
    validate_process_env(&input.env)?;
    let timeout_ms = input.timeout_ms.unwrap_or(30_000);
    let max_buffer = input.max_buffer.unwrap_or(1024 * 1024);
    let mut command = Command::new(&input.command);
    command
        .args(&input.args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if let Some(cwd) = input.cwd.as_deref() {
        command.current_dir(PathBuf::from(cwd));
    }
    if !input.env.is_empty() {
        command.envs(&input.env);
    }

    let output = timeout(Duration::from_millis(timeout_ms), command.output())
        .await
        .with_context(|| format!("command timed out after {timeout_ms}ms"))?
        .with_context(|| format!("launching {}", input.command))?;
    if output.stdout.len() + output.stderr.len() > max_buffer {
        anyhow::bail!("Command output exceeded maxBuffer of {max_buffer} bytes.");
    }
    Ok(HostProcessExecResult {
        command: input.command,
        args: input.args,
        cwd: input.cwd,
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code(),
        success: output.status.success(),
        execution_wrappers: vec![ProcessWrapperMetadata {
            id: "tauri-host-core".to_string(),
            label: Some("Tauri Rust host core".to_string()),
        }],
    })
}

pub fn validate_process_command(command: &str) -> anyhow::Result<()> {
    let trimmed = command.trim();
    if trimmed.is_empty() {
        anyhow::bail!("Process command is required.");
    }
    if trimmed.contains('\0') {
        anyhow::bail!("Process command contains an invalid NUL byte.");
    }
    Ok(())
}

pub fn validate_process_args(args: &[String]) -> anyhow::Result<()> {
    for arg in args {
        if arg.contains('\0') {
            anyhow::bail!("Process arguments must not contain NUL bytes.");
        }
    }
    Ok(())
}

pub fn validate_process_env(env: &HashMap<String, String>) -> anyhow::Result<()> {
    for (key, value) in env {
        if key.trim().is_empty() || key.contains('=') || key.contains('\0') {
            anyhow::bail!("Process environment contains an invalid key.");
        }
        if value.contains('\0') {
            anyhow::bail!("Process environment contains an invalid value.");
        }
    }
    Ok(())
}

pub fn validate_process_cwd(cwd: Option<&str>) -> anyhow::Result<()> {
    let Some(cwd) = cwd else {
        return Ok(());
    };
    if cwd.trim().is_empty() || cwd.contains('\0') {
        anyhow::bail!("Process cwd is invalid.");
    }
    let path = Path::new(cwd);
    if !path.is_absolute() {
        anyhow::bail!("Process cwd must be an absolute path.");
    }
    if !path.is_dir() {
        anyhow::bail!("Process cwd does not exist or is not a directory.");
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn execs_host_process_and_captures_output() {
        let result = exec_host_process(HostProcessExecInput {
            command: "node".to_string(),
            args: vec!["-e".to_string(), "process.stdout.write('ok')".to_string()],
            cwd: None,
            env: HashMap::new(),
            timeout_ms: Some(5_000),
            max_buffer: Some(1024),
        })
        .await
        .expect("exec");
        assert!(result.success);
        assert_eq!(result.stdout, "ok");
        assert_eq!(result.execution_wrappers[0].id, "tauri-host-core");
    }
}
