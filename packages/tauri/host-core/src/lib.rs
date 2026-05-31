pub mod extension_package;
pub mod paths;
pub mod preferences;
pub mod sidecar;

pub use extension_package::{
    validate_extension_package, ExtensionPackageValidationReport, ExtensionPackageValidationStatus,
};
pub use paths::{resolve_repo_root, resolve_state_root};
pub use preferences::{
    read_tauri_app_preferences, update_tauri_app_preferences, TauriAppPreferences,
    TauriAppPreferencesPatch, TauriAppPreferencesState,
};
pub use sidecar::{
    JsSidecarConfig, JsSidecarHandle, JsSidecarReady, JsSidecarStatus, SidecarLaunchMode,
};
