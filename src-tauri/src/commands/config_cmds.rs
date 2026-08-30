use crate::domain::{AppConfig, AppResult, ConfigValidationResult, PathDetectionResult};
use crate::services::{auto_detect_wh3_paths, ConfigStore, WorkshopWatcher};
use std::sync::Arc;
use tauri::{command, State};

#[command]
pub fn get_config() -> AppConfig {
    ConfigStore::new().load()
}

#[command]
pub fn save_config(
    config: AppConfig,
    watcher_state: State<'_, Arc<WorkshopWatcher>>,
) -> AppResult<()> {
    ConfigStore::new().save(&config)?;
    watcher_state.set_watch_path(&config.workshop_dir);
    Ok(())
}

#[command]
pub fn detect_paths() -> PathDetectionResult {
    auto_detect_wh3_paths()
}

#[command]
pub fn validate_paths() -> ConfigValidationResult {
    let store = ConfigStore::new();
    let config = store.load();
    store.validate(&config)
}
