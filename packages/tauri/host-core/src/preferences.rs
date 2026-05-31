use std::collections::BTreeMap;
use std::fs::{create_dir_all, read_to_string, write};
use std::path::{Path, PathBuf};

use anyhow::Context;
use serde::{Deserialize, Serialize};

use crate::paths::resolve_state_root;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TauriAppPreferences {
    pub auto_install_updates: bool,
    pub update_path: String,
    pub start_on_system_start: bool,
    pub keyboard_shortcuts: BTreeMap<String, String>,
    #[serde(default)]
    pub window_state: TauriWindowState,
}

impl Default for TauriAppPreferences {
    fn default() -> Self {
        Self {
            auto_install_updates: false,
            update_path: "stable".to_string(),
            start_on_system_start: false,
            keyboard_shortcuts: default_keyboard_shortcuts(),
            window_state: TauriWindowState::default(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TauriWindowState {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub x: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub y: Option<i32>,
    pub width: u32,
    pub height: u32,
}

impl Default for TauriWindowState {
    fn default() -> Self {
        Self {
            x: None,
            y: None,
            width: 1440,
            height: 960,
        }
    }
}

impl TauriWindowState {
    fn normalize(self) -> Self {
        let defaults = Self::default();
        Self {
            x: self.x,
            y: self.y,
            width: if self.width > 0 {
                self.width
            } else {
                defaults.width
            },
            height: if self.height > 0 {
                self.height
            } else {
                defaults.height
            },
        }
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TauriAppPreferencesPatch {
    pub auto_install_updates: Option<bool>,
    pub update_path: Option<String>,
    pub start_on_system_start: Option<bool>,
    pub keyboard_shortcuts: Option<BTreeMap<String, String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TauriAppUpdateState {
    pub supported: bool,
    pub current_version: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TauriAppPreferencesState {
    pub available: bool,
    pub supports_start_on_system_start: bool,
    pub auto_install_updates: bool,
    pub update_path: String,
    pub start_on_system_start: bool,
    pub keyboard_shortcuts: BTreeMap<String, String>,
    pub update: TauriAppUpdateState,
}

impl TauriAppPreferences {
    fn into_state(self, current_version: impl Into<String>) -> TauriAppPreferencesState {
        TauriAppPreferencesState {
            available: true,
            supports_start_on_system_start: false,
            auto_install_updates: self.auto_install_updates,
            update_path: self.update_path,
            start_on_system_start: self.start_on_system_start,
            keyboard_shortcuts: self.keyboard_shortcuts,
            update: TauriAppUpdateState {
                supported: false,
                current_version: current_version.into(),
                status: "idle".to_string(),
            },
        }
    }
}

pub fn read_tauri_app_preferences(
    current_version: impl Into<String>,
) -> anyhow::Result<TauriAppPreferencesState> {
    Ok(read_preferences_file(&preferences_file()?)?.into_state(current_version))
}

pub fn update_tauri_app_preferences(
    patch: TauriAppPreferencesPatch,
    current_version: impl Into<String>,
) -> anyhow::Result<TauriAppPreferencesState> {
    let path = preferences_file()?;
    let mut preferences = read_preferences_file(&path)?;
    if let Some(value) = patch.auto_install_updates {
        preferences.auto_install_updates = value;
    }
    if let Some(value) = patch.update_path {
        if value != "stable" && value != "test" {
            anyhow::bail!("updatePath must be \"stable\" or \"test\".");
        }
        preferences.update_path = value;
    }
    if let Some(value) = patch.start_on_system_start {
        preferences.start_on_system_start = value;
    }
    if let Some(value) = patch.keyboard_shortcuts {
        preferences.keyboard_shortcuts.extend(value);
    }
    write_preferences_file(&path, &preferences)?;
    Ok(preferences.into_state(current_version))
}

pub fn read_tauri_window_state() -> anyhow::Result<TauriWindowState> {
    Ok(read_preferences_file(&preferences_file()?)?.window_state)
}

pub fn update_tauri_window_state(
    window_state: TauriWindowState,
) -> anyhow::Result<TauriWindowState> {
    let path = preferences_file()?;
    let mut preferences = read_preferences_file(&path)?;
    preferences.window_state = window_state.normalize();
    write_preferences_file(&path, &preferences)?;
    Ok(preferences.window_state)
}

fn preferences_file() -> anyhow::Result<PathBuf> {
    Ok(resolve_state_root()?
        .join("desktop")
        .join("tauri-config.json"))
}

fn read_preferences_file(path: &Path) -> anyhow::Result<TauriAppPreferences> {
    if !path.exists() {
        return Ok(TauriAppPreferences::default());
    }
    let source = read_to_string(path).with_context(|| format!("reading {}", path.display()))?;
    Ok(serde_json::from_str(&source).with_context(|| format!("parsing {}", path.display()))?)
}

fn write_preferences_file(path: &Path, preferences: &TauriAppPreferences) -> anyhow::Result<()> {
    if let Some(parent) = path.parent() {
        create_dir_all(parent).with_context(|| format!("creating {}", parent.display()))?;
    }
    write(
        path,
        serde_json::to_vec_pretty(preferences).context("serializing Tauri app preferences")?,
    )
    .with_context(|| format!("writing {}", path.display()))
}

fn default_keyboard_shortcuts() -> BTreeMap<String, String> {
    BTreeMap::from([
        ("showApp".to_string(), "".to_string()),
        ("newConversation".to_string(), "Meta+N".to_string()),
        ("closeTab".to_string(), "Meta+W".to_string()),
        ("reopenClosedTab".to_string(), "Meta+Shift+T".to_string()),
        (
            "previousConversation".to_string(),
            "Meta+Shift+[".to_string(),
        ),
        ("nextConversation".to_string(), "Meta+Shift+]".to_string()),
        ("togglePinned".to_string(), "".to_string()),
        ("archiveRestoreConversation".to_string(), "".to_string()),
        ("renameConversation".to_string(), "".to_string()),
        ("focusComposer".to_string(), "Meta+L".to_string()),
        ("editWorkingDirectory".to_string(), "".to_string()),
        ("findOnPage".to_string(), "Meta+F".to_string()),
        ("settings".to_string(), "Meta+,".to_string()),
        ("quit".to_string(), "Meta+Q".to_string()),
        ("conversationMode".to_string(), "F1".to_string()),
        ("workbenchMode".to_string(), "F2".to_string()),
        ("toggleSidebar".to_string(), "Meta+/".to_string()),
        ("toggleRightRail".to_string(), "Meta+\\".to_string()),
    ])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_preferences_include_required_shortcuts() {
        let preferences = TauriAppPreferences::default();
        assert_eq!(preferences.update_path, "stable");
        assert_eq!(
            preferences.window_state,
            TauriWindowState {
                x: None,
                y: None,
                width: 1440,
                height: 960
            }
        );
        assert!(preferences
            .keyboard_shortcuts
            .contains_key("newConversation"));
        assert!(preferences
            .keyboard_shortcuts
            .contains_key("toggleRightRail"));
    }

    #[test]
    fn parses_existing_preferences_without_window_state() {
        let source = r#"{
          "autoInstallUpdates": true,
          "updatePath": "test",
          "startOnSystemStart": false,
          "keyboardShortcuts": {}
        }"#;

        let preferences: TauriAppPreferences = serde_json::from_str(source).expect("preferences");
        assert_eq!(preferences.window_state, TauriWindowState::default());
    }

    #[test]
    fn normalizes_invalid_window_state_size() {
        let state = TauriWindowState {
            x: Some(20),
            y: Some(40),
            width: 0,
            height: 0,
        }
        .normalize();

        assert_eq!(
            state,
            TauriWindowState {
                x: Some(20),
                y: Some(40),
                width: 1440,
                height: 960,
            }
        );
    }
}
