# Product Vision & Engineering Principles

## 1. Vision Statement

Total War: WARHAMMER III Mod Manager is a deterministic mod manager and diagnostic tool for mod collections. 

The goal is to provide diagnostic visibility into mod packfiles and reliable load order automation without unnecessary dependencies or telemetry.

---

## 2. Core Engineering Principles

### A. Asynchronous Backend Operations
- Disk I/O and binary pack structure parsing are executed in native Rust threads.
- In-memory caching keyed on file modification times (`mtime`) minimizes repeated filesystem scans.
- DOM element reconciliation avoids unnecessary layout recalculations.

### B. Deterministic Load Ordering
- Load ordering is governed by a directed acyclic graph (DAG) topological sort.
- Mod pinning and persistent user rules always take precedence over automated heuristics.
- Surfaces binary file collisions directly according to the game engine's execution order.

### C. Cross-Platform Parity Without Compatibility Layers
- Native execution on both **Linux (desktop and SteamOS / Steam Deck)** and **Windows 10/11** without relying on Wine or Proton translation layers for the manager application.

### D. Minimalist Dependencies & File-Based Storage
- Configuration and presets are stored in human-readable JSON files (`config.json`, `presets.json`).
- Tauri v2 IPC provides the boundary between backend filesystem operations and the frontend presentation layer.

---

## 3. Scope & Non-Goals

### In Scope
- Mod list management (activation, deactivation, filtering, searching).
- Load order serialization to `user.script.txt` and symlink creation in the game data directory.
- Binary pack header parsing and conflict matrix generation.
- Topological DAG sorting with manual anchor pinning and override rules.
- Preset management and atomic backups.

### Explicit Non-Goals
- Replacing the Steam Workshop downloader or managing Workshop subscriptions directly.
- Embedded relational database engines.
- Cloud synchronization or proprietary account systems.
- Background services or persistent daemons.