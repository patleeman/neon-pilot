use std::path::{Path, PathBuf};

use anyhow::{anyhow, Context};

pub fn resolve_repo_root(start: impl AsRef<Path>) -> anyhow::Result<PathBuf> {
    for candidate in start.as_ref().ancestors() {
        if is_repo_root(candidate) {
            return Ok(candidate.to_path_buf());
        }
    }
    Err(anyhow!(
        "Could not resolve Neon Pilot repo root from {}",
        start.as_ref().display()
    ))
}

pub fn resolve_state_root() -> anyhow::Result<PathBuf> {
    if let Ok(value) = std::env::var("NEON_PILOT_STATE_ROOT") {
        let trimmed = value.trim();
        if !trimmed.is_empty() {
            return Ok(PathBuf::from(trimmed));
        }
    }

    let data_dir = dirs::data_local_dir().context("Could not resolve local data directory")?;
    Ok(data_dir.join("neon-pilot"))
}

fn is_repo_root(path: &Path) -> bool {
    path.join("package.json").exists() && path.join("packages").exists()
}

#[cfg(test)]
mod tests {
    use std::fs::{create_dir_all, remove_dir_all, write};

    use super::*;

    #[test]
    fn resolves_repo_root_from_nested_path() {
        let root = std::env::temp_dir().join(format!("nphc-repo-{}", std::process::id()));
        let nested = root.join("packages/tauri/host-core");
        create_dir_all(&nested).expect("nested dirs");
        create_dir_all(root.join("packages")).expect("packages dir");
        write(root.join("package.json"), "{}").expect("package json");

        assert_eq!(resolve_repo_root(&nested).expect("repo root"), root);
        let _ = remove_dir_all(resolve_repo_root(&nested).expect("repo root"));
    }
}
