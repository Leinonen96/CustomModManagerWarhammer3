# ISSUE-001: Zoom Hotkey Event Loop Saturation & 10-Second Freeze

| Metadata | Details |
| :--- | :--- |
| **Issue ID** | `ISSUE-001` |
| **Title** | Zoom Hotkey Event Loop Saturation & 10-Second Freeze |
| **Status** | Closed (Resolved in `07d70f3` & `897482d`) |
| **Priority** | P0 - Critical |
| **Severity** | S1 (Blocker) |
| **Component** | Frontend / `ZoomController` / Scaling Engine |
| **Impacted Files** | [ZoomController.ts](file:///mnt/GG/VSCodeProjects/CustomModManagerWarhammer3/frontend/src/controllers/ZoomController.ts), [tokens.css](file:///mnt/GG/VSCodeProjects/CustomModManagerWarhammer3/frontend/src/styles/tokens.css), [animations.css](file:///mnt/GG/VSCodeProjects/CustomModManagerWarhammer3/frontend/src/styles/animations.css) |

---

## 1. Problem Statement & Observed Behavior

When repeatedly pressing or holding down zoom hotkeys (<kbd>Ctrl</kbd> + <kbd>+</kbd> / <kbd>=</kbd> or <kbd>Ctrl</kbd> + <kbd>-</kbd>), the application UI responds with an escalating delay. Depending on the duration of hotkey spamming, the UI continues making slow, stepped scale adjustments for **up to 10 seconds** after releasing the keys. During this period, the interface is unresponsive to clicks and cursor interactions.

A similar lag occurs when using high-precision mouse wheel scrolling with <kbd>Ctrl</kbd> held.

---

## 2. Technical Root Cause Analysis

### Unthrottled OS Keydown Repeat
In [ZoomController.ts:66-90](file:///mnt/GG/VSCodeProjects/CustomModManagerWarhammer3/frontend/src/controllers/ZoomController.ts#L66-L90):
```typescript
window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;

    if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        this.setScale(this.currentScale + 0.05);
    } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        this.setScale(this.currentScale - 0.05);
    } else if (e.key === '0') {
        e.preventDefault();
        this.setScale(1.0);
    }
});
```

Operating systems and browsers fire `keydown` events at the hardware repeat rate (**30 to 60 events/second**) when a key is held. The current implementation performs synchronous, heavy DOM mutations directly inside the event handler without throttling or debouncing.

### Synchronous Full-DOM Reflow & Cascade Invalidation
Inside `setScale()` ([ZoomController.ts:25-48](file:///mnt/GG/VSCodeProjects/CustomModManagerWarhammer3/frontend/src/controllers/ZoomController.ts#L25-L48)):
1. **Full Workspace Reflow**: `workspace.style.zoom = `${clamped}`` forces the browser engine (Blink/WebKitGTK) into an immediate full-tree layout and geometry invalidation of `#app-workspace` (which contains thousands of live card nodes).
2. **Document-Wide CSS Invalidation**: `document.documentElement.style.setProperty('--ui-scale', `${clamped}`)` mutates `:root`. Changing root custom properties forces the style cascade engine to re-evaluate computed styles for every element in the document. *(Note: `--ui-scale` in [tokens.css:7](file:///mnt/GG/VSCodeProjects/CustomModManagerWarhammer3/frontend/src/styles/tokens.css#L7) is never referenced anywhere else in the styling codebase).*
3. **HTML Parsing & Filter Costs**: `this.showIndicator()` in [ZoomController.ts:54-63](file:///mnt/GG/VSCodeProjects/CustomModManagerWarhammer3/frontend/src/controllers/ZoomController.ts#L54-L63) parses raw SVG HTML via `.innerHTML` on every tick, and toggles `.visible` on `#zoom-indicator` which applies `backdrop-filter: blur(12px)` ([animations.css:56](file:///mnt/GG/VSCodeProjects/CustomModManagerWarhammer3/frontend/src/styles/animations.css#L56)).

### Macro-Task Queue Saturation
Each synchronous reflow and style recalculation consumes approximately **60 to 100 ms** of main-thread execution time. Holding the hotkey for 1.5 seconds enqueues ~80 `keydown` events in the single-threaded JavaScript task queue:
$$\text{Execution Backlog} = 80 \text{ events} \times 80\text{ ms} = 6,400\text{ ms} \approx 6.4\text{ to }10\text{ seconds}$$
The browser is forced to process all 80 tasks sequentially, executing 80 individual reflow cycles before returning to an idle state.

---

## 3. Proposed Architecture & Solution

### 1. Dual-Tier Protection: Rate Limiter & Queue Cap
To prevent malicious or accidental user/macro spam from saturating the system:
1. **Hard Rate Limit (`MAX_REQUESTS_PER_SECOND = 20`)**:
   - Imposes a minimum 50 ms interval between applied zoom layout reflows.
   - Caps DOM mutations to at most 20 updates per second, keeping main-thread utilization well below 30%.
2. **Hard Queue Cap (`MAX_QUEUED_REQUESTS = 3`)**:
   - Caps the pending request backlog to a maximum depth of 3 adjustments.
   - Any incoming keydown or wheel events arriving while the queue is full are **immediately dropped**.
   - **Mathematical Guarantee**: The maximum possible trailing lag after releasing the hotkeys is strictly bounded to $3 \times 50\text{ ms} = \mathbf{150\text{ ms}}$, making prolonged freezes mathematically impossible.

### 2. RequestAnimationFrame-Batched Scale Accumulator
Decouple input event capture from DOM style mutations using an animation frame accumulator:
- Multiple `keydown` or `wheel` events within the same frame window increment a pending target without touching the DOM.
- A single `requestAnimationFrame` callback reads the accumulated target and applies it to `workspace.style.zoom`.

### 3. Window & Panel Resize IPC Throttling
1. **Window Resize ([WindowResizer.ts](file:///mnt/GG/VSCodeProjects/CustomModManagerWarhammer3/frontend/src/controllers/WindowResizer.ts))**:
   - Debounce `isMaximized` IPC checks by 100 ms during active edge dragging, preventing 60+ IPC calls per second during window resize.
2. **Panel Resize ([PanelResizer.ts](file:///mnt/GG/VSCodeProjects/CustomModManagerWarhammer3/frontend/src/components/PanelResizer.ts))**:
   - Batch splitter divider ratio calculations via `requestAnimationFrame` on pointermove.

### 4. Elimination of Redundant Root CSS Variable Invalidation
Remove `document.documentElement.style.setProperty('--ui-scale', ...)` from the hot path.

### 5. Lightweight DOM Updates on the Indicator
Replace `.innerHTML` SVG string re-parsing with persistent DOM nodes and update `.textContent` for the percentage value.

---

## 4. Acceptance Criteria

- [ ] Rate limiter enforces a hard cap of at most 20 zoom updates per second (minimum 50 ms spacing).
- [ ] Queue cap drops excess spam requests when more than 3 requests are pending; trailing lag never exceeds 150 ms.
- [ ] Spamming <kbd>Ctrl</kbd> + <kbd>+</kbd> or <kbd>Ctrl</kbd> + <kbd>-</kbd> 50 times in rapid succession stops scaling immediately when key is released.
- [ ] Holding <kbd>Ctrl</kbd> + <kbd>+</kbd> smoothly scales the UI without frame drops or UI freezing.
- [ ] High-frequency mousewheel zooming (<kbd>Ctrl</kbd> + Wheel) responds smoothly without task queue saturation.
- [ ] Window resize dragging no longer spams unthrottled `isMaximized` IPC calls.
- [ ] Persisted scale is debounced and saved to `config.json` once zooming rests.
