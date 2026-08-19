use crate::domain::{AppResult, Mod};
use crate::services::{ConfigStore, WorkshopScanner};
use tauri::command;

#[command]
pub fn get_mods() -> Vec<Mod> {
    let config = ConfigStore::new().load();
    if config.workshop_dir.is_empty() {
        return Vec::new();
    }
    WorkshopScanner::scan_workshop(&config.workshop_dir)
}

#[command]
pub fn open_url(url: String) -> AppResult<()> {
    #[cfg(unix)]
    {
        let _ = std::process::Command::new("xdg-open").arg(&url).spawn();
    }
    #[cfg(windows)]
    {
        let _ = std::process::Command::new("cmd")
            .args(["/C", "start", "", &url])
            .spawn();
    }
    Ok(())
}

#[command]
pub fn open_path(path: String) -> AppResult<()> {
    let p = std::path::Path::new(&path);
    let target_dir = if p.is_file() {
        p.parent().unwrap_or(p)
    } else {
        p
    };

    #[cfg(unix)]
    {
        let _ = std::process::Command::new("xdg-open")
            .arg(target_dir)
            .spawn();
    }
    #[cfg(windows)]
    {
        let _ = std::process::Command::new("explorer")
            .arg(target_dir)
            .spawn();
    }
    Ok(())
}
