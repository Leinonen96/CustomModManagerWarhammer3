use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PackType {
    Movie,    // Pack type 0: auto-loaded by game engine regardless of user.script.txt
    Boot,     // Pack type 1
    Release,  // Pack type 2: CA base game pack
    Mod,      // Pack type 3: standard user mod
    Unknown(u32),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ConflictSeverity {
    FatalStartpos,  // Hard campaign crash / incompatible startpos.esf
    ScriptOverride, // Overwriting Lua scripts (Top in load order wins)
    UIOverride,     // Overwriting TWUI XML layouts
    DBCollision,    // Identical table file collision (data__)
    HarmlessMerge,  // Unique table name in same folder
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackedFileManifest {
    pub pack_name: String,
    pub pack_path: String,
    pub pack_type: PackType,
    pub dependencies: Vec<String>,
    pub files: Vec<String>, // e.g. "db/units_custom_tables/data__"
    pub file_count: usize,
    pub is_valid_pack: bool,
    #[serde(default)]
    pub pfh_version: String, // e.g. "PFH5"
    #[serde(default)]
    pub header_bitmask_hex: String, // e.g. "0x00000003"
    #[serde(default)]
    pub sha256_hash: String, // Hex string for multiplayer sync
    #[serde(default)]
    pub last_modified_str: String, // e.g. "2026-08-10"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileConflictDetail {
    pub internal_path: String,
    pub severity: ConflictSeverity,
    pub winner_mod: String,       // Higher in load order (or Movie pack)
    pub winner_index: usize,      // 1-based index
    pub loser_mod: String,        // Lower in load order
    pub loser_index: usize,       // 1-based index
    pub is_identical_db_table: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ModConflictSummary {
    pub mod_name: String,
    pub mod_id: String,
    pub total_conflicts: usize,
    pub fatal_startpos_count: usize,
    pub script_overrides_won: usize,
    pub script_overrides_lost: usize,
    pub ui_overrides_won: usize,
    pub ui_overrides_lost: usize,
    pub db_collisions: usize,
    pub conflicting_mod_names: Vec<String>,
    pub is_movie_pack: bool,
    pub missing_dependencies: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConflictAnalysisResult {
    pub total_conflicts: usize,
    pub fatal_conflicts: usize,
    pub summaries: HashMap<String, ModConflictSummary>, // keyed by mod_name or mod_id
    pub detailed_conflicts: Vec<FileConflictDetail>,
}
