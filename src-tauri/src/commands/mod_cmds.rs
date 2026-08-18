use tauri::command;
use crate::domain::Mod;
use crate::services::{ConfigStore, WorkshopScanner};

#[command]
pub fn get_mods() -> Vec<Mod> {
    let config = ConfigStore::new().load();
    if config.workshop_dir.is_empty() {
        return Vec::new();
    }
    WorkshopScanner::scan_workshop(&config.workshop_dir)
}
