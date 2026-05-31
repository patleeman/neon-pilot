pub mod extension_install;
pub mod extension_package;
pub mod filesystem;
pub mod host_rpc;
pub mod paths;
pub mod preferences;
pub mod process;
pub mod secrets;
pub mod sidecar;
pub mod sqlite;

pub use extension_install::{
    import_extension_bundle, install_extension_package, InstalledExtensionPackage,
};
pub use extension_package::{
    validate_extension_package, ExtensionPackageValidationReport, ExtensionPackageValidationStatus,
};
pub use filesystem::{
    list_scoped_dir, read_scoped_text, remove_scoped_path, scoped_path, write_scoped_text,
    FileEntry, ScopedPath,
};
pub use host_rpc::{start_host_core_rpc_server, HostCoreRpcServer};
pub use paths::{resolve_repo_root, resolve_state_root};
pub use preferences::{
    read_tauri_app_preferences, update_tauri_app_preferences, TauriAppPreferences,
    TauriAppPreferencesPatch, TauriAppPreferencesState,
};
pub use process::{exec_host_process, HostProcessExecInput, HostProcessExecResult};
pub use secrets::{
    delete_file_secret, get_file_secret, list_file_secret_keys, set_file_secret, FileSecretStatus,
};
pub use sidecar::{
    JsSidecarConfig, JsSidecarHandle, JsSidecarReady, JsSidecarStatus, SidecarLaunchMode,
};
pub use sqlite::{apply_sqlite_migrations, read_user_version, SqliteMigration};
