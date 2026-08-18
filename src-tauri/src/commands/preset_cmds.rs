use tauri::command;
use crate::domain::{AppResult, Mod, PresetDetails};
use crate::services::{ConfigStore, PresetRepository, WorkshopScanner};

#[command]
pub fn list_presets() -> Vec<String> {
    PresetRepository::new().list_presets()
}

#[command]
pub fn load_preset(name: String) -> AppResult<PresetDetails> {
    let config = ConfigStore::new().load();
    let available_mods = if !config.workshop_dir.is_empty() {
        WorkshopScanner::scan_workshop(&config.workshop_dir)
    } else {
        Vec::new()
    };

    PresetRepository::new().load_preset(&name, &available_mods)
}

#[command]
pub fn save_preset(name: String, mods: Vec<Mod>) -> AppResult<()> {
    PresetRepository::new().save_preset(&name, &mods)
}

#[command]
pub fn delete_preset(name: String) -> AppResult<bool> {
    PresetRepository::new().delete_preset(&name)
}
