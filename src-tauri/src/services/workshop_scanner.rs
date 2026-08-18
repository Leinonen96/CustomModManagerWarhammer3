use crate::domain::Mod;
use regex::Regex;
use std::fs;
use std::path::{Path, PathBuf};

pub struct WorkshopScanner;

impl WorkshopScanner {
    pub fn scan_workshop(workshop_dir: &str) -> Vec<Mod> {
        let mut mods = Vec::new();
        let workshop_path = Path::new(workshop_dir);

        if !workshop_path.is_dir() {
            return mods;
        }

        let entries = match fs::read_dir(workshop_path) {
            Ok(e) => e,
            Err(_) => return mods,
        };

        for entry in entries.flatten() {
            let folder_path = entry.path();
            if !folder_path.is_dir() {
                continue;
            }

            let folder_name = folder_path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();
            let workshop_title = Self::extract_workshop_title(&folder_path);

            let sub_entries = match fs::read_dir(&folder_path) {
                Ok(e) => e,
                Err(_) => continue,
            };

            let mut files: Vec<PathBuf> = Vec::new();
            for sub in sub_entries.flatten() {
                files.push(sub.path());
            }

            let pack_files: Vec<&PathBuf> = files
                .iter()
                .filter(|p| {
                    p.extension().map_or(false, |ext| {
                        ext.to_string_lossy().eq_ignore_ascii_case("pack")
                    })
                })
                .collect();

            for pack_path in pack_files {
                let pack_name = pack_path
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string();
                let thumb_path = Self::find_thumbnail_path(&files, &pack_name);
                let thumb_str = thumb_path
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_default();

                let mut file_size = 0;
                let mut mtime = 0.0;
                if let Ok(meta) = pack_path.metadata() {
                    file_size = meta.len();
                    if let Ok(modified) = meta.modified() {
                        if let Ok(duration) = modified.duration_since(std::time::UNIX_EPOCH) {
                            mtime = duration.as_secs_f64();
                        }
                    }
                }

                let clean_title = workshop_title.clone().unwrap_or_else(|| {
                    pack_name
                        .trim_end_matches(".pack")
                        .trim_end_matches(".PACK")
                        .replace('_', " ")
                        .trim()
                        .to_string()
                });

                let steam_url = format!(
                    "https://steamcommunity.com/sharedfiles/filedetails/?id={}",
                    folder_name
                );

                let date_str = if mtime > 0.0 {
                    let days = (mtime as u64) / 86400;
                    format_days(days)
                } else {
                    String::new()
                };

                mods.push(Mod {
                    id: folder_name.clone(),
                    name: pack_name,
                    title: clean_title,
                    real_path: pack_path.to_string_lossy().to_string(),
                    thumb: thumb_str,
                    url: steam_url,
                    file_size_bytes: file_size,
                    is_movie_pack: false,
                    last_modified: mtime,
                    source_type: "Workshop".to_string(),
                    last_modified_str: date_str,
                    author: None,
                });
            }
        }

        mods.sort_by(|a, b| a.title.to_lowercase().cmp(&b.title.to_lowercase()));
        mods
    }

    fn find_thumbnail_path(files: &[PathBuf], pack_name: &str) -> Option<PathBuf> {
        let base_stem = pack_name
            .trim_end_matches(".pack")
            .trim_end_matches(".PACK")
            .to_lowercase();

        // 1. Try matching base stem or standard thumbnail names
        for file in files {
            if let Some(stem) = file.file_stem() {
                let stem_str = stem.to_string_lossy().to_lowercase();
                if let Some(ext) = file.extension() {
                    let ext_str = ext.to_string_lossy().to_lowercase();
                    if ext_str == "png"
                        || ext_str == "jpg"
                        || ext_str == "jpeg"
                        || ext_str == "webp"
                    {
                        if stem_str == base_stem
                            || stem_str == "thumbnail"
                            || stem_str == "thumb"
                            || stem_str == "preview"
                        {
                            return Some(file.clone());
                        }
                    }
                }
            }
        }

        // 2. Fallback: Any image in the folder
        for file in files {
            if let Some(ext) = file.extension() {
                let ext_str = ext.to_string_lossy().to_lowercase();
                if ext_str == "png" || ext_str == "jpg" || ext_str == "jpeg" || ext_str == "webp" {
                    return Some(file.clone());
                }
            }
        }

        None
    }

    fn extract_workshop_title(folder_path: &Path) -> Option<String> {
        let vdf_file = folder_path.join("publish_data.vdf");
        if vdf_file.exists() {
            if let Ok(content) = fs::read_to_string(vdf_file) {
                let re = Regex::new(r#""title"\s+"([^"]+)""#).ok()?;
                if let Some(cap) = re.captures(&content) {
                    if let Some(m) = cap.get(1) {
                        return Some(m.as_str().trim().to_string());
                    }
                }
            }
        }
        None
    }
}

fn format_days(days: u64) -> String {
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
