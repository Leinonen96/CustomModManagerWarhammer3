use std::collections::HashMap;
use std::fs::File;
use std::io::{BufReader, Read};
use std::path::Path;
use crate::domain::{
    ConflictAnalysisResult, ConflictSeverity, FileConflictDetail, Mod, ModConflictSummary,
    PackType, PackedFileManifest,
};

pub struct PackParser;

impl PackParser {
    /// Fast zero-copy index parser for Total War Warhammer PFH5/PFH4/PFH3 packfiles.
    pub fn parse_pack_file(pack_path: &Path) -> PackedFileManifest {
        let pack_name = pack_path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        let mut manifest = PackedFileManifest {
            pack_name: pack_name.clone(),
            pack_path: pack_path.to_string_lossy().to_string(),
            pack_type: PackType::Mod,
            dependencies: Vec::new(),
            files: Vec::new(),
            file_count: 0,
            is_valid_pack: false,
        };

        let file = match File::open(pack_path) {
            Ok(f) => f,
            Err(_) => return manifest,
        };

        let mut reader = BufReader::with_capacity(64 * 1024, file);

        // 1. Read PFH Header (minimum 24 bytes)
        let mut magic = [0u8; 4];
        if reader.read_exact(&mut magic).is_err() {
            return manifest;
        }

        let is_pfh5 = &magic == b"PFH5";
        let is_pfh4 = &magic == b"PFH4";
        let is_pfh3 = &magic == b"PFH3";
        let is_pfh2 = &magic == b"PFH2";

        if !is_pfh5 && !is_pfh4 && !is_pfh3 && !is_pfh2 {
            return manifest;
        }

        let mut header_buf = [0u8; 20];
        if reader.read_exact(&mut header_buf).is_err() {
            return manifest;
        }

        let pack_type_val = u32::from_le_bytes(header_buf[0..4].try_into().unwrap_or_default());
        let dep_count = u32::from_le_bytes(header_buf[4..8].try_into().unwrap_or_default()) as usize;
        let _index_size = u32::from_le_bytes(header_buf[8..12].try_into().unwrap_or_default()) as usize;
        let file_count = u32::from_le_bytes(header_buf[16..20].try_into().unwrap_or_default()) as usize;

        manifest.pack_type = match pack_type_val & 0xF {
            0 => PackType::Movie,
            1 => PackType::Boot,
            2 => PackType::Release,
            3 => PackType::Mod,
            other => PackType::Unknown(other),
        };

        manifest.file_count = file_count;

        // Skip extended header bytes for PFH5 (often 4 or 8 extra header bytes)
        if is_pfh5 {
            let mut extra = [0u8; 4];
            let _ = reader.read_exact(&mut extra);
        }

        // 2. Read Dependency List Table
        for _ in 0..dep_count {
            if let Ok(dep_str) = Self::read_null_terminated_string(&mut reader) {
                if !dep_str.is_empty() {
                    manifest.dependencies.push(dep_str);
                }
            } else {
                break;
            }
        }

        // 3. Read Packed Files Manifest Index
        // To remain ultra fast, we parse only the paths without loading data payloads
        let mut files = Vec::with_capacity(file_count.min(50_000));
        for _ in 0..file_count {
            // File size uncompressed (4 bytes)
            let mut size_buf = [0u8; 4];
            if reader.read_exact(&mut size_buf).is_err() {
                break;
            }

            // If compressed or PFH5 flag bit set, skip compressed size (4 bytes) + flag (1 byte)
            if is_pfh5 {
                let mut flag_buf = [0u8; 1];
                if reader.read_exact(&mut flag_buf).is_err() {
                    break;
                }
                // If is_compressed flag (bit 0), read compressed size
                if flag_buf[0] & 1 != 0 {
                    let mut comp_buf = [0u8; 4];
                    if reader.read_exact(&mut comp_buf).is_err() {
                        break;
                    }
                }
            } else if is_pfh4 {
                let mut flag_buf = [0u8; 1];
                if reader.read_exact(&mut flag_buf).is_err() {
                    break;
                }
            }

            // Null-terminated path string
            match Self::read_null_terminated_string(&mut reader) {
                Ok(path_str) => {
                    let normalized = path_str.replace('\\', "/").trim().to_lowercase();
                    if !normalized.is_empty() {
                        files.push(normalized);
                    }
                }
                Err(_) => break,
            }
        }

        manifest.files = files;
        manifest.is_valid_pack = true;
        manifest
    }

    fn read_null_terminated_string<R: Read>(reader: &mut R) -> std::io::Result<String> {
        let mut bytes = Vec::with_capacity(64);
        let mut buf = [0u8; 1];
        loop {
            reader.read_exact(&mut buf)?;
            if buf[0] == 0 {
                break;
            }
            bytes.push(buf[0]);
            if bytes.len() > 1024 {
                // Safety limit for malformed strings
                break;
            }
        }
        Ok(String::from_utf8_lossy(&bytes).to_string())
    }

    /// High-performance conflict matrix analysis across all active mods.
    pub fn analyze_conflicts(active_mods: &[Mod]) -> ConflictAnalysisResult {
        // Map: normalized_internal_path -> Vec<(load_order_index, mod_name, mod_id, is_movie)>
        let mut file_map: HashMap<String, Vec<(usize, String, String, bool)>> = HashMap::new();
        let mut manifests: HashMap<String, PackedFileManifest> = HashMap::new();
        let mut summaries: HashMap<String, ModConflictSummary> = HashMap::new();

        // 1. Parse all active pack files
        for (i, m) in active_mods.iter().enumerate() {
            let load_order_index = i + 1; // 1-based index
            let path = Path::new(&m.real_path);

            let manifest = if path.is_file() {
                Self::parse_pack_file(path)
            } else {
                PackedFileManifest {
                    pack_name: m.name.clone(),
                    pack_path: m.real_path.clone(),
                    pack_type: PackType::Mod,
                    dependencies: Vec::new(),
                    files: Vec::new(),
                    file_count: 0,
                    is_valid_pack: false,
                }
            };

            let is_movie = manifest.pack_type == PackType::Movie;

            // Initialize summary for this mod
            summaries.insert(
                m.name.clone(),
                ModConflictSummary {
                    mod_name: m.name.clone(),
                    mod_id: m.id.clone(),
                    is_movie_pack: is_movie,
                    ..Default::default()
                },
            );

            for file in &manifest.files {
                file_map
                    .entry(file.clone())
                    .or_default()
                    .push((load_order_index, m.name.clone(), m.id.clone(), is_movie));
            }

            manifests.insert(m.name.clone(), manifest);
        }

        let mut detailed_conflicts = Vec::new();
        let mut total_conflicts = 0;
        let mut fatal_conflicts = 0;

        // 2. Classify conflicts across all overlapping file paths
        for (internal_path, occurrences) in file_map {
            if occurrences.len() <= 1 {
                continue;
            }

            // Determine winner: Top-most in load order (lowest index), or Movie pack
            let movie_winner = occurrences.iter().find(|o| o.3);
            let (winner_idx, winner_name, _winner_id, _) = movie_winner.unwrap_or(&occurrences[0]);

            let is_startpos = internal_path.contains("startpos.esf");
            let is_script = internal_path.starts_with("script/") && internal_path.ends_with(".lua");
            let is_ui = internal_path.starts_with("ui/")
                && (internal_path.ends_with(".twui.xml")
                    || internal_path.ends_with(".layout")
                    || internal_path.ends_with(".skin"));
            let is_db = internal_path.starts_with("db/");

            let severity = if is_startpos {
                ConflictSeverity::FatalStartpos
            } else if is_script {
                ConflictSeverity::ScriptOverride
            } else if is_ui {
                ConflictSeverity::UIOverride
            } else if is_db {
                ConflictSeverity::DBCollision
            } else {
                ConflictSeverity::HarmlessMerge
            };

            // For every other mod that shares this file, record the collision
            for (idx, name, _id, _) in &occurrences {
                if name == winner_name {
                    continue;
                }

                total_conflicts += 1;
                if is_startpos {
                    fatal_conflicts += 1;
                }

                detailed_conflicts.push(FileConflictDetail {
                    internal_path: internal_path.clone(),
                    severity,
                    winner_mod: winner_name.clone(),
                    winner_index: *winner_idx,
                    loser_mod: name.clone(),
                    loser_index: *idx,
                    is_identical_db_table: is_db,
                });

                // Update summary for winner
                if let Some(w_sum) = summaries.get_mut(winner_name) {
                    w_sum.total_conflicts += 1;
                    if is_startpos {
                        w_sum.fatal_startpos_count += 1;
                    } else if is_script {
                        w_sum.script_overrides_won += 1;
                    } else if is_ui {
                        w_sum.ui_overrides_won += 1;
                    } else if is_db {
                        w_sum.db_collisions += 1;
                    }
                    if !w_sum.conflicting_mod_names.contains(name) {
                        w_sum.conflicting_mod_names.push(name.clone());
                    }
                }

                // Update summary for loser
                if let Some(l_sum) = summaries.get_mut(name) {
                    l_sum.total_conflicts += 1;
                    if is_startpos {
                        l_sum.fatal_startpos_count += 1;
                    } else if is_script {
                        l_sum.script_overrides_lost += 1;
                    } else if is_ui {
                        l_sum.ui_overrides_lost += 1;
                    } else if is_db {
                        l_sum.db_collisions += 1;
                    }
                    if !l_sum.conflicting_mod_names.contains(winner_name) {
                        l_sum.conflicting_mod_names.push(winner_name.clone());
                    }
                }
            }
        }

        // Sort detailed conflicts: Fatal startpos first, then scripts, UI, DB
        detailed_conflicts.sort_by_key(|c| match c.severity {
            ConflictSeverity::FatalStartpos => 0,
            ConflictSeverity::ScriptOverride => 1,
            ConflictSeverity::UIOverride => 2,
            ConflictSeverity::DBCollision => 3,
            ConflictSeverity::HarmlessMerge => 4,
        });

        ConflictAnalysisResult {
            total_conflicts,
            fatal_conflicts,
            summaries,
            detailed_conflicts,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_non_existent_pack_returns_empty_manifest() {
        let manifest = PackParser::parse_pack_file(Path::new("/non/existent/path/mod.pack"));
        assert!(!manifest.is_valid_pack);
        assert_eq!(manifest.files.len(), 0);
    }

    #[test]
    fn test_conflict_analysis_empty() {
        let result = PackParser::analyze_conflicts(&[]);
        assert_eq!(result.total_conflicts, 0);
        assert_eq!(result.fatal_conflicts, 0);
        assert!(result.detailed_conflicts.is_empty());
    }
}

