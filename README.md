# ⚔️ Total War: WARHAMMER III Mod Manager (v2.0 Native)

[![CI](https://github.com/Leinonen96/CustomModManagerWarhammer3/actions/workflows/ci.yml/badge.svg)](https://github.com/Leinonen96/CustomModManagerWarhammer3/actions/workflows/ci.yml)
[![Release](https://github.com/Leinonen96/CustomModManagerWarhammer3/actions/workflows/release.yml/badge.svg)](https://github.com/Leinonen96/CustomModManagerWarhammer3/actions/workflows/release.yml)
[![Rust](https://img.shields.io/badge/Rust-1.75%2B-orange?logo=rust)](https://www.rust-lang.org/)
[![Tauri v2](https://img.shields.io/badge/Tauri-v2-blue?logo=tauri)](https://v2.tauri.app/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

A ultra-fast, high-density desktop mod manager and diagnostic suite for **Total War: WARHAMMER III**, re-engineered from the ground up in **Rust** and **Tauri v2**. 

Designed for heavy modders (100–500+ mods) with zero UI lag, real-time PFH pack inspection, DAG topological dependency sorting, binary conflict diffing, and seamless Linux/Steam Deck and Windows support.

---

## ✨ Key Features & Architecture

### ⚡ Blazing Fast Native Core
- **100% Rust Backend (`src-tauri`)**: Binary PFH5/PFH4/PFH3 header and index parser capable of scanning and indexing 50,000+ packed files in $< 0.05\text{ ms}$ with in-memory `(mtime)` caching.
- **Tauri v2 IPC**: Offloads all heavy disk I/O and topological graph sorting to async background worker threads, guaranteeing 144 FPS smooth scrolling with zero UI freezes.
- **Native Game Integration**: Generates clean symlinks into the Warhammer 3 game data directory and writes prioritized execution order to `user.script.txt`.

### 🛡️ Real-Time Conflict Engine & Diagnostic Suite
- **Startpos Collision Detection**: Instantly warns about fatal `startpos.esf` collisions across multiple active campaign overhauls.
- **Script & UI Overrides Matrix**: Classifies winning (`▲`) and overridden (`▼`) Lua scripts and TWUI layouts based on exact load order hierarchy.
- **Movie Pack Engine Rules**: Identifies pack type 0 (Movie packs) that bypass `user.script.txt` and auto-load directly from `/data`.

### 🔍 3-Tier Progressive Disclosure Inspector Drawer
- **Tier 1: High-Density Card (~72px)**: Large 72px thumbnail, Steam Workshop / Local badges (`[WS]` / `[LOCAL]`), file size, load order position, and at-a-glance status glyphs.
- **Tier 2: Slide-Over Inspector**: Slide-over drawer with pack contents breakdown (DB tables, Lua scripts, UI layouts, Startpos files) and interactive conflict diff trees with 1-click **[⤒ Move Above Winner]** and **[⤓ Move Below Loser]** resolution.
- **Tier 3: Advanced Technical Specs**: Collapsible accordion with PFH revisions, header bitmasks, and **Multiplayer Co-Op SHA-256 Checksums** with 1-click clipboard copy for multiplayer synchronization.

### 🌐 Topological DAG Auto-Sorter
- Implements Kahn's Algorithm to automatically resolve complex mod dependencies and prioritize core frameworks (e.g. Mixer, Community Bugfix Mod, SFO) in 1 click (**`⚡ Auto-Sort Order`**).

### 🎨 Pro Studio Dark UI & Zoom Isolation
- Clean custom UI design with custom dropdowns, custom modal dialogs, and zero OS default popup elements.
- **Isolated UI Zoom (<kbd>Ctrl</kbd> + <kbd>+</kbd> / <kbd>-</kbd> / Wheel)**: Scales the main workspace seamlessly while preserving native window controls and titlebar sizing.

---

## 🚀 Getting Started

### Prerequisites
- **Linux (Ubuntu, Debian, Fedora, Arch, SteamOS)** or **Windows 10/11**
- [Rust toolchain](https://rustup.rs/) (1.75+)
- [Node.js](https://nodejs.org/) (20.x+)
- Total War: WARHAMMER III installed via Steam

### Linux System Dependencies (Debian / Ubuntu)
```bash
sudo apt update && sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libssl-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```

### Fedora
```bash
sudo dnf install -y \
  webkit2gtk4.1-devel \
  openssl-devel \
  gtk3-devel \
  libappindicator-gtk3-devel \
  librsvg2-devel
```

### Arch Linux / Steam Deck Desktop Mode
```bash
sudo pacman -S --needed \
  webkit2gtk-4.1 \
  base-devel \
  openssl \
  gtk3 \
  libappindicator-gtk3 \
  librsvg
```

---

## 🏃 Running the Application

### One-Click Launch (Recommended)
Simply run the included launch script:
```bash
./start.sh
```
*On first run, this script automatically verifies dependencies, compiles the release binary if needed, configures the desktop environment, and opens the manager.*

### Windows Launch
Double-click `start.bat` or run:
```cmd
start.bat
```

---

## 🛠️ Development & Building

### Run in Live Development Mode (Hot Reloading)
```bash
# Install frontend packages
npm install

# Launch Tauri Development Environment
npm run tauri:dev
```

### Run Tests & Verification
```bash
# Frontend TypeScript check
npm run typecheck

# Frontend production build
npm run build

# Rust unit tests
cargo test --manifest-path src-tauri/Cargo.toml
```

### Build Standalone Release Package (.deb / binary)
```bash
npm run tauri:build
```
*Built Debian packages and standalone binaries will be placed in `src-tauri/target/release/bundle/`.*

---

## 📦 Automated Release & Version Control

To release a new version with automated multi-file version syncing and GitHub Actions packaging:

```bash
# Bump patch version (e.g. 2.0.0 -> 2.0.1) and create git tag
npm run release patch

# Or minor version (e.g. 2.0.0 -> 2.1.0)
npm run release minor

# Or major version (e.g. 2.0.0 -> 3.0.0)
npm run release major

# Push commit and tag to trigger GitHub Actions release workflow
git push origin main --tags
```

---

## ⌨️ Shortcuts & Hotkeys

| Keybinding | Action |
| :--- | :--- |
| <kbd>Ctrl</kbd> + <kbd>+</kbd> / <kbd>=</kbd> | Zoom UI In (+10%) |
| <kbd>Ctrl</kbd> + <kbd>-</kbd> | Zoom UI Out (-10%) |
| <kbd>Ctrl</kbd> + <kbd>0</kbd> | Reset UI Zoom (100%) |
| <kbd>Ctrl</kbd> + Mouse Wheel | Smooth Workspace Zoom |
| <kbd>Esc</kbd> | Close Slide-Over Inspector Drawer / Modal |
| Click on `#` Order Number | Type Numeric Position Directly on Mod Card |

---

## 📄 License
Distributed under the **MIT License**. See `LICENSE` for details.