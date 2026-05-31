use std::collections::BTreeMap;
use std::fs::{create_dir_all, read_to_string, remove_file, write};
use std::path::{Path, PathBuf};

use anyhow::Context;
use serde::{Deserialize, Serialize};

use crate::paths::resolve_state_root;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FileSecretStatus {
    pub key: String,
    pub configured: bool,
    pub writable: bool,
}

pub fn get_file_secret(key: &str) -> anyhow::Result<Option<String>> {
    get_file_secret_at(resolve_state_root()?, key)
}

pub fn set_file_secret(key: &str, value: &str) -> anyhow::Result<FileSecretStatus> {
    set_file_secret_at(resolve_state_root()?, key, value)
}

pub fn delete_file_secret(key: &str) -> anyhow::Result<FileSecretStatus> {
    delete_file_secret_at(resolve_state_root()?, key)
}

pub fn list_file_secret_keys() -> anyhow::Result<Vec<String>> {
    list_file_secret_keys_at(resolve_state_root()?)
}

fn get_file_secret_at(state_root: impl AsRef<Path>, key: &str) -> anyhow::Result<Option<String>> {
    validate_key(key)?;
    Ok(read_file_secrets(state_root.as_ref())?.get(key).cloned())
}

fn set_file_secret_at(
    state_root: impl AsRef<Path>,
    key: &str,
    value: &str,
) -> anyhow::Result<FileSecretStatus> {
    validate_key(key)?;
    let state_root = state_root.as_ref();
    let mut secrets = read_file_secrets(state_root)?;
    secrets.insert(key.to_string(), value.to_string());
    write_file_secrets(state_root, &secrets)?;
    Ok(FileSecretStatus {
        key: key.to_string(),
        configured: true,
        writable: true,
    })
}

fn delete_file_secret_at(
    state_root: impl AsRef<Path>,
    key: &str,
) -> anyhow::Result<FileSecretStatus> {
    validate_key(key)?;
    let state_root = state_root.as_ref();
    let mut secrets = read_file_secrets(state_root)?;
    secrets.remove(key);
    write_file_secrets(state_root, &secrets)?;
    Ok(FileSecretStatus {
        key: key.to_string(),
        configured: false,
        writable: true,
    })
}

fn list_file_secret_keys_at(state_root: impl AsRef<Path>) -> anyhow::Result<Vec<String>> {
    Ok(read_file_secrets(state_root.as_ref())?
        .keys()
        .cloned()
        .collect())
}

fn read_file_secrets(state_root: &Path) -> anyhow::Result<BTreeMap<String, String>> {
    let path = secrets_file(state_root);
    if !path.exists() {
        return Ok(BTreeMap::new());
    }
    let source = read_to_string(&path).with_context(|| format!("reading {}", path.display()))?;
    let parsed = serde_json::from_str::<BTreeMap<String, String>>(&source)
        .with_context(|| format!("parsing {}", path.display()))?;
    Ok(parsed)
}

fn write_file_secrets(state_root: &Path, secrets: &BTreeMap<String, String>) -> anyhow::Result<()> {
    let path = secrets_file(state_root);
    if secrets.is_empty() {
        if path.exists() {
            remove_file(&path).with_context(|| format!("removing {}", path.display()))?;
        }
        return Ok(());
    }
    if let Some(parent) = path.parent() {
        create_dir_all(parent).with_context(|| format!("creating {}", parent.display()))?;
    }
    write(&path, serde_json::to_vec_pretty(secrets)?)
        .with_context(|| format!("writing {}", path.display()))
}

fn secrets_file(state_root: &Path) -> PathBuf {
    state_root.join("secrets.json")
}

fn validate_key(key: &str) -> anyhow::Result<()> {
    if key.trim().is_empty() {
        anyhow::bail!("Secret key is required.");
    }
    if key.contains('/') || key.contains('\\') || key.contains('\0') {
        anyhow::bail!("Secret key contains invalid path characters.");
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use std::fs::remove_dir_all;

    use super::*;

    #[test]
    fn stores_lists_and_deletes_file_secrets() {
        let root = std::env::temp_dir().join(format!("nphc-secret-{}", std::process::id()));
        set_file_secret_at(&root, "provider:test:apiKey", "secret").expect("set");
        assert_eq!(
            get_file_secret_at(&root, "provider:test:apiKey")
                .expect("get")
                .as_deref(),
            Some("secret")
        );
        assert_eq!(
            list_file_secret_keys_at(&root).expect("list"),
            vec!["provider:test:apiKey".to_string()]
        );
        delete_file_secret_at(&root, "provider:test:apiKey").expect("delete");
        assert!(get_file_secret_at(&root, "provider:test:apiKey")
            .expect("get")
            .is_none());
        let _ = remove_dir_all(root);
    }
}
