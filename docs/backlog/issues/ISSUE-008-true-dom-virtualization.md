# ISSUE-008: Sliding-Window True DOM Virtualization Engine

| Metadata | Details |
| :--- | :--- |
| **Issue ID** | `ISSUE-008` |
| **Title** | Sliding-Window True DOM Virtualization Engine |
| **Status** | Proposed |
| **Priority** | P1 - High (Phase 2) |
| **Severity** | S2 (Major) |
| **Component** | Frontend / `ModListManager` / `VirtualScroller` |
| **Impacted Files** | [ModList.ts](file:///mnt/GG/VSCodeProjects/CustomModManagerWarhammer3/frontend/src/components/ModList.ts), [VirtualScroller.ts](file:///mnt/GG/VSCodeProjects/CustomModManagerWarhammer3/frontend/src/components/VirtualScroller.ts), [mod-card.css](file:///mnt/GG/VSCodeProjects/CustomModManagerWarhammer3/frontend/src/styles/mod-card.css), [components.css](file:///mnt/GG/VSCodeProjects/CustomModManagerWarhammer3/frontend/src/styles/components.css) |
| **Supersedes** | [ISSUE-002](file:///mnt/GG/VSCodeProjects/CustomModManagerWarhammer3/docs/backlog/issues/ISSUE-002-mod-list-virtualization-and-content-skipping.md) (`content-visibility: auto` CSS Virtualization) |

---

## 1. Problem Statement & Observed Behavior

On high-resolution displays (e.g. 4K at 3840×2160) and wide zoom ranges (80% to 120%), the mod manager viewport displays between 20 and 28 mods concurrently per column. When user libraries contain 300 to 600+ mods:
- Across both columns, **15,000 to 25,000 live DOM elements** and hundreds of decoded 72×72 image textures reside in memory simultaneously.
- While Phase 0 and Phase 1 optimizations (zoom debouncing, hover transition cleanup, textContent reflow elimination, and keyed in-place DOM reconciliation) significantly improved UI responsiveness, **high-speed scrolling in 4K fullscreen still produces noticeable frame drops and compositor stutter** in WebKitGTK under Linux/X11/Wayland.
- In WebKitGTK, off-screen rasterization and compositing overhead scale directly with the total height and element count of the scroll layer, even when elements are outside the viewport.

---

## 2. Why CSS Virtualization (`content-visibility: auto`) Failed

Backlog item [ISSUE-002](file:///mnt/GG/VSCodeProjects/CustomModManagerWarhammer3/docs/backlog/issues/ISSUE-002-mod-list-virtualization-and-content-skipping.md) previously proposed native CSS virtualization via `content-visibility: auto`. Empirical testing revealed critical flaws in WebKitGTK:
1. **Zero Lookahead / Pre-render Margin**: WebKitGTK does not pre-render off-screen items ahead of the scroll boundary. Cards entering the viewport appear as blank fallback boxes for several frames before child layouts and images are rendered.
2. **Synchronous Main-Thread Layout Spikes**: As items cross the viewport threshold, WebKitGTK executes synchronous style recalculations and layout passes on the main thread, resulting in severe micro-stutter (sub-30 FPS).
3. **Scrollbar Thrashing**: Small discrepancies between `contain-intrinsic-size` and dynamic card heights cause jittery scrollbar behavior.

**Conclusion**: Native CSS `content-visibility` is unsuitable for WebKitGTK. The application requires **True DOM Virtualization** (sliding window), where off-screen DOM nodes are physically detached and only visible elements plus an overscan buffer exist in the DOM tree.

---

## 3. Architecture & Technical Design

### A. Fixed-Stride O(1) Geometry
Every `.mod-item` card adheres to a rigid, predictable layout:
- Content height: 72px (thumbnail + metadata)
- Vertical padding: 6px top + 6px bottom = 12px
- Border: 1px top + 1px bottom = 2px
- Total card box height = **86px**
- Margin bottom = **4px**
- **Total Item Stride = 90px**

Because card stride is fixed at exactly 90px, item positions and visible slices can be computed in **$O(1)$ constant time** using arithmetic without querying `getBoundingClientRect()` or triggering forced synchronous reflows:
$$\text{startIndex} = \max\left(0, \left\lfloor \frac{\text{scrollTop}}{\text{itemStride}} \right\rfloor - \text{overscan}\right)$$
$$\text{endIndex} = \min\left(N, \left\lceil \frac{\text{scrollTop} + \text{clientHeight}}{\text{itemStride}} \right\rceil + \text{overscan}\right)$$

### B. Top and Bottom Spacer Technique
Inside each scroll container (`#inactive-mods-list` and `#active-mods-list`), two lightweight spacer `div` elements maintain full container scroll height:
```html
<div class="mod-list" id="active-mods-list">
    <div class="virtual-spacer-top" style="height: 1800px;"></div>
    <!-- Only visible 25-35 .mod-item elements rendered here -->
    <div class="virtual-spacer-bottom" style="height: 3600px;"></div>
</div>
```
- Total scrollable height = $N \times 90\text{px}$.
- Native OS/browser scrollbars maintain authentic thumb sizing and smooth continuous scrolling.
- Zero layout jumping or scroll snapping.

### C. Overscan Buffer
To guarantee that fast wheel scrolling and trackpad gestures never expose blank white/dark gaps:
- An overscan margin of **6 to 8 items** is rendered above and below the visible viewport.
- At 4K fullscreen (24 visible cards), the total active DOM nodes per list remains capped at **~36 to 40 cards** (down from 400+).
- Memory footprint drops by **>85%**, and layout recalculation time drops from 30ms to <1ms.

### D. The SortableJS Drag-and-Drop Integration (Auto-Suspension Pattern)
The greatest challenge in virtualizing reorderable lists is SortableJS compatibility:
- SortableJS relies on querying physical DOM siblings to calculate insertion slots and auto-scroll behavior.
- If off-screen items are missing from the DOM during a drag operation, cross-list transfers and scrolling to bottom/top fail or drop into invalid positions.

**The Solution: Drag-Time Virtualization Suspension**:
1. **Idle / Scrolling Mode**: Virtualization is fully active. Only visible cards + overscan are in the DOM. High-speed 120 FPS scrolling is achieved.
2. **Drag Start (`onStart`)**:
   - The virtualizer detects `isDragging = true`.
   - Both containers temporarily mount all items from the active/inactive lists.
   - Spacers collapse to `height: 0px`.
   - SortableJS possesses 100% full native DOM access to every card and drop slot.
3. **Drag End (`onEnd`)**:
   - Store load order is updated.
   - `isDragging = false`.
   - Spacers and virtual slicing immediately reactivate at the current scroll position.
   - Transition is seamless and invisible to the user because users drag at mouse-pointer speed, not 3,000px/s scroll speeds.

### E. Data-Layer Search & Filtering
Instead of keeping 400 hidden DOM nodes with `.mod-item-hidden`:
- Search filters are applied directly to the in-memory array (`activeMods` or `inactiveMods`).
- The virtualizer uses `filteredItems.length` as the total count.
- Virtual window slices only matching items. Search filtering executes in <1ms without any DOM iteration.

### F. DOM Node Pooling via Existing `cardCache`
- Cards sliding out of view are detached from the DOM but retained in `ModListManager.cardCache`.
- Cards entering view are pulled from `cardCache` and refreshed via `updateModCardState()`.
- Zero garbage collection pressure or image texture re-decoding.

---

## 4. Acceptance Criteria

- [ ] Mod list scrolling maintains solid **60–120 FPS** on 4K displays at both minimum (80%) and maximum (160%) zoom levels.
- [ ] Number of live `.mod-item` DOM elements per container is strictly bounded between **25 and 45 items**, regardless of total mod count (tested with 500+ mods).
- [ ] SortableJS drag-and-drop between Active and Inactive lists functions with zero missing drop targets or positioning errors.
- [ ] Reordering active mods by dragging from top to bottom through the entire list functions smoothly.
- [ ] Native scrollbar thumb accurately reflects total collection size and does not jitter or jump during scrolling.
- [ ] Programmatic scrolling (e.g. `highlightCard()` after inject, top, or bottom action) accurately mounts and focuses the target card.
- [ ] Instant search filtering response time (<5ms) across 1,000 mods.
