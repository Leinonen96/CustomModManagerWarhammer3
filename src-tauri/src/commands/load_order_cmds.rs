use tauri::command;
use crate::domain::{AppError, AppResult, LoadOrderResult, Mod};
use crate::services::{ConfigStore, GameIntegrator};

#[command]
pub fn apply_load_order(mods: Vec<Mod>) -> AppResult<LoadOrderResult> {
    let config = ConfigStore::new().load();
    if config.game_data_dir.is_empty() {
        return Err(AppError::PathNotFound("Game Data Directory is not set in Settings".to_string()));
    }
    if config.script_file.is_empty() {
        return Err(AppError::PathNotFound("User Script File is not set in Settings".to_string()));
    }

    GameIntegrator::apply_load_order(
        &mods,
        &config.game_data_dir,
        &config.script_file,
        config.auto_backup,
    )
}
