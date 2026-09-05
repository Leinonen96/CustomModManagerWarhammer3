# Development Roadmap & Release Milestones

This document tracks completed milestones and planned features for the Total War: WARHAMMER III Mod Manager.

---

## Architecture & Version History

### Version 2.0.0 — Binary PFH Parsing & In-App Collision Matrix
- [x] In-memory binary PFH packfile parser (PFH5, PFH4, PFH3, PFH2).
- [x] File collision matrix classification (`FatalStartpos`, `ScriptOverride`, `UIOverride`, `DBCollision`, `HarmlessMerge`).
- [x] Slide-over Inspector Drawer with file manifest tree, hash inspection, and collision diff view.
- [x] SHA256 deterministic pack hashing and cached `mtime` invalidation.

### Version 2.1.0 — Auto-Updater & Linux Packaging
- [x] Integrated Tauri v2 auto-updater with GitHub Releases endpoint.
- [x] Cross-platform build packaging (`.deb`, `.AppImage`, NSIS `.exe`).
- [x] In-app release notes modal with update progress indicator.
- [x] XDG Base Directory config migration (`~/.config/wh3-mod-manager/`).

### Version 2.2.0 — Dependency DAG & Mod Pinning Engine
- [x] Topological DAG dependency sorting using Kahn's algorithm with ASCII priority queues.
- [x] Mod Pinning: Lock foundational mods (Mixer, Community Bugfix Mod) to fixed slots.
- [x] Persistent User Override Rules (`Mod A loads above/below Mod B`) saved from the conflict inspector.
- [x] Triple-Check Micro-Patch & Character Replacer heuristics ($\le 25$ scale, $\ge 3\times$ disparity, $\ge 50\%$ or $\ge 4$ files overlap).
- [x] Inline numeric order badge editing with keyboard navigation (<kbd>Enter</kbd> to apply, <kbd>Esc</kbd> to cancel).
- [x] Custom context menu for rapid mod prioritization and file inspection.

---

## Planned Future Milestones

### Version 2.3.0 — Mod Profiles & Advanced Export
- [ ] Shareable mod preset export and import (compressed JSON / URL sharing string).
- [ ] Missing mod detection on preset import with direct Steam Workshop subscription links.
- [ ] Mod categorization tags (Overhaul, Graphics, UI, Balance, Faction-Specific).

### Version 2.4.0 — Performance & Diagnostic Telemetry
- [ ] Schema table row count comparison for conflicting DB tables.
- [ ] Pack health audit tool (detect empty packs, invalid compression flags, missing localization strings).
- [ ] Batch preset comparison diff tool.
- [ ] Performance & DOM Optimization Backlog ([docs/backlog/README.md](file:///mnt/GG/VSCodeProjects/CustomModManagerWarhammer3/docs/backlog/README.md)):
  - [ISSUE-001: Zoom Hotkey Event Loop Saturation & 10-Second Freeze](file:///mnt/GG/VSCodeProjects/CustomModManagerWarhammer3/docs/backlog/issues/ISSUE-001-zoom-hotkey-event-loop-saturation.md)
  - [ISSUE-002: Mod List 120 FPS Scroll Engine (CSS Virtualization & Hover Paint Suppression)](file:///mnt/GG/VSCodeProjects/CustomModManagerWarhammer3/docs/backlog/issues/ISSUE-002-mod-list-virtualization-and-content-skipping.md)
  - [ISSUE-004: StudioTooltip Mid-Scroll DOM Mutation & Capture Invalidation](file:///mnt/GG/VSCodeProjects/CustomModManagerWarhammer3/docs/backlog/issues/ISSUE-004-studio-tooltip-mid-scroll-dom-mutation.md)
  - [ISSUE-005: Forced Synchronous Layout Thrashing in Order Synchronization](file:///mnt/GG/VSCodeProjects/CustomModManagerWarhammer3/docs/backlog/issues/ISSUE-005-layout-thrashing-order-number-updates.md)
  - [ISSUE-006A: Fast Pre-Normalized Sort Comparator](file:///mnt/GG/VSCodeProjects/CustomModManagerWarhammer3/docs/backlog/issues/ISSUE-006A-fast-prenormalized-sort-comparator.md)
  - [ISSUE-006B: Keyed In-Place DOM Reconciliation](file:///mnt/GG/VSCodeProjects/CustomModManagerWarhammer3/docs/backlog/issues/ISSUE-006B-keyed-inplace-dom-reconciliation.md)
  - [ISSUE-007: Excessive DOM Node Density & Inline SVG Vector Duplication](file:///mnt/GG/VSCodeProjects/CustomModManagerWarhammer3/docs/backlog/issues/ISSUE-007-dom-node-density-inline-svg-overhead.md)