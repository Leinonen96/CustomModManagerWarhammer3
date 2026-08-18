use tauri::command;
use crate::domain::{AppConfig, AppResult, ConfigValidationResult, PathDetectionResult};
use crate::services::{auto_detect_wh3_paths, ConfigStore};

#[command]
pub fn get_config() -> AppConfig {
    ConfigStore::new().load()
}

#[command]
pub fn save_config(config: AppConfig) -> AppResult<()> {
    ConfigStore::new().save(&config)
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
