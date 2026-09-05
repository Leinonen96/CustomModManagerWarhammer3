# System Architecture - Total War: WARHAMMER III Mod Manager

## 1. Overview & Architectural Stack

The Total War: WARHAMMER III Mod Manager is a high-performance, deterministic desktop application built on **Tauri v2**, **Rust**, and **TypeScript** (Vanilla CSS without UI framework runtimes). It delivers sub-millisecond mod inspection, topological load order sorting, real-time filesystem synchronization, and binary conflict diagnostics.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          TAURI v2 DESKTOP APPLICATION                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  PRESENTATION LAYER (TypeScript / Vanilla CSS / Vite)                       │
│  • TitleBar: Custom frameless window controls, update badge & zoom indicator│
│  • HeaderControls: Preset manager, search/filter bar, deploy & launch buttons│
│  • ModList: Keyed DOM reconciliation & drag-and-drop ordering (SortableJS)  │
│  • InspectorDrawer: Conflict matrix, override rules & packfile virtual tree │
│  • Modals: SettingsModal (paths/Proton), UpdateModal, CustomSelect, Toast   │
├─────────────────────────────────────────────────────────────────────────────┤
│  CONTROLLER & REACTIVE STATE LAYER                                          │
│  • AppStore: Centralized pub/sub reactive store (mods, conflicts, presets)  │
│  • SyncController: Debounced FS sync & live workshop event listener         │
│  • UpdateController: In-app GitHub release verification & updater lifecycle│
│  • ZoomController & WindowResizer: Dynamic UI scaling & custom window bounds│
├─────────────────────────────────────────────────────────────────────────────┤
│  TYPED API & IPC BRIDGE (tauri-apps/api/core)                               │
│  • 16 Typed IPC Commands (modApi, loadOrderApi, conflictApi, presetApi)    │
│  • Tauri Event Stream: `workshop://changed` push notifications              │
│  • Tauri Plugins: updater, dialog, fs, shell, process, assetProtocol        │
├─────────────────────────────────────────────────────────────────────────────┤
│  BACKEND CORE SERVICES (Rust / `src-tauri/src`)                             │
│  • pack_parser: Binary PFH header parser, mtime cache & collision matrix    │
│  • dependency_engine: Topological DAG sort, Kahn's algorithm & heuristics   │
│  • workshop_watcher: Background `notify` thread watching Workshop downloads │
│  • path_detector: Linux Proton prefix, Steam library VDF & Windows discovery│
│  • game_integrator: `user.script.txt` atomic rotation & symlink manager     │
│  • preset_repository & config_store: JSON persistence & user override rules │
│  • domain & error: Strongly typed models (`Mod`, `ConflictReport`, `AppError`)│
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Architectural Subsystems

### A. Backend Services (`src-tauri/src/services/`)
* **`PackParser` (`pack_parser.rs`)**:
  - Parses binary Total War PFH2, PFH3, PFH4, and PFH5 packfiles.
  - Decodes headers, file count offsets, compression bitmasks, and internal virtual directory paths.
  - Implements in-memory `mtime` caching to eliminate redundant disk I/O on unchanged packs.
  - Generates fast collision indexes for conflict visualizers.
* **`DependencyEngine` (`dependency_engine.rs`)**:
  - Models mod ordering as a Directed Acyclic Graph (DAG).
  - Resolves Kahn's topological sort using a 5-tier decision hierarchy (Pinned Slots $\rightarrow$ User Overrides $\rightarrow$ Framework Dependencies $\rightarrow$ Triple-Check Micro-Patch Heuristics $\rightarrow$ ASCII Tie-Breakers).
* **`WorkshopWatcher` (`workshop_watcher.rs`)**:
  - Runs a background thread using the `notify` crate to watch the Steam Workshop content directory (`1142710`).
  - Emits `workshop://changed` IPC events when mods are subscribed, updated, or removed in Steam.
* **`PathDetector` (`path_detector.rs`)**:
  - Autodetects Steam installation libraries across multiple physical drives via `libraryfolders.vdf`.
  - Discovers Linux Steam Proton compatdata paths (`~/.local/share/Steam/.../compatdata/1142710/pfx/`) and native Windows paths (`%APPDATA%/The Creative Assembly/Warhammer3/scripts/`).
* **`GameIntegrator` (`game_integrator.rs`)**:
  - Deploys the active load order to `user.script.txt` with atomic backup rotation (`user.script.txt.bak`).
  - Manages data directory symlinks/hardlinks for movie packs.
* **`PresetRepository` & `ConfigStore` (`preset_repository.rs`, `config_store.rs`)**:
  - Manages atomic JSON serialization for mod presets and user configuration (`config.json`).

---

### B. Frontend Architecture (`frontend/src/`)
* **Reactive State Store (`state/store.ts`)**:
  - Centralized single source of truth (`AppStore`) utilizing a lightweight publish-subscribe pattern.
  - Manages active mod list, search filters, selected mod, active preset, conflict reports, and updater states.
* **Controller Subsystem (`controllers/`)**:
  - **`SyncController`**: Subscribes to `workshop://changed` events, debouncing filesystem changes to refresh mod cards and re-run conflict analysis without blocking the UI.
  - **`UpdateController`**: Handles self-updater checks against GitHub Releases, parses release notes, tracks download progress, and triggers in-place application relaunches.
  - **`ZoomController`**: Controls UI scaling via CSS custom properties and keyboard shortcuts (`Ctrl + + / - / 0`).
  - **`WindowResizer`**: Manages frameless window state (minimize, maximize, restore, close) via Tauri window APIs.
* **Keyed DOM Reconciliation**:
  - Mod cards in `ModList.ts` use stable DOM element references keyed by mod ID to reorder indices and badges in-place without rebuilding elements or re-fetching image assets.

---

### C. IPC & Security Interface

#### Registered Tauri IPC Commands
| Module | Command | Purpose |
| :--- | :--- | :--- |
| **Config** | `get_config`, `save_config` | Read/write application settings & user override rules |
| **Paths** | `detect_paths`, `validate_paths` | Autodetect and validate Steam, Workshop, and game data paths |
| **Mods** | `get_mods`, `apply_load_order`, `auto_sort_dependencies`, `launch_game` | Fetch mods, write `user.script.txt`, run DAG sort, and launch game |
| **Presets** | `list_presets`, `load_preset`, `save_preset`, `delete_preset` | CRUD operations on mod configuration profiles |
| **Diagnostics** | `analyze_load_order_conflicts`, `get_pack_file_tree` | Full matrix collision analysis and virtual directory tree inspection |
| **System** | `open_url`, `open_path` | Secure OS shell execution for URLs and folders |

#### Tauri Plugins & Asset Protocol
* `tauri-plugin-updater`: In-app updates with Minisign Ed25519 public key validation.
* `assetProtocol`: Securely streams local workshop preview images via `asset://` directly into `<img>` tags without base64 overhead.

---

## 3. Asynchronous Event & Data Flow

```
[ Steam Client ]
       │ (Downloads/Updates Mod)
       ▼
[ Disk: /workshop/content/1142710/ ]
       │
       ▼
[ WorkshopWatcher (Rust / notify) ] ── (Tauri IPC: "workshop://changed") ──┐
                                                                           │
                                                                           ▼
[ AppStore (TypeScript) ] ◄─── (Debounced Refresh) ──── [ SyncController ]
       │
       ├──► Updates ModList (In-Place Keyed DOM Reorder)
       │
       └──► Requests Conflict Analysis ──► [ PackParser (Rust) ]
                                                   │
                                                   ▼
[ InspectorDrawer ] ◄────────────────── Returns ConflictReport
```

---

## 4. Documentation References
* **[Load Order Engine & Decision Logic](LOAD_ORDER_ENGINE.md)**: Full specification on Kahn's DAG algorithm, Triple-Check heuristics, and collision classifications.
* **[Frontend Design System & Styling](DESIGN_SYSTEM.md)**: Design tokens, layout containment, and component classes.
* **[Product Vision & Principles](vision.md)**: Engineering constraints and non-goals.