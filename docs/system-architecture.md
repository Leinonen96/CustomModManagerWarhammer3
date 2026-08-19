# System Architecture - Total War: WARHAMMER III Mod Manager

## 1. Overview

The Total War: WARHAMMER III Mod Manager is a lightweight, high-performance, cross-platform desktop application built with **Tauri v2**, **Rust**, and **TypeScript** (Vanilla CSS / zero runtime UI framework overhead). It is designed for fast startup, low memory usage, and robust load order management for mod collections.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          TAURI v2 APPLICATION                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  FRONTEND (TypeScript / Vite / Vanilla CSS)                                 │
│  • ModList & Keyed DOM Reconciliation (Drag & Drop via SortableJS)          │
│  • InspectorDrawer: Real-Time Conflict Visualizer & Diff Viewer             │
│  • HeaderControls: Preset Manager & Direct Steam Proton Game Launcher       │
│  • Tooltip & Dropdown Engine: Lightweight Custom Elements                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  IPC BRIDGE: @tauri-apps/api/core (tauriInvoke)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  BACKEND CORE (Rust)                                                        │
│  • pack_parser: Fast Binary PFH5 Packfile Parser & Collision Matrix Engine  │
│  • dependency_engine: Topological DAG Sorter + Micro-Patch Auto-Resolver    │
│  • load_order_service: user.script.txt Deployment & Atomic Backup Manager   │
│  • config_store: Cross-Platform Path Detection & Persistent User Rules      │
│  • game_launcher: Direct Warhammer3.exe Steam Proton Execution              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Architectural Pillars

### A. Backend (`src-tauri` / Rust)
* **High-Throughput Binary Parsing**: Directly parses Total War PFH5 header structures, bitmasks, compression flags, and file paths using zero-allocation binary parsing and asynchronous background task workers.
* **Topological DAG Engine**: Computes deterministic dependency graphs with support for:
  - Pinned mod anchors (`pinned_mods`).
  - Persistent user relative override rules (`user_rules.json`).
  - Triple-Check micro-patch heuristic elevation.
* **Proton / Linux & Windows Compatibility**: Handles Windows backslashes, Linux forward slashes, and Proton Steam prefix paths transparently.

### B. Frontend (`frontend/src` / TypeScript)
* **Framework-Free Vanilla Architecture**: Built with standard TypeScript and Vanilla CSS without heavy UI runtime frameworks (no React, Vue, or Electron runtime overhead).
* **Keyed Card DOM Reconciliation**: Reuses existing DOM nodes during list re-ordering to maintain image decode caches and eliminate layout reflows.
* **Conflict Inspection Drawer**: Side-by-side collision visualizer showing winning files, overridden files, startpos fatal collisions, and one-click priority re-ordering.

---

## 3. Documentation References

For in-depth domain specifications, refer to:
* **[Load Order Engine & Decision Logic](docs/LOAD_ORDER_ENGINE.md)**: Full breakdown of Total War engine precedence, Kahn's algorithm, Triple-Check heuristics, and conflict severity.
* **[Frontend Design System & Styling](docs/DESIGN_SYSTEM.md)**: CSS design tokens, geometry, and component class contracts.
* **[Product Vision & Principles](docs/vision.md)**: Architectural goals and scope boundaries.