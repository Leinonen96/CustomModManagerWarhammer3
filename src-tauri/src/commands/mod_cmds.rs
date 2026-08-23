use crate::domain::{AppResult, Mod};
use crate::services::{ConfigStore, WorkshopScanner};
use tauri::command;
use tauri_plugin_shell::ShellExt;

#[command]
pub fn get_mods() -> Vec<Mod> {
    let config = ConfigStore::new().load();
    if config.workshop_dir.is_empty() {
        return Vec::new();
    }
    WorkshopScanner::scan_workshop(&config.workshop_dir)
}

#[command]
pub fn open_url(app: tauri::AppHandle, url: String) -> AppResult<()> {
    eprintln!("[open_url] Attempting to open URL: {}", url);

    // 1. Try Tauri Shell Plugin
    #[allow(deprecated)]
    if let Ok(()) = app.shell().open(&url, None) {
        eprintln!("[open_url] Opened successfully via Tauri Shell plugin");
        return Ok(());
    }

    // 2. Linux Multi-Tier Desktop Fallback (GIO -> xdg-open -> Firefox)
    #[cfg(target_os = "linux")]
    {
        // Try gio open (native GLib/GIO for GTK and modern Linux desktops)
        if let Ok(mut child) = std::process::Command::new("gio")
            .args(["open", &url])
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .spawn()
        {
            let _ = child.wait();
            eprintln!("[open_url] Dispatched via gio open");
            return Ok(());
        }

        // Try xdg-open
        if let Ok(mut child) = std::process::Command::new("xdg-open")
            .arg(&url)
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .spawn()
        {
            let _ = child.wait();
            eprintln!("[open_url] Dispatched via xdg-open");
            return Ok(());
        }

        // Direct browser fallback
        let _ = std::process::Command::new("firefox")
            .arg(&url)
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .spawn();
    }

    // 3. Windows Fallback
    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("cmd")
            .args(["/C", "start", "", &url])
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .spawn();
    }

    // 4. macOS Fallback
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open")
            .arg(&url)
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .spawn();
    }

    Ok(())
}

#[command]
pub fn open_path(app: tauri::AppHandle, path: String) -> AppResult<()> {
    let p = std::path::Path::new(&path);
    let target_dir = if p.is_file() {
        p.parent().unwrap_or(p)
    } else {
        p
    };

    let target_str = target_dir.to_string_lossy().to_string();
    eprintln!("[open_path] Opening directory: {}", target_str);

    // 1. Try Tauri Shell plugin
    #[allow(deprecated)]
    if let Ok(()) = app.shell().open(&target_str, None) {
        return Ok(());
    }

    // 2. Linux Fallback
    #[cfg(target_os = "linux")]
    {
        if let Ok(mut child) = std::process::Command::new("gio")
            .args(["open", &target_str])
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .spawn()
        {
            let _ = child.wait();
            return Ok(());
        }

        let _ = std::process::Command::new("xdg-open")
            .arg(&target_str)
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .spawn();
    }

    // 3. Windows Fallback
    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("explorer")
            .arg(&target_str)
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .spawn();
    }

    // 4. macOS Fallback
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open")
            .arg(&target_str)
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .spawn();
    }

    Ok(())
}
