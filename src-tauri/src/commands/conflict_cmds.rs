use crate::domain::{ConflictAnalysisResult, Mod, PackedFileManifest, UserOverrideRule};
use crate::services::{DependencyEngine, PackParser};
use std::collections::HashMap;
use std::path::PathBuf;

#[tauri::command]
pub async fn analyze_load_order_conflicts(
    active_mods: Vec<Mod>,
) -> Result<ConflictAnalysisResult, String> {
    tauri::async_runtime::spawn_blocking(move || Ok(PackParser::analyze_conflicts(&active_mods)))
        .await
        .map_err(|e| format!("Conflict analysis thread error: {}", e))?
}

#[tauri::command]
pub async fn get_pack_file_tree(pack_path: String) -> Result<PackedFileManifest, String> {
    let path = PathBuf::from(&pack_path);
    if !path.exists() {
        return Err(format!("Pack file not found: {}", pack_path));
    }
    tauri::async_runtime::spawn_blocking(move || Ok(PackParser::parse_pack_file(&path)))
        .await
        .map_err(|e| format!("Pack parser thread error: {}", e))?
}

#[tauri::command]
pub async fn auto_sort_dependencies(
    active_mods: Vec<Mod>,
    pinned_mods: Option<HashMap<String, usize>>,
    user_rules: Option<Vec<UserOverrideRule>>,
) -> Result<Vec<Mod>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let pinned = pinned_mods.unwrap_or_default();
        let rules = user_rules.unwrap_or_default();
        Ok(DependencyEngine::auto_sort_dependencies_with_rules(
            &active_mods,
            &pinned,
            &rules,
        ))
    })
    .await
    .map_err(|e| format!("Auto sort thread error: {}", e))?
}
