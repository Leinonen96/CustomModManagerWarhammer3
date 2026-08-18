use std::path::PathBuf;
use crate::domain::{ConflictAnalysisResult, Mod, PackedFileManifest};
use crate::services::{DependencyEngine, PackParser};

#[tauri::command]
pub async fn analyze_load_order_conflicts(
    active_mods: Vec<Mod>,
) -> Result<ConflictAnalysisResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        Ok(PackParser::analyze_conflicts(&active_mods))
    })
    .await
    .map_err(|e| format!("Conflict analysis thread error: {}", e))?
}

#[tauri::command]
pub async fn get_pack_file_tree(
    pack_path: String,
) -> Result<PackedFileManifest, String> {
    let path = PathBuf::from(&pack_path);
    if !path.exists() {
        return Err(format!("Pack file not found: {}", pack_path));
    }
    tauri::async_runtime::spawn_blocking(move || {
        Ok(PackParser::parse_pack_file(&path))
    })
    .await
    .map_err(|e| format!("Pack parser thread error: {}", e))?
}

#[tauri::command]
pub async fn auto_sort_dependencies(
    active_mods: Vec<Mod>,
) -> Result<Vec<Mod>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        Ok(DependencyEngine::auto_sort_dependencies(&active_mods))
    })
    .await
    .map_err(|e| format!("Auto sort thread error: {}", e))?
}
