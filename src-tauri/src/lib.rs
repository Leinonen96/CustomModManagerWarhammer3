pub mod domain;
pub mod services;
pub mod commands;

use commands::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
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
            analyze_load_order_conflicts,
            get_pack_file_tree,
            auto_sort_dependencies
        ])
        .run(tauri::generate_context!())
        .expect("error while running Total War: WARHAMMER III Mod Manager");
}
