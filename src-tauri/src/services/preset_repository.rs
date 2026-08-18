use crate::domain::{AppError, AppResult, Mod, PresetDetails};
use std::fs;
use std::path::PathBuf;

pub struct PresetRepository {
    presets_dir: PathBuf,
}

impl PresetRepository {
    pub fn new() -> Self {
        let presets_dir = PathBuf::from("presets");
        let _ = fs::create_dir_all(&presets_dir);
        Self { presets_dir }
    }

    pub fn list_presets(&self) -> Vec<String> {
        let mut list = Vec::new();
        if let Ok(entries) = fs::read_dir(&self.presets_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path
                    .extension()
                    .map_or(false, |ext| ext.eq_ignore_ascii_case("json"))
                {
                    if let Some(stem) = path.file_stem() {
                        list.push(stem.to_string_lossy().to_string());
                    }
                }
            }
        }
        list.sort_by(|a, b| a.to_lowercase().cmp(&b.to_lowercase()));
        list
    }

    pub fn load_preset(&self, name: &str, available_mods: &[Mod]) -> AppResult<PresetDetails> {
        let file_path = self.presets_dir.join(format!("{}.json", name));
        if !file_path.exists() {
            return Err(AppError::PathNotFound(format!(
                "Preset '{}' not found",
                name
            )));
        }

        let content = fs::read_to_string(&file_path).unwrap_or_default();
        if content.trim().is_empty() {
            return Ok(PresetDetails {
                name: name.to_string(),
                description: String::new(),
                mods: Vec::new(),
                missing_mods: Vec::new(),
            });
        }

        let parsed_mods: Vec<Mod> = match serde_json::from_str::<Vec<Mod>>(&content) {
            Ok(m) => m,
            Err(_) => {
                // Try object format with "mods" key
                if let Ok(obj) = serde_json::from_str::<serde_json::Value>(&content) {
                    if let Some(mods_val) = obj.get("mods") {
                        serde_json::from_value(mods_val.clone()).unwrap_or_default()
                    } else {
                        Vec::new()
                    }
                } else {
                    Vec::new()
                }
            }
        };

        let available_map: std::collections::HashMap<&str, &Mod> = available_mods
            .iter()
            .map(|m| (m.name.as_str(), m))
            .collect();

        let mut matched_mods = Vec::new();
        let mut missing_mods = Vec::new();

        for p_mod in parsed_mods {
            if let Some(found) = available_map.get(p_mod.name.as_str()) {
                matched_mods.push((*found).clone());
            } else {
                missing_mods.push(p_mod.name.clone());
                matched_mods.push(p_mod);
            }
        }

        Ok(PresetDetails {
            name: name.to_string(),
            description: String::new(),
            mods: matched_mods,
            missing_mods,
        })
    }

    pub fn save_preset(&self, name: &str, mods: &[Mod]) -> AppResult<()> {
        let clean_name = name
            .replace(
                |c: char| !c.is_alphanumeric() && c != ' ' && c != '-' && c != '_',
                "",
            )
            .trim()
            .to_string();
        if clean_name.is_empty() {
            return Err(AppError::Preset("Invalid preset name".to_string()));
        }

        let file_path = self.presets_dir.join(format!("{}.json", clean_name));
        let json_str = serde_json::to_string_pretty(mods)?;
        fs::write(file_path, json_str)?;
        Ok(())
    }

    pub fn delete_preset(&self, name: &str) -> AppResult<bool> {
        let file_path = self.presets_dir.join(format!("{}.json", name));
        if file_path.exists() {
            fs::remove_file(file_path)?;
            Ok(true)
        } else {
            Ok(false)
        }
    }
}
