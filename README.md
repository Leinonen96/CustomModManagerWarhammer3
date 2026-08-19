# Total War: WARHAMMER III Mod Manager

[![CI](https://github.com/Leinonen96/CustomModManagerWarhammer3/actions/workflows/ci.yml/badge.svg)](https://github.com/Leinonen96/CustomModManagerWarhammer3/actions/workflows/ci.yml)
[![Release](https://github.com/Leinonen96/CustomModManagerWarhammer3/actions/workflows/release.yml/badge.svg)](https://github.com/Leinonen96/CustomModManagerWarhammer3/actions/workflows/release.yml)
[![Rust](https://img.shields.io/badge/Rust-1.75%2B-orange?logo=rust)](https://www.rust-lang.org/)
[![Tauri v2](https://img.shields.io/badge/Tauri-v2-blue?logo=tauri)](https://v2.tauri.app/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

A high-performance desktop mod manager and diagnostic utility for **Total War: WARHAMMER III**, built with **Rust**, **Tauri v2**, and **TypeScript**.

Engineered for large mod collections (100–500+ mods), providing real-time binary PFH pack inspection, topological DAG load order sorting, collision diffing, and native Linux/SteamOS and Windows support.

---

## Technical Overview

### Binary PFH Pack Parser & Collision Engine
- **In-Memory Binary Parser**: Reads Total War PFH5, PFH4, and PFH3 file headers, index tables, and compression bitmasks using buffered binary streams with in-memory `mtime` cache invalidation.
- **Collision Matrix Analysis**: Classifies cross-pack asset collisions into distinct risk tiers:
  - `FatalStartpos`: Detects `startpos.esf` collisions across multiple active campaign overhauls.
  - `ScriptOverride` / `UIOverride`: Identifies winning and overridden `.lua` scripts and `.twui.xml` layouts based on exact `user.script.txt` execution hierarchy.
  - `DBCollision` & `HarmlessMerge`: Differentiates conflicting schema keys from safe additive table extensions.
  - `MoviePack`: Flags packs that bypass `user.script.txt` and load directly via engine mechanics.

### Topological DAG Dependency Engine
- **Kahn's Algorithm Sorting**: Implements directed acyclic graph (DAG) topological sorting with case-insensitive ASCII priority queues.
- **Mod Pinning Anchors**: Allows users to freeze specific framework mods (e.g. Mixer, Community Bugfix Mod) to exact 1-indexed slots while remaining mods dynamically sort around them.
- **Persistent User Override Rules**: Permanent relative ordering rules (`Mod A loads above/below Mod B`) saved from the conflict inspector and prioritized during automatic sorting.
- **Triple-Check Submod Heuristics**: Evaluates file scale, disparity ratios ($\ge 3\times$), and containment percentages ($\ge 50\%$) to automatically prioritize character replacers and micro-patches above parent overhauls.

### Direct Game Launching
- **Engine Bypass Execution**: Launches the game directly via Steam Proton / native arguments using the last deployed configuration, bypassing external launcher overhead.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          TAURI v2 APPLICATION                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  FRONTEND (TypeScript / Vanilla CSS)                                        │
│  • ModList: Keyed DOM node reconciliation with 120 FPS drag-and-drop        │
│  • InspectorDrawer: Packfile breakdown & visual collision diff viewer       │
│  • SettingsModal: Native path detection & custom rule management            │
├─────────────────────────────────────────────────────────────────────────────┤
│  IPC BRIDGE (@tauri-apps/api)                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  BACKEND (Rust)                                                             │
│  • pack_parser: Fast binary PFH pack indexer & collision detector          │
│  • dependency_engine: Topological DAG solver & rule injector                │
│  • load_order_service: Atomic user.script.txt generation & symlink manager  │
│  • game_launcher: Direct Warhammer3.exe Steam Proton execution             │
└─────────────────────────────────────────────────────────────────────────────┘
```

For detailed specifications, see:
- [Load Order Engine & Decision Logic](docs/LOAD_ORDER_ENGINE.md)
- [System Architecture](docs/system-architecture.md)
- [Design System](docs/DESIGN_SYSTEM.md)

---

## Installation & Requirements

### System Requirements
- **Linux** (Debian, Ubuntu, Fedora, Arch Linux, SteamOS / Steam Deck) or **Windows 10/11**
- Total War: WARHAMMER III installed via Steam
- [Rust toolchain](https://rustup.rs/) (1.75+)
- [Node.js](https://nodejs.org/) (20.x+)

### Linux Build Dependencies

#### Debian / Ubuntu
```bash
sudo apt update && sudo apt install -y \
  libwebkit2gtk-4.1-dev build-essential curl wget file \
  libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev
```

#### Fedora
```bash
sudo dnf install -y \
  webkit2gtk4.1-devel openssl-devel gtk3-devel \
  libappindicator-gtk3-devel librsvg2-devel
```

#### Arch Linux / Steam Deck (Desktop Mode)
```bash
sudo pacman -S --needed \
  webkit2gtk-4.1 base-devel openssl gtk3 libappindicator-gtk3 librsvg
```

---

## Building and Running

### Development Mode
```bash
npm install
npm run tauri:dev
```

### Verification & Testing
```bash
# Typecheck TypeScript
npm run typecheck

# Build frontend production bundle
npm run build

# Run Rust unit tests
cargo test --manifest-path src-tauri/Cargo.toml
```

### Release Build
```bash
npm run tauri:build
```
Production binaries and packages are generated in `src-tauri/target/release/bundle/`.

---

## Keybindings

| Keybinding | Action |
| :--- | :--- |
| <kbd>Ctrl</kbd> + <kbd>+</kbd> / <kbd>=</kbd> | Zoom UI in (+10%) |
| <kbd>Ctrl</kbd> + <kbd>-</kbd> | Zoom UI out (-10%) |
| <kbd>Ctrl</kbd> + <kbd>0</kbd> | Reset UI zoom (100%) |
| <kbd>Ctrl</kbd> + Mouse Wheel | Workspace zoom |
| <kbd>Esc</kbd> | Close inspector drawer or active modal |
| Click `#` order badge | Inline numeric position editing |

---

## License

Distributed under the **MIT License**. See `LICENSE` for details.