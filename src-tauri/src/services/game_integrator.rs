use std::fs;
use std::path::{Path, PathBuf};
use crate::domain::{AppError, AppResult, LoadOrderResult, Mod};

pub struct GameIntegrator;

impl GameIntegrator {
    pub fn apply_load_order(
        mods: &[Mod],
        game_data_dir: &str,
        script_file: &str,
        auto_backup: bool,
    ) -> AppResult<LoadOrderResult> {
        let data_path = Path::new(game_data_dir);
        if !data_path.is_dir() {
            return Err(AppError::PathNotFound(format!("Game Data Directory: {}", game_data_dir)));
        }

        let script_path = Path::new(script_file);

        // 1. Clean up existing symlinks in game_data_dir
        let cleaned_count = Self::cleanup_existing_symlinks(data_path);

        // 2. Create symlinks / hardlinks for active mods
        let mut applied_count = 0;
        let mut script_lines = Vec::new();

        for m in mods {
            if m.name.is_empty() || m.real_path.is_empty() {
                continue;
            }

            let source = PathBuf::from(&m.real_path);
            let target = data_path.join(&m.name);

            if !source.exists() {
                continue;
            }

            // Remove target if it already exists or is broken symlink
            if target.exists() || target.is_symlink() {
                let _ = fs::remove_file(&target);
            }

            // Create symlink with fallback
            Self::create_link(&source, &target)?;

            script_lines.push(format!("mod \"{}\";", m.name));
            applied_count += 1;
        }

        // 3. Backup user.script.txt if it exists
        let mut backup_path_str = None;
        if auto_backup && script_path.exists() {
            let mut bak_path = script_path.to_path_buf();
            bak_path.set_extension("txt.bak");
            if let Ok(_) = fs::copy(script_path, &bak_path) {
                backup_path_str = Some(bak_path.to_string_lossy().to_string());
            }
        }

        // 4. Write new user.script.txt
        if let Some(parent) = script_path.parent() {
            fs::create_dir_all(parent)?;
        }

        let content = if script_lines.is_empty() {
            String::new()
        } else {
            format!("{}\n", script_lines.join("\n"))
        };

        fs::write(script_path, content)?;

        Ok(LoadOrderResult {
            success: true,
            applied_count,
            cleaned_count,
            script_path: script_path.to_string_lossy().to_string(),
            backup_path: backup_path_str,
            message: format!("Applied {} mods to game data and updated user.script.txt.", applied_count),
        })
    }

    fn cleanup_existing_symlinks(data_path: &Path) -> usize {
        let mut cleaned = 0;
        if let Ok(entries) = fs::read_dir(data_path) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_symlink() {
                    if let Some(ext) = path.extension() {
                        if ext.to_string_lossy().eq_ignore_ascii_case("pack") {
                            if fs::remove_file(&path).is_ok() {
                                cleaned += 1;
                            }
                        }
                    }
                }
            }
        }
        cleaned
    }

    #[cfg(unix)]
    fn create_link(source: &Path, target: &Path) -> AppResult<()> {
        use std::os::unix::fs::symlink;
        symlink(source, target).map_err(|e| {
            AppError::PermissionDenied(format!("Failed to create symlink at {:?}: {}", target, e))
        })
    }

    #[cfg(windows)]
    fn create_link(source: &Path, target: &Path) -> AppResult<()> {
        use std::os::windows::fs::symlink_file;
        if symlink_file(source, target).is_err() {
            // Fallback to hardlink on Windows
            fs::hard_link(source, target).map_err(|e| {
                AppError::PermissionDenied(format!(
                    "Failed to create symlink or hardlink at {:?}: {}. Please enable Windows Developer Mode.",
                    target, e
                ))
            })?;
        }
        Ok(())
    }
}
