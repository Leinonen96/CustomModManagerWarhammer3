use crate::services::WorkshopScanner;
use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::PathBuf;
use std::sync::mpsc::{channel, Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

pub struct WorkshopWatcher {
    current_path: Arc<Mutex<Option<PathBuf>>>,
    watcher: Arc<Mutex<Option<RecommendedWatcher>>>,
    tx_event: Sender<()>,
}

impl WorkshopWatcher {
    pub fn new(app_handle: AppHandle) -> Self {
        let (tx_event, rx_event): (Sender<()>, Receiver<()>) = channel();
        let current_path = Arc::new(Mutex::new(None));
        let watcher = Arc::new(Mutex::new(None));

        // Spawn debouncing background worker
        let app_clone = app_handle.clone();
        let path_clone = Arc::clone(&current_path);
        thread::spawn(move || {
            debounce_worker(rx_event, app_clone, path_clone);
        });

        Self {
            current_path,
            watcher,
            tx_event,
        }
    }

    pub fn set_watch_path(&self, path_str: &str) {
        let mut path_guard = self.current_path.lock().unwrap();
        let mut watcher_guard = self.watcher.lock().unwrap();

        // Stop existing watcher if any
        *watcher_guard = None;

        let path = PathBuf::from(path_str);
        if !path_str.is_empty() && path.is_dir() {
            let tx = self.tx_event.clone();
            let mut watcher = match RecommendedWatcher::new(
                move |res: Result<Event, notify::Error>| {
                    if let Ok(event) = res {
                        if is_relevant_event(&event) {
                            let _ = tx.send(());
                        }
                    }
                },
                Config::default(),
            ) {
                Ok(w) => w,
                Err(err) => {
                    eprintln!("[WorkshopWatcher] Failed to create watcher: {}", err);
                    *path_guard = None;
                    return;
                }
            };

            if let Err(err) = watcher.watch(&path, RecursiveMode::Recursive) {
                eprintln!("[WorkshopWatcher] Failed to watch path {:?}: {}", path, err);
                *path_guard = None;
            } else {
                eprintln!("[WorkshopWatcher] Watching directory: {:?}", path);
                *path_guard = Some(path);
                *watcher_guard = Some(watcher);
            }
        } else {
            *path_guard = None;
        }
    }
}

fn is_relevant_event(event: &Event) -> bool {
    match event.kind {
        EventKind::Create(_) | EventKind::Modify(_) | EventKind::Remove(_) => {}
        _ => return false,
    }

    if event.paths.is_empty() {
        return true;
    }

    for path in &event.paths {
        if path.is_dir() {
            return true;
        }
        if let Some(ext) = path.extension() {
            let ext_str = ext.to_string_lossy().to_lowercase();
            if ext_str == "pack"
                || ext_str == "vdf"
                || ext_str == "png"
                || ext_str == "jpg"
                || ext_str == "jpeg"
                || ext_str == "webp"
            {
                return true;
            }
        }
    }

    false
}

fn debounce_worker(
    rx: Receiver<()>,
    app_handle: AppHandle,
    current_path: Arc<Mutex<Option<PathBuf>>>,
) {
    const DEBOUNCE_DURATION: Duration = Duration::from_millis(600);
    let mut pending = false;
    let mut last_event_time = Instant::now();

    loop {
        if pending {
            let elapsed = last_event_time.elapsed();
            if elapsed >= DEBOUNCE_DURATION {
                // Drain any additional events queued up during the delay
                while rx.try_recv().is_ok() {}
                pending = false;

                // Perform scan
                let maybe_path = {
                    let guard = current_path.lock().unwrap();
                    guard.clone()
                };

                if let Some(path) = maybe_path {
                    let path_str = path.to_string_lossy().to_string();
                    eprintln!(
                        "[WorkshopWatcher] Debounce window elapsed, rescanning: {}",
                        path_str
                    );
                    let mods = WorkshopScanner::scan_workshop(&path_str);
                    if let Err(e) = app_handle.emit("workshop-mods-updated", &mods) {
                        eprintln!("[WorkshopWatcher] Failed to emit event: {}", e);
                    }
                }
            } else {
                let remaining = DEBOUNCE_DURATION - elapsed;
                match rx.recv_timeout(remaining) {
                    Ok(()) => {
                        last_event_time = Instant::now();
                    }
                    Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                        // Will check elapsed on next iteration
                    }
                    Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => {
                        break;
                    }
                }
            }
        } else {
            match rx.recv() {
                Ok(()) => {
                    pending = true;
                    last_event_time = Instant::now();
                }
                Err(_) => {
                    break;
                }
            }
        }
    }
}
