use std::fs::read_to_string;
use std::path::{Component, Path, PathBuf};

use anyhow::Context;
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ExtensionPackageValidationStatus {
    Valid,
    Invalid,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionPackageValidationReport {
    pub status: ExtensionPackageValidationStatus,
    pub package_root: String,
    pub extension_id: Option<String>,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}

pub fn validate_extension_package(
    package_root: impl AsRef<Path>,
) -> anyhow::Result<ExtensionPackageValidationReport> {
    let package_root = package_root.as_ref();
    let mut errors = Vec::new();
    let mut warnings = Vec::new();
    let manifest_path = package_root.join("extension.json");
    let manifest = match read_to_string(&manifest_path) {
        Ok(source) => match serde_json::from_str::<Value>(&source) {
            Ok(value) => value,
            Err(error) => {
                errors.push(format!("extension.json must be valid JSON: {error}"));
                Value::Null
            }
        },
        Err(error) => {
            errors.push(format!("extension.json is required: {error}"));
            Value::Null
        }
    };

    let extension_id = manifest
        .get("id")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned);

    if manifest.get("schemaVersion").and_then(Value::as_i64) != Some(2) {
        errors.push("schemaVersion must be 2.".to_string());
    }

    match extension_id.as_deref() {
        Some(id) if is_safe_extension_id(id) => {}
        Some(_) => errors.push(
            "id must contain only lowercase letters, numbers, dots, underscores, and dashes."
                .to_string(),
        ),
        None => errors.push("id must be a non-empty string.".to_string()),
    }

    if manifest
        .get("name")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .is_none()
    {
        errors.push("name must be a non-empty string.".to_string());
    }

    validate_manifest_entry(
        package_root,
        &manifest,
        &["frontend", "entry"],
        false,
        &mut errors,
        &mut warnings,
    )
    .context("validating frontend entry")?;
    validate_manifest_entry(
        package_root,
        &manifest,
        &["backend", "entry"],
        false,
        &mut errors,
        &mut warnings,
    )
    .context("validating backend entry")?;
    if let Some(styles) = manifest
        .get("frontend")
        .and_then(|frontend| frontend.get("styles"))
        .and_then(Value::as_array)
    {
        for (index, style) in styles.iter().enumerate() {
            match style.as_str() {
                Some(value) => validate_relative_entry(
                    package_root,
                    value,
                    &format!("frontend.styles[{index}]"),
                    false,
                    &mut errors,
                    &mut warnings,
                )?,
                None => errors.push(format!("frontend.styles[{index}] must be a string.")),
            }
        }
    }

    let status = if errors.is_empty() {
        ExtensionPackageValidationStatus::Valid
    } else {
        ExtensionPackageValidationStatus::Invalid
    };
    Ok(ExtensionPackageValidationReport {
        status,
        package_root: package_root.to_string_lossy().to_string(),
        extension_id,
        errors,
        warnings,
    })
}

fn validate_manifest_entry(
    package_root: &Path,
    manifest: &Value,
    path: &[&str],
    required: bool,
    errors: &mut Vec<String>,
    warnings: &mut Vec<String>,
) -> anyhow::Result<()> {
    let value = path
        .iter()
        .try_fold(manifest, |current, key| current.get(*key));
    let label = path.join(".");
    match value.and_then(Value::as_str) {
        Some(entry) => {
            validate_relative_entry(package_root, entry, &label, required, errors, warnings)
        }
        None if required => {
            errors.push(format!("{label} must be a string."));
            Ok(())
        }
        None => Ok(()),
    }
}

fn validate_relative_entry(
    package_root: &Path,
    entry: &str,
    label: &str,
    required: bool,
    errors: &mut Vec<String>,
    warnings: &mut Vec<String>,
) -> anyhow::Result<()> {
    let trimmed = entry.trim();
    if trimmed.is_empty() {
        if required {
            errors.push(format!("{label} must be a non-empty relative path."));
        }
        return Ok(());
    }
    let relative = PathBuf::from(trimmed);
    if relative.is_absolute()
        || relative.components().any(|component| {
            matches!(
                component,
                Component::ParentDir | Component::RootDir | Component::Prefix(_)
            )
        })
    {
        errors.push(format!("{label} must stay inside the extension package."));
        return Ok(());
    }
    if !package_root.join(&relative).exists() {
        warnings.push(format!("{label} points to a missing file: {trimmed}."));
    }
    Ok(())
}

fn is_safe_extension_id(value: &str) -> bool {
    value.bytes().all(|byte| {
        byte.is_ascii_lowercase() || byte.is_ascii_digit() || matches!(byte, b'.' | b'_' | b'-')
    })
}

#[cfg(test)]
mod tests {
    use std::fs::{create_dir_all, remove_dir_all, write};

    use super::*;

    #[test]
    fn validates_minimal_extension_package() {
        let root = std::env::temp_dir().join(format!("nphc-ext-good-{}", std::process::id()));
        create_dir_all(&root).expect("extension root");
        write(
            root.join("extension.json"),
            r#"{"schemaVersion":2,"id":"sample-extension","name":"Sample"}"#,
        )
        .expect("manifest");

        let report = validate_extension_package(&root).expect("validate package");
        assert_eq!(report.status, ExtensionPackageValidationStatus::Valid);
        assert_eq!(report.extension_id.as_deref(), Some("sample-extension"));
        let _ = remove_dir_all(root);
    }

    #[test]
    fn rejects_unsafe_manifest_entries() {
        let root = std::env::temp_dir().join(format!("nphc-ext-bad-{}", std::process::id()));
        create_dir_all(&root).expect("extension root");
        write(
            root.join("extension.json"),
            r#"{"schemaVersion":2,"id":"Bad Extension","name":"Bad","frontend":{"entry":"../escape.js"}}"#,
        )
        .expect("manifest");

        let report = validate_extension_package(&root).expect("validate package");
        assert_eq!(report.status, ExtensionPackageValidationStatus::Invalid);
        assert!(report
            .errors
            .iter()
            .any(|error| error.contains("id must contain")));
        assert!(report
            .errors
            .iter()
            .any(|error| error.contains("frontend.entry must stay inside")));
        let _ = remove_dir_all(root);
    }
}
