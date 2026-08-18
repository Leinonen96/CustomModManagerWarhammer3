use crate::domain::PathDetectionResult;
use regex::Regex;
use std::path::{Path, PathBuf};

const WH3_APP_ID: &str = "1142710";

pub fn find_steam_library_folders() -> Vec<PathBuf> {
    let mut potential_roots = Vec::new();

    if cfg!(target_os = "linux") {
        if let Some(home) = dirs::home_dir() {
            potential_roots.push(home.join(".steam/steam"));
            potential_roots.push(home.join(".local/share/Steam"));
            potential_roots.push(home.join(".var/app/com.valvesoftware.Steam/.local/share/Steam"));
        }
        potential_roots.push(PathBuf::from("/mnt"));
    } else if cfg!(target_os = "windows") {
        potential_roots.push(PathBuf::from(r"C:\Program Files (x86)\Steam"));
        potential_roots.push(PathBuf::from(r"C:\Program Files\Steam"));
        potential_roots.push(PathBuf::from(r"D:\SteamLibrary"));
        potential_roots.push(PathBuf::from(r"E:\SteamLibrary"));
        potential_roots.push(PathBuf::from(r"F:\SteamLibrary"));
    }

    let mut library_paths = Vec::new();

    for root in potential_roots {
        if !root.exists() {
            continue;
        }
        if !library_paths.contains(&root) {
            library_paths.push(root.clone());
        }

        let vdf_path = root.join("steamapps").join("libraryfolders.vdf");
        if vdf_path.exists() {
            if let Ok(content) = std::fs::read_to_string(&vdf_path) {
                let re = Regex::new(r#""path"\s+"([^"]+)""#).unwrap();
                for cap in re.captures_iter(&content) {
                    if let Some(matched) = cap.get(1) {
                        let clean_str = matched.as_str().replace(r"\\", r"\");
                        let p = PathBuf::from(clean_str);
                        if p.exists() && !library_paths.contains(&p) {
                            library_paths.push(p);
                        }
                    }
                }
            }
        }
    }

    library_paths
}

pub fn auto_detect_wh3_paths() -> PathDetectionResult {
    let mut result = PathDetectionResult {
        workshop_dir: String::new(),
        game_data_dir: String::new(),
        script_file: String::new(),
        detected: false,
    };

    let libraries = find_steam_library_folders();

    // 1. Find Game Data Dir
    for lib in &libraries {
        let data_dir = lib
            .join("steamapps")
            .join("common")
            .join("Total War WARHAMMER III")
            .join("data");
        if data_dir.is_dir() {
            result.game_data_dir = data_dir.to_string_lossy().to_string();
            break;
        }
    }

    // 2. Find Workshop Dir
    for lib in &libraries {
        let workshop_dir = lib
            .join("steamapps")
            .join("workshop")
            .join("content")
            .join(WH3_APP_ID);
        if workshop_dir.is_dir() {
            result.workshop_dir = workshop_dir.to_string_lossy().to_string();
            break;
        }
    }

    // 3. Find user.script.txt
    if cfg!(target_os = "linux") {
        for lib in &libraries {
            let script_path = lib
                .join("steamapps")
                .join("compatdata")
                .join(WH3_APP_ID)
                .join("pfx")
                .join("drive_c")
                .join("users")
                .join("steamuser")
                .join("AppData")
                .join("Roaming")
                .join("The Creative Assembly")
                .join("Warhammer3")
                .join("scripts")
                .join("user.script.txt");

            if script_path.parent().map_or(false, |p| p.exists()) {
                result.script_file = script_path.to_string_lossy().to_string();
                break;
            }
        }
    } else if cfg!(target_os = "windows") {
        if let Ok(appdata) = std::env::var("APPDATA") {
            let win_script = Path::new(&appdata)
                .join("The Creative Assembly")
                .join("Warhammer3")
                .join("scripts")
                .join("user.script.txt");
            result.script_file = win_script.to_string_lossy().to_string();
        }
    }

    if !result.workshop_dir.is_empty() && !result.game_data_dir.is_empty() {
        result.detected = true;
    }

    result
}
