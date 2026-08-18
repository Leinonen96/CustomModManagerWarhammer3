use std::path::Path;
use crate::domain::{ConflictAnalysisResult, Mod, PackedFileManifest};
use crate::services::{DependencyEngine, PackParser};

#[tauri::command]
pub fn analyze_load_order_conflicts(
    active_mods: Vec<Mod>,
) -> Result<ConflictAnalysisResult, String> {
    Ok(PackParser::analyze_conflicts(&active_mods))
}

#[tauri::command]
pub fn get_pack_file_tree(
    pack_path: String,
) -> Result<PackedFileManifest, String> {
    let path = Path::new(&pack_path);
    if !path.exists() {
        return Err(format!("Pack file not found: {}", pack_path));
    }
    Ok(PackParser::parse_pack_file(path))
}

#[tauri::command]
pub fn auto_sort_dependencies(
    active_mods: Vec<Mod>,
) -> Result<Vec<Mod>, String> {
    Ok(DependencyEngine::auto_sort_dependencies(&active_mods))
}
