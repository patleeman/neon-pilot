use std::fs::{
    create_dir_all, read_dir, read_to_string, remove_dir_all, remove_file, rename, write,
};
use std::path::{Component, Path, PathBuf};

use anyhow::{anyhow, Context};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ScopedPath {
    pub root: String,
    pub relative_path: String,
    pub absolute_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub len: u64,
}

pub fn scoped_path(
    root: impl AsRef<Path>,
    relative_path: impl AsRef<Path>,
) -> anyhow::Result<ScopedPath> {
    let root = root.as_ref();
    let root = if root.exists() {
        root.canonicalize()
            .with_context(|| format!("canonicalizing root {}", root.display()))?
    } else {
        root.to_path_buf()
    };
    if !root.is_absolute() {
        anyhow::bail!(
            "Scoped filesystem root must be absolute: {}",
            root.display()
        );
    }

    let relative_path = normalize_relative_path(relative_path.as_ref())?;
    let absolute_path = root.join(&relative_path);
    if let Some(parent) = absolute_path.parent() {
        if parent.exists() {
            let canonical_parent = parent
                .canonicalize()
                .with_context(|| format!("canonicalizing parent {}", parent.display()))?;
            if !canonical_parent.starts_with(&root) {
                anyhow::bail!("Path escapes scoped root: {}", relative_path.display());
            }
        }
    }

    Ok(ScopedPath {
        root: root.to_string_lossy().to_string(),
        relative_path: relative_path.to_string_lossy().to_string(),
        absolute_path: absolute_path.to_string_lossy().to_string(),
    })
}

pub fn read_scoped_text(
    root: impl AsRef<Path>,
    relative_path: impl AsRef<Path>,
) -> anyhow::Result<String> {
    let path = scoped_path(root, relative_path)?;
    reject_symlink(&path.absolute_path)?;
    read_to_string(&path.absolute_path).with_context(|| format!("reading {}", path.absolute_path))
}

pub fn write_scoped_text(
    root: impl AsRef<Path>,
    relative_path: impl AsRef<Path>,
    text: &str,
) -> anyhow::Result<ScopedPath> {
    let path = scoped_path(root, relative_path)?;
    if let Some(parent) = Path::new(&path.absolute_path).parent() {
        create_dir_all(parent).with_context(|| format!("creating {}", parent.display()))?;
    }
    reject_symlink(&path.absolute_path)?;
    let temp_path = format!("{}.tmp-{}", path.absolute_path, std::process::id());
    write(&temp_path, text).with_context(|| format!("writing {}", temp_path))?;
    rename(&temp_path, &path.absolute_path)
        .with_context(|| format!("renaming {} to {}", temp_path, path.absolute_path))?;
    Ok(path)
}

pub fn list_scoped_dir(
    root: impl AsRef<Path>,
    relative_path: impl AsRef<Path>,
) -> anyhow::Result<Vec<FileEntry>> {
    let path = scoped_path(root, relative_path)?;
    reject_symlink(&path.absolute_path)?;
    let mut entries = Vec::new();
    for entry in
        read_dir(&path.absolute_path).with_context(|| format!("listing {}", path.absolute_path))?
    {
        let entry = entry?;
        let metadata = entry.metadata()?;
        entries.push(FileEntry {
            name: entry.file_name().to_string_lossy().to_string(),
            path: entry.path().to_string_lossy().to_string(),
            is_dir: metadata.is_dir(),
            len: metadata.len(),
        });
    }
    entries.sort_by(|left, right| left.name.cmp(&right.name));
    Ok(entries)
}

pub fn remove_scoped_path(
    root: impl AsRef<Path>,
    relative_path: impl AsRef<Path>,
) -> anyhow::Result<ScopedPath> {
    let path = scoped_path(root, relative_path)?;
    reject_symlink(&path.absolute_path)?;
    let absolute = Path::new(&path.absolute_path);
    if absolute.is_dir() {
        remove_dir_all(absolute)
            .with_context(|| format!("removing directory {}", absolute.display()))?;
    } else {
        remove_file(absolute).with_context(|| format!("removing file {}", absolute.display()))?;
    }
    Ok(path)
}

fn normalize_relative_path(path: &Path) -> anyhow::Result<PathBuf> {
    if path.as_os_str().is_empty() {
        return Ok(PathBuf::new());
    }
    let mut normalized = PathBuf::new();
    for component in path.components() {
        match component {
            Component::Normal(part) => normalized.push(part),
            Component::CurDir => {}
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
                return Err(anyhow!(
                    "Relative path must stay inside the scoped root: {}",
                    path.display()
                ));
            }
        }
    }
    Ok(normalized)
}

fn reject_symlink(path: impl AsRef<Path>) -> anyhow::Result<()> {
    match std::fs::symlink_metadata(path.as_ref()) {
        Ok(metadata) if metadata.file_type().is_symlink() => {
            anyhow::bail!("Symlinks are rejected by the scoped filesystem boundary.")
        }
        Ok(_) | Err(_) => Ok(()),
    }
}

#[cfg(test)]
mod tests {
    use std::fs::{create_dir_all, remove_dir_all};

    use super::*;

    #[test]
    fn writes_reads_and_rejects_escaping_paths() {
        let root = std::env::temp_dir().join(format!("nphc-fs-{}", std::process::id()));
        create_dir_all(&root).expect("root");

        write_scoped_text(&root, "notes/today.md", "hello").expect("write");
        assert_eq!(
            read_scoped_text(&root, "notes/today.md").expect("read"),
            "hello"
        );
        assert!(scoped_path(&root, "../escape").is_err());

        let _ = remove_dir_all(root);
    }
}
