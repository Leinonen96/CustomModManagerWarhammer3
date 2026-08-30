pub mod commands;
pub mod domain;
pub mod services;

use commands::*;
use services::{ConfigStore, WorkshopWatcher};
use std::sync::Arc;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let config = ConfigStore::new().load();
            let watcher = Arc::new(WorkshopWatcher::new(app.handle().clone()));
            if !config.workshop_dir.is_empty() {
                watcher.set_watch_path(&config.workshop_dir);
            }
            app.manage(watcher);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_config,
            save_config,
            detect_paths,
            validate_paths,
            get_mods,
            list_presets,
            load_preset,
            save_preset,
            delete_preset,
            apply_load_order,
            open_url,
            open_path,
            analyze_load_order_conflicts,
            get_pack_file_tree,
            auto_sort_dependencies,
            launch_game
        ])
        .run(tauri::generate_context!())
        .expect("error while running Total War: WARHAMMER III Mod Manager");
}
