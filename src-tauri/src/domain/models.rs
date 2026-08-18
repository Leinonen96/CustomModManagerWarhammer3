use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Mod {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub title: String,
    pub real_path: String,
    pub thumb: String,
    #[serde(default)]
    pub url: String,
    #[serde(default)]
    pub file_size_bytes: u64,
    #[serde(default)]
    pub is_movie_pack: bool,
    #[serde(default)]
    pub last_modified: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    #[serde(alias = "WORKSHOP_DIR", default)]
    pub workshop_dir: String,
    #[serde(alias = "GAME_DATA_DIR", default)]
    pub game_data_dir: String,
    #[serde(alias = "SCRIPT_FILE", default)]
    pub script_file: String,
    #[serde(default = "default_auto_backup")]
    pub auto_backup: bool,
    #[serde(default = "default_theme")]
    pub theme: String,
    #[serde(default)]
    pub last_preset: Option<String>,
    #[serde(default)]
    pub ui_scale: Option<f64>,
}

fn default_auto_backup() -> bool {
    true
}

fn default_theme() -> String {
    "dark".to_string()
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            workshop_dir: String::new(),
            game_data_dir: String::new(),
            script_file: String::new(),
            auto_backup: true,
            theme: "dark".to_string(),
            last_preset: None,
            ui_scale: Some(1.0),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PresetDetails {
    pub name: String,
    #[serde(default)]
    pub description: String,
    pub mods: Vec<Mod>,
    #[serde(default)]
    pub missing_mods: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PathValidationStatus {
    pub path: String,
    pub exists: bool,
    pub is_dir: bool,
    pub parent_exists: bool,
    pub readable: bool,
    pub writable: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigValidationResult {
    pub workshop_dir: PathValidationStatus,
    pub game_data_dir: PathValidationStatus,
    pub script_file: PathValidationStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PathDetectionResult {
    #[serde(rename = "WORKSHOP_DIR")]
    pub workshop_dir: String,
    #[serde(rename = "GAME_DATA_DIR")]
    pub game_data_dir: String,
    #[serde(rename = "SCRIPT_FILE")]
    pub script_file: String,
    pub detected: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadOrderResult {
    pub success: bool,
    pub applied_count: usize,
    pub cleaned_count: usize,
    pub script_path: String,
    pub backup_path: Option<String>,
    pub message: String,
}
