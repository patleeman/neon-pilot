use std::fs::{create_dir_all, remove_dir_all, rename};
use std::path::Path;

use anyhow::Context;
use serde::{Deserialize, Serialize};
use walkdir::WalkDir;

use crate::extension_package::{validate_extension_package, ExtensionPackageValidationStatus};
use crate::paths::resolve_state_root;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct InstalledExtensionPackage {
    pub extension_id: String,
    pub package_root: String,
    pub replaced_existing: bool,
}

pub fn install_extension_package(
    source_root: impl AsRef<Path>,
) -> anyhow::Result<InstalledExtensionPackage> {
    install_extension_package_at(resolve_state_root()?, source_root)
}

fn install_extension_package_at(
    state_root: impl AsRef<Path>,
    source_root: impl AsRef<Path>,
) -> anyhow::Result<InstalledExtensionPackage> {
    let source_root = source_root.as_ref();
    let report = validate_extension_package(source_root)?;
    if report.status != ExtensionPackageValidationStatus::Valid {
        anyhow::bail!("Extension package is invalid: {}", report.errors.join("; "));
    }
    let extension_id = report
        .extension_id
        .context("validated extension package is missing id")?;
    let extensions_root = state_root.as_ref().join("extensions");
    create_dir_all(&extensions_root)
        .with_context(|| format!("creating {}", extensions_root.display()))?;
    let destination = extensions_root.join(&extension_id);
    let temp_destination =
        extensions_root.join(format!(".dist.tmp-{extension_id}-{}", std::process::id()));
    let backup_destination = extensions_root.join(format!(
        ".dist.backup-{extension_id}-{}",
        std::process::id()
    ));
    let replaced_existing = destination.exists();

    remove_dir_if_exists(&temp_destination)?;
    remove_dir_if_exists(&backup_destination)?;
    copy_extension_tree(source_root, &temp_destination)?;

    if replaced_existing {
        rename(&destination, &backup_destination).with_context(|| {
            format!(
                "moving existing extension {} to {}",
                destination.display(),
                backup_destination.display()
            )
        })?;
    }

    if let Err(error) = rename(&temp_destination, &destination) {
        if replaced_existing {
            let _ = rename(&backup_destination, &destination);
        }
        return Err(error).with_context(|| {
            format!(
                "moving staged extension {} to {}",
                temp_destination.display(),
                destination.display()
            )
        });
    }

    remove_dir_if_exists(&backup_destination)?;
    Ok(InstalledExtensionPackage {
        extension_id,
        package_root: destination.to_string_lossy().to_string(),
        replaced_existing,
    })
}

fn copy_extension_tree(source_root: &Path, destination: &Path) -> anyhow::Result<()> {
    create_dir_all(destination).with_context(|| format!("creating {}", destination.display()))?;
    for entry in WalkDir::new(source_root).follow_links(false) {
        let entry = entry?;
        let path = entry.path();
        let relative = path.strip_prefix(source_root)?;
        if relative.as_os_str().is_empty() || should_skip(relative) {
            continue;
        }
        let target = destination.join(relative);
        if entry.file_type().is_dir() {
            create_dir_all(&target).with_context(|| format!("creating {}", target.display()))?;
        } else if entry.file_type().is_file() {
            if let Some(parent) = target.parent() {
                create_dir_all(parent).with_context(|| format!("creating {}", parent.display()))?;
            }
            std::fs::copy(path, &target)
                .with_context(|| format!("copying {} to {}", path.display(), target.display()))?;
        }
    }
    Ok(())
}

fn remove_dir_if_exists(path: &Path) -> anyhow::Result<()> {
    if path.exists() {
        remove_dir_all(path).with_context(|| format!("removing {}", path.display()))?;
    }
    Ok(())
}

fn should_skip(relative: &Path) -> bool {
    relative.components().any(|component| {
        let value = component.as_os_str().to_string_lossy();
        value == "node_modules"
            || value == "target"
            || value.starts_with(".dist.tmp-")
            || value.starts_with(".dist.backup-")
    })
}

#[cfg(test)]
mod tests {
    use std::fs::{create_dir_all, read_to_string, remove_dir_all, write};

    use super::*;

    #[test]
    fn installs_valid_extension_package() {
        let root = std::env::temp_dir().join(format!("nphc-install-src-{}", std::process::id()));
        let state = std::env::temp_dir().join(format!("nphc-install-state-{}", std::process::id()));
        create_dir_all(root.join("dist")).expect("dist");
        write(root.join("extension.json"), r#"{"schemaVersion":2,"id":"sample","name":"Sample","frontend":{"entry":"dist/frontend.js"}}"#)
            .expect("manifest");
        write(root.join("dist/frontend.js"), "export default {};").expect("frontend");

        let installed = install_extension_package_at(&state, &root).expect("install");
        assert_eq!(installed.extension_id, "sample");
        assert_eq!(
            read_to_string(state.join("extensions/sample/dist/frontend.js"))
                .expect("installed file"),
            "export default {};"
        );
        write(
            root.join("dist/frontend.js"),
            "export default { updated: true };",
        )
        .expect("updated frontend");
        let replaced = install_extension_package_at(&state, &root).expect("replace");
        assert!(replaced.replaced_existing);
        assert_eq!(
            read_to_string(state.join("extensions/sample/dist/frontend.js"))
                .expect("replaced file"),
            "export default { updated: true };"
        );

        let _ = remove_dir_all(root);
        let _ = remove_dir_all(state);
    }
}
