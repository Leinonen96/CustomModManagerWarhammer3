# System Architecture - Total War: WARHAMMER III Mod Manager

## 1. Overview

The Total War: WARHAMMER III Mod Manager is a cross-platform desktop application built with **Tauri v2**, **Rust**, and **TypeScript** (Vanilla CSS without UI framework runtimes). It provides diagnostic inspection and load order management for Total War mod collections.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          TAURI v2 APPLICATION                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  FRONTEND (TypeScript / Vite / Vanilla CSS)                                 │
│  • ModList & Keyed DOM Reconciliation (Drag & Drop via SortableJS)          │
│  • InspectorDrawer: Conflict Visualizer & Diff Viewer                       │
│  • HeaderControls: Preset Manager & Load Order Deployment                   │
│  • ContextMenu & CustomSelect: Lightweight DOM Elements                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  IPC BRIDGE: @tauri-apps/api/core (tauriInvoke)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  BACKEND CORE (Rust)                                                        │
│  • pack_parser: Binary PFH Packfile Parser & Collision Matrix Engine        │
│  • dependency_engine: Topological DAG Sorter & Heuristic Resolver           │
│  • game_integrator: user.script.txt Deployment & Atomic Backup Manager       │
│  • config_store: Settings Persistence & User Override Rules                 │
│  • workshop_scanner: Steam Workshop Discovery & Thumbnail Extraction        │
│  • preset_repository: Preset Management & Serialization                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Architectural Components

### A. Backend (`src-tauri` / Rust)
* **Binary Pack Parsing**: Reads Total War PFH5/PFH4/PFH3/PFH2 header structures, bitmasks, compression flags, and internal virtual file paths using buffered binary streams with in-memory modification time (`mtime`) caching.
* **Topological DAG Engine**: Computes deterministic dependency graphs with support for:
  - Pinned mod anchors (`pinned_mods`).
  - Persistent user relative override rules (`user_rules.json` stored in config).
  - Triple-Check micro-patch heuristic elevation.
* **Platform Path Handling**: Resolves Windows paths, Linux filesystem paths, and Steam Proton prefix paths.

### B. Frontend (`frontend/src` / TypeScript)
* **Vanilla Architecture**: Built with TypeScript and CSS without frontend framework runtimes.
* **Keyed Card DOM Reconciliation**: Updates indices and order badges on existing DOM elements in-place to avoid unneeded repaints and maintain decoded image caches.
* **Conflict Inspection Drawer**: Side-by-side collision viewer presenting winning files, overridden files, startpos conflicts, and relative priority reordering.

---

## 3. Documentation References

For detailed domain specifications:
* **[Load Order Engine & Decision Logic](docs/LOAD_ORDER_ENGINE.md)**: Details on Total War engine precedence, Kahn's algorithm, Triple-Check heuristics, and conflict severity.
* **[Frontend Design System & Styling](docs/DESIGN_SYSTEM.md)**: CSS design tokens, geometry, and component class contracts.
* **[Product Vision & Principles](docs/vision.md)**: Architectural goals and scope boundaries.