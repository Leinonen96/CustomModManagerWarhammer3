use crate::domain::{AppConfig, AppResult, ConfigValidationResult, PathValidationStatus};
use crate::services::path_detector::auto_detect_wh3_paths;
use std::fs;
use std::path::{Path, PathBuf};

pub struct ConfigStore {
    config_path: PathBuf,
}

impl ConfigStore {
    pub fn new() -> Self {
        let app_dir = dirs::config_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("wh3-mod-manager");
        let _ = fs::create_dir_all(&app_dir);
        let config_path = app_dir.join("config.json");

        // Migrate legacy ./config.json from working directory if present
        let legacy_config = PathBuf::from("config.json");
        if legacy_config.exists() && !config_path.exists() {
            let _ = fs::copy(&legacy_config, &config_path);
        }

        Self { config_path }
    }

    pub fn load(&self) -> AppConfig {
        if !self.config_path.exists() {
            let detected = auto_detect_wh3_paths();
            let config = AppConfig {
                workshop_dir: detected.workshop_dir,
                game_data_dir: detected.game_data_dir,
                script_file: detected.script_file,
                auto_backup: true,
                auto_check_updates: true,
                theme: "dark".to_string(),
                last_preset: None,
                ui_scale: Some(1.0),
            };
            let _ = self.save(&config);
            return config;
        }

        match fs::read_to_string(&self.config_path) {
            Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
            Err(_) => AppConfig::default(),
        }
    }

    pub fn save(&self, config: &AppConfig) -> AppResult<()> {
        let json_str = serde_json::to_string_pretty(config)?;
        fs::write(&self.config_path, json_str)?;
        Ok(())
    }

    pub fn validate(&self, config: &AppConfig) -> ConfigValidationResult {
        ConfigValidationResult {
            workshop_dir: self.validate_dir(&config.workshop_dir),
            game_data_dir: self.validate_dir(&config.game_data_dir),
            script_file: self.validate_file(&config.script_file),
        }
    }

    fn validate_dir(&self, path_str: &str) -> PathValidationStatus {
        let path = Path::new(path_str);
        let exists = path.exists();
        let is_dir = path.is_dir();
        PathValidationStatus {
            path: path_str.to_string(),
            exists,
            is_dir,
            parent_exists: path.parent().map_or(false, |p| p.exists()),
            readable: exists,
            writable: exists,
        }
    }

    fn validate_file(&self, path_str: &str) -> PathValidationStatus {
        let path = Path::new(path_str);
        let exists = path.exists();
        let parent_exists = path.parent().map_or(false, |p| p.exists());
        PathValidationStatus {
            path: path_str.to_string(),
            exists,
            is_dir: false,
            parent_exists,
            readable: exists,
            writable: exists || parent_exists,
        }
    }
}
