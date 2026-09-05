# ISSUE-001: Zoom Hotkey Event Loop Saturation & 10-Second Freeze

| Metadata | Details |
| :--- | :--- |
| **Issue ID** | `ISSUE-001` |
| **Title** | Zoom Hotkey Event Loop Saturation & 10-Second Freeze |
| **Status** | Open |
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

### 1. RequestAnimationFrame-Batched Scale Accumulator
Decouple input event capture from DOM style mutations using an animation frame accumulator:
- Multiple `keydown` or `wheel` events within the same 16 ms render window will only increment a `pendingScale` target.
- A single `requestAnimationFrame` callback reads the accumulated target, clamps it, and applies it to `workspace.style.zoom` at most once per display frame.

### 2. Elimination of Redundant Root CSS Variable Invalidation
Remove `document.documentElement.style.setProperty('--ui-scale', ...)` from the hot path. If `--ui-scale` is needed in the future, apply it only after user interaction rests.

### 3. Lightweight DOM Updates on the Indicator
Replace `.innerHTML` SVG string re-parsing with persistent DOM nodes and update `.textContent` for the percentage value.

```typescript
// Proposed implementation in ZoomController.ts
export class ZoomController {
    private currentScale: number = 1.0;
    private targetScale: number = 1.0;
    private rafId: number | null = null;
    private saveDebounceTimeout: any = null;
    private indicatorValueEl!: HTMLElement;

    private applyScaleBatched(newScale: number, persist = true): void {
        this.targetScale = Math.round(Math.min(Math.max(newScale, 0.70), 1.60) * 100) / 100;

        if (this.rafId !== null) return;

        this.rafId = requestAnimationFrame(() => {
            this.rafId = null;
            if (this.currentScale === this.targetScale) return;
            this.currentScale = this.targetScale;

            const workspace = document.getElementById('app-workspace');
            if (workspace) {
                workspace.style.zoom = `${this.currentScale}`;
            }

            this.updateIndicator(this.currentScale);

            if (persist) {
                clearTimeout(this.saveDebounceTimeout);
                this.saveDebounceTimeout = setTimeout(() => {
                    const config = store.getConfig();
                    if (config) {
                        config.ui_scale = this.currentScale;
                        saveConfig(config).catch(() => {});
                    }
                }, 500);
            }
        });
    }
}
```

---

## 4. Acceptance Criteria

- [ ] Spamming <kbd>Ctrl</kbd> + <kbd>+</kbd> or <kbd>Ctrl</kbd> + <kbd>-</kbd> 50 times in rapid succession stops scaling immediately when key is released (0 ms trailing delay).
- [ ] Holding <kbd>Ctrl</kbd> + <kbd>+</kbd> smoothly scales the UI at 60 FPS without frame drops or UI freezing.
- [ ] High-frequency mousewheel zooming (<kbd>Ctrl</kbd> + Wheel) responds smoothly without task queue saturation.
- [ ] Persisted scale is debounced and saved to `config.json` once zooming rests.
- [ ] No regression in fixed Titlebar positioning or modal overlay alignment.
