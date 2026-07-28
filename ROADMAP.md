## The Modern Tauri v2 + Dynamic Sidecar Plan

**1.Scaffold with create-tauri-app:**Tauri v2.

Instead of manually initializing, use the modern bootstrap tool which configures Vite, TypeScript, and Tauri v2 all at once.

Run `npm create tauri-app@latest`.

Choose **TypeScript** and **Vite**. This creates a perfectly wired frontend + backend directory structure out of the box, saving you from manually moving `index.html` and configuring build paths.

**2.Dynamic Port Allocation in Flask:**Robust Backend.

Update your Flask `run.py` to ask the OS for a free port instead of forcing port 5000:

Python

```
import socket
sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock.bind(('127.0.0.1', 0))
port = sock.getsockname()[1]
sock.close()

# Print the port so Tauri can capture it
print(f"BACKEND_PORT={port}", flush=True)
app.run(host='127.0.0.1', port=port, debug=False)
```

**3.Intercept and Pass the Port:**The Rust Bridge.

In `src-tauri/src/main.rs`, use Tauri's `Command` API to spawn the Flask sidecar.

Write a Rust function that listens to the sidecar's stdout, captures `BACKEND_PORT=xxxxx`, and exposes a Tauri command (e.g., `get_backend_port`) so the TypeScript frontend can ask Rust what port Flask is running on.

**4.Dynamic API Abstraction:**Frontend Independence.

In `frontend/api.ts`, instead of hardcoding `fetch('http://localhost:5000/...')`, fetch the port from Rust on startup:

TypeScript

```
import { invoke } from '@tauri-apps/api/core';

let baseUrl = '';

export async function initApi() {
    const port = await invoke('get_backend_port');
    baseUrl = `http://127.0.0.1:${port}`;
}

export async function fetchMods() {
    const res = await fetch(`${baseUrl}/api/mods`);
    return res.json();
}
```

**5.Freeze and Package (Wayland/Flatpak):**Linux First.

1. **Freeze:** Run `pyinstaller --noconsole --onefile run.py`. The `--noconsole` flag is critical—it ensures Python runs purely in the background without tripping up Wayland or XWayland window managers.
    
2. **Package:** Tauri v2 automatically generates an `.AppImage`. For a true modern Linux experience, you can add `flatpak` to Tauri's bundler targets in `tauri.conf.json`, which isolates your app cleanly from the host system.


.
├── backend/                  # [PYTHON] The raw Flask source code
│   ├── core.py
│   ├── routes.py
│   └── __init__.py
├── run.py                    # [PYTHON] Entry point (updated for dynamic ports)
├── requirements.txt          
│
├── src-tauri/                # [RUST] The Tauri native desktop shell
│   ├── binaries/             # └─ Compiled Python executables go here
│   │   └── wh3-backend-x86_64-unknown-linux-gnu  # (PyInstaller output)
│   ├── src/                  
│   │   └── main.rs           # └─ Rust logic: Spawns sidecar & passes port to UI
│   ├── tauri.conf.json       # └─ Tauri config: window size, sidecar declarations
│   ├── Cargo.toml            # └─ Rust dependencies
│   └── build.rs              
│
├── frontend/                 # [TYPESCRIPT] Modular UI source code
│   ├── components/           # └─ UI modules (modManager.ts, presets.ts)
│   ├── api.ts                # └─ Dynamic API layer (talks to Rust & Python)
│   ├── state.ts              # └─ Application state 
│   ├── main.ts               # └─ Main Vite entry point
│   └── style.css             
│
├── index.html                # [VITE] Entry point (moved out of Flask templates/)
├── package.json              # Node scripts (npm run dev, npm run tauri build)
├── vite.config.ts            # Vite build pipeline configuration
└── tsconfig.json             # TypeScript rules