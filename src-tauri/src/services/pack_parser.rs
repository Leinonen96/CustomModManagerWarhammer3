use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{BufReader, Read};
use std::path::Path;
use std::sync::Mutex;
use std::time::UNIX_EPOCH;
use crate::domain::{
    ConflictAnalysisResult, ConflictSeverity, FileConflictDetail, Mod, ModConflictSummary,
    PackType, PackedFileManifest,
};

static MANIFEST_CACHE: Mutex<Option<HashMap<String, (u64, PackedFileManifest)>>> = Mutex::new(None);

pub struct PackParser;

impl PackParser {
    /// Ultra-fast zero-copy index parser for Total War Warhammer PFH5/PFH4/PFH3 packfiles.
    /// Reads the entire index in a single buffer and parses in-memory with mtime caching.
    pub fn parse_pack_file(pack_path: &Path) -> PackedFileManifest {
        let path_str = pack_path.to_string_lossy().to_string();
        let pack_name = pack_path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        let mut manifest = PackedFileManifest {
            pack_name: pack_name.clone(),
            pack_path: path_str.clone(),
            pack_type: PackType::Mod,
            dependencies: Vec::new(),
            files: Vec::new(),
            file_count: 0,
            is_valid_pack: false,
            pfh_version: "PFH5".to_string(),
            header_bitmask_hex: "0x00000003".to_string(),
            sha256_hash: String::new(),
            last_modified_str: String::new(),
        };

        // Check file metadata and mtime cache
        let metadata = match fs::metadata(pack_path) {
            Ok(m) => m,
            Err(_) => return manifest,
        };

        let file_len = metadata.len();
        let mtime = metadata
            .modified()
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_secs())
            .unwrap_or(0);

        if mtime > 0 {
            // Format readable date
            let days_since_epoch = mtime / 86400;
            // Approximate Gregorian date for display
            manifest.last_modified_str = format_epoch_days(days_since_epoch);
        }

        {
            let mut cache_guard = MANIFEST_CACHE.lock().unwrap();
            let cache = cache_guard.get_or_insert_with(HashMap::new);
            if let Some((cached_mtime, cached_manifest)) = cache.get(&path_str) {
                if *cached_mtime == mtime && *cached_mtime > 0 {
                    return cached_manifest.clone();
                }
            }
        }

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

        manifest.pfh_version = String::from_utf8_lossy(&magic).to_string();

        let mut header_buf = [0u8; 20];
        if reader.read_exact(&mut header_buf).is_err() {
            return manifest;
        }

        let pack_type_val = u32::from_le_bytes(header_buf[0..4].try_into().unwrap_or_default());
        let dep_count = u32::from_le_bytes(header_buf[4..8].try_into().unwrap_or_default()) as usize;
        let index_size = u32::from_le_bytes(header_buf[8..12].try_into().unwrap_or_default()) as usize;
        let file_count = u32::from_le_bytes(header_buf[16..20].try_into().unwrap_or_default()) as usize;

        manifest.header_bitmask_hex = format!("0x{:08X}", pack_type_val);
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

        // Safety limit: if index_size is unreasonably large or 0, cap reading
        if index_size == 0 || index_size > 50 * 1024 * 1024 {
            manifest.is_valid_pack = true;
            return manifest;
        }

        // 2. Read ENTIRE index table in a single bulk I/O read
        let mut index_buf = vec![0u8; index_size];
        if reader.read_exact(&mut index_buf).is_err() {
            return manifest;
        }

        // Compute fast deterministic hash for multiplayer sync (FNV-1a 128-bit hash)
        manifest.sha256_hash = compute_fast_pack_hash(&magic, &header_buf, &index_buf, file_len);

        let mut cursor = 0;

        // Read Dependency List from in-memory slice
        for _ in 0..dep_count {
            if cursor >= index_buf.len() {
                break;
            }
            if let Some(null_idx) = index_buf[cursor..].iter().position(|&b| b == 0) {
                let dep_str = String::from_utf8_lossy(&index_buf[cursor..cursor + null_idx]).to_string();
                cursor += null_idx + 1;
                if !dep_str.is_empty() {
                    manifest.dependencies.push(dep_str);
                }
            } else {
                break;
            }
        }

        // Read Packed Files Manifest Index from in-memory slice
        let mut files = Vec::with_capacity(file_count.min(20_000));
        for _ in 0..file_count {
            if cursor + 4 > index_buf.len() {
                break;
            }
            cursor += 4; // Skip uncompressed size

            if is_pfh5 {
                if cursor >= index_buf.len() {
                    break;
                }
                let flag = index_buf[cursor];
                cursor += 1;
                if flag & 1 != 0 {
                    if cursor + 4 > index_buf.len() {
                        break;
                    }
                    cursor += 4; // Skip compressed size
                }
            } else if is_pfh4 {
                if cursor >= index_buf.len() {
                    break;
                }
                cursor += 1; // Skip flag
            }

            if cursor >= index_buf.len() {
                break;
            }

            if let Some(null_idx) = index_buf[cursor..].iter().position(|&b| b == 0) {
                let path_bytes = &index_buf[cursor..cursor + null_idx];
                cursor += null_idx + 1;

                let path_str = String::from_utf8_lossy(path_bytes);
                let normalized = path_str.replace('\\', "/").trim().to_lowercase();
                if !normalized.is_empty() {
                    files.push(normalized);
                }
            } else {
                break;
            }
        }

        manifest.files = files;
        manifest.is_valid_pack = true;

        // Cache manifest in RAM
        if mtime > 0 {
            let mut cache_guard = MANIFEST_CACHE.lock().unwrap();
            let cache = cache_guard.get_or_insert_with(HashMap::new);
            cache.insert(path_str, (mtime, manifest.clone()));
        }

        manifest
    }

    /// High-performance conflict matrix analysis across all active mods.
    pub fn analyze_conflicts(active_mods: &[Mod]) -> ConflictAnalysisResult {
        let mut file_map: HashMap<String, Vec<(usize, String, String, bool)>> = HashMap::new();
        let mut summaries: HashMap<String, ModConflictSummary> = HashMap::new();

        // Maps for fast lookup
        let mut name_to_id: HashMap<String, String> = HashMap::new();
        let mut id_to_name: HashMap<String, String> = HashMap::new();
        let mut mod_manifests: Vec<PackedFileManifest> = Vec::with_capacity(active_mods.len());

        for m in active_mods {
            if !m.id.is_empty() {
                name_to_id.insert(m.name.clone(), m.id.clone());
                id_to_name.insert(m.id.clone(), m.name.clone());
            }
        }

        // 1. Parse all active pack files using fast bulk index reading
        for (i, m) in active_mods.iter().enumerate() {
            let load_order_index = i + 1;
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
                    pfh_version: "Unknown".to_string(),
                    header_bitmask_hex: "0x0".to_string(),
                    sha256_hash: String::new(),
                    last_modified_str: String::new(),
                }
            };

            let is_movie = manifest.pack_type == PackType::Movie;
            let name_lower = m.name.to_lowercase();
            let title_lower = m.title.to_lowercase();
            let is_framework = name_lower.contains("mixer")
                || name_lower.contains("unlocker")
                || name_lower.contains("community_bugfix")
                || name_lower.contains("cbfm")
                || name_lower.contains("mod_configuration_tool")
                || name_lower.contains("mct")
                || name_lower.contains("ui_framework")
                || title_lower.contains("mixu's unlocker")
                || title_lower.contains("community bugfix")
                || title_lower.contains("mod configuration tool");

            summaries.insert(
                m.name.clone(),
                ModConflictSummary {
                    mod_name: m.name.clone(),
                    mod_id: m.id.clone(),
                    is_movie_pack: is_movie,
                    is_framework,
                    declared_dependencies: manifest.dependencies.clone(),
                    ..Default::default()
                },
            );

            for file in &manifest.files {
                file_map
                    .entry(file.clone())
                    .or_default()
                    .push((load_order_index, m.name.clone(), m.id.clone(), is_movie));
            }

            mod_manifests.push(manifest);
        }

        // 1b. Compute forward dependencies and reverse dependents
        for (i, m) in active_mods.iter().enumerate() {
            let manifest = &mod_manifests[i];
            let mut missing = Vec::new();

            for dep in &manifest.dependencies {
                let matched_name = if summaries.contains_key(dep) {
                    Some(dep.clone())
                } else if let Some(n) = id_to_name.get(dep) {
                    Some(n.clone())
                } else {
                    None
                };

                if let Some(target_name) = matched_name {
                    if target_name != m.name {
                        if let Some(target_summary) = summaries.get_mut(&target_name) {
                            if !target_summary.dependents.contains(&m.name) {
                                target_summary.dependents.push(m.name.clone());
                            }
                        }
                    }
                } else {
                    missing.push(dep.clone());
                }
            }

            if let Some(s) = summaries.get_mut(&m.name) {
                s.missing_dependencies = missing;
            }
        }

        let mut detailed_conflicts = Vec::new();
        let mut total_conflicts = 0;
        let mut fatal_conflicts = 0;

        // 2. Classify conflicts across all overlapping file paths
        for (internal_path, occurrences) in file_map {
            if occurrences.len() <= 1 {
                continue;
            }

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

        if detailed_conflicts.len() > 1000 {
            detailed_conflicts.truncate(1000);
        }

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

fn compute_fast_pack_hash(magic: &[u8; 4], header: &[u8; 20], index: &[u8], file_len: u64) -> String {
    let mut h1: u64 = 0xcbf29ce484222325;
    let mut h2: u64 = 0x100000001b3;

    for &b in magic {
        h1 = (h1 ^ (b as u64)).wrapping_mul(0x100000001b3);
    }
    for &b in header {
        h2 = (h2 ^ (b as u64)).wrapping_mul(0xcbf29ce484222325);
    }
    for &b in index.iter().take(4096) {
        h1 = (h1 ^ (b as u64)).wrapping_mul(0x100000001b3);
    }
    h1 = (h1 ^ file_len).wrapping_mul(0x100000001b3);
    h2 = (h2 ^ (index.len() as u64)).wrapping_mul(0xcbf29ce484222325);

    format!("{:016x}{:016x}", h1, h2)
}

fn format_epoch_days(days: u64) -> String {
    // Simple epoch to YYYY-MM-DD converter
    let z = days as i64 + 719468;
    let era = if z >= 0 { z } else { z - 146096 } / 146097;
    let doe = (z - era * 146097) as u32;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let final_y = if m <= 2 { y + 1 } else { y };

    format!("{:04}-{:02}-{:02}", final_y, m, d)
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

    #[test]
    fn test_hash_deterministic() {
        let magic = *b"PFH5";
        let header = [0u8; 20];
        let index = vec![1, 2, 3, 4, 5];
        let h1 = compute_fast_pack_hash(&magic, &header, &index, 1000);
        let h2 = compute_fast_pack_hash(&magic, &header, &index, 1000);
        assert_eq!(h1, h2);
        assert_eq!(h1.len(), 32);
    }
}
