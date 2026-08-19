# Product Vision & Engineering Principles

## 1. Vision Statement

Total War: WARHAMMER III Mod Manager is a fast, deterministic, and lightweight mod manager designed specifically for heavy mod loadouts (100–500+ mods). 

The goal is to provide deep diagnostic visibility into mod packfiles and reliable load order automation without unnecessary bloat, telemetry, or complex database dependencies.

---

## 2. Core Engineering Principles

### A. Performance First
- **Zero UI Lag**: Operations that touch the disk or parse binary pack structures are executed asynchronously in native Rust threads.
- **Efficient DOM Management**: Card lists use DOM element reconciliation to eliminate unnecessary reflows and retain image decoding caches.
- **Fast Startup & Scanning**: Binary pack scanning uses in-memory caching keyed on file modification times (`mtime`), scanning hundreds of mods in milliseconds.

### B. Deterministic & Transparent Load Ordering
- **Graph-Based Resolution**: Load ordering is governed by a directed acyclic graph (DAG) topological sort, ensuring predictable outcomes.
- **User Control**: Automated heuristics never override explicit user choices; mod pinning and persistent user rules always take precedence.
- **Clear Conflict Visibility**: The manager surfaces binary file collisions directly, showing which pack wins or loses according to the game engine's execution order.

### C. Cross-Platform Native Parity
- First-class support for both **Linux (native and SteamOS / Steam Deck)** and **Windows 10/11**.
- Direct game execution through Steam / Proton without relying on proprietary launcher frontends.

### D. Minimalist Dependencies & Open Architecture
- **No Database Overhead**: State is stored in clean, human-readable JSON files (`config.json`, `presets.json`).
- **Standardized IPC**: Tauri v2 inter-process communication provides a clear boundary between backend filesystem operations and the frontend presentation layer.

---

## 3. Scope & Non-Goals

### In Scope
- Fast mod list management (activation, deactivation, filtering, searching).
- Load order serialization to `user.script.txt`.
- Binary pack header parsing and conflict matrix generation.
- Topological DAG sorting with manual anchor pinning and override rules.
- Direct Steam/Proton game launching.
- Preset management and atomic backups.

### Explicit Non-Goals
- Replacing the Steam Workshop downloader or managing Workshop subscriptions directly.
- Complex database engines (e.g. SQLite, PostgreSQL).
- Cloud synchronization or proprietary account systems.
- Heavy background services or always-running daemon processes.