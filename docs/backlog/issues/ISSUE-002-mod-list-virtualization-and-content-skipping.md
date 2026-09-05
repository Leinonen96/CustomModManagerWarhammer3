# ISSUE-002: Mod List 120 FPS Scroll Engine (CSS Virtualization & Hover Paint Suppression)

| Metadata | Details |
| :--- | :--- |
| **Issue ID** | `ISSUE-002` |
| **Title** | Mod List 120 FPS Scroll Engine (CSS Virtualization & Hover Paint Suppression) |
| **Status** | Superseded by [ISSUE-008](file:///mnt/GG/VSCodeProjects/CustomModManagerWarhammer3/docs/backlog/issues/ISSUE-008-true-dom-virtualization.md) (Hover paint resolved in `2ed9816`) |
| **Priority** | P1 - High (Phase 1) |
| **Severity** | S2 (Major) |
| **Component** | Frontend / `ModListManager` / CSS Rendering Engine |
| **Impacted Files** | [ModList.ts](file:///mnt/GG/VSCodeProjects/CustomModManagerWarhammer3/frontend/src/components/ModList.ts), [mod-card.css](file:///mnt/GG/VSCodeProjects/CustomModManagerWarhammer3/frontend/src/styles/mod-card.css), [components.css](file:///mnt/GG/VSCodeProjects/CustomModManagerWarhammer3/frontend/src/styles/components.css) |
| **Merged Issues** | Incorporates [ISSUE-003](file:///mnt/GG/VSCodeProjects/CustomModManagerWarhammer3/docs/backlog/issues/ISSUE-003-scroll-hover-paint-storms.md) (Hover Transition Paint Storms) |

---

## 1. Problem Statement & Observed Behavior

When scrolling through the active load order list (100+ mods) or available mods (300+ mods), the application suffers from noticeable frame drops (dropping from 120 FPS to 30–45 FPS). Stuttering is especially pronounced when scrolling rapidly with the mouse cursor stationary over the list items.

---

## 2. Technical Root Cause Analysis

The framerate degradation is caused by two compounding bottlenecks in the scroll pipeline:

### 1. Off-Screen Rendering Overhead (Zero Virtualization)
In [ModList.ts:415-449](file:///mnt/GG/VSCodeProjects/CustomModManagerWarhammer3/frontend/src/components/ModList.ts#L415-L449), all cards are instantiated and retained in the DOM tree. Across 400 mods, **16,000 to 24,000 live DOM elements** and hundreds of decoded 72x72 images are actively calculated in layout and raster passes, even when located far outside the viewport.

### 2. On-Screen Hover Transition Paint Storms
As cards pass under the stationary cursor at 30 to 60 items per second, each card triggers `mouseenter` followed by `mouseleave`.
- [mod-card.css:16](file:///mnt/GG/VSCodeProjects/CustomModManagerWarhammer3/frontend/src/styles/mod-card.css#L16) defines:
  ```css
  transition: border-color 0.12s ease, background-color 0.12s ease, box-shadow 0.12s ease;
  ```
- [mod-card.css:79](file:///mnt/GG/VSCodeProjects/CustomModManagerWarhammer3/frontend/src/styles/mod-card.css#L79) defines:
  ```css
  .order-num { transition: all 0.12s ease; }
  ```
  *(The `transition: all` rule forces the browser to monitor and interpolate every computed CSS property).*
- Rapidly traversing 30 cards enqueues **over 90 concurrent transition timers**, triggering continuous repaints on every animation frame.

---

## 3. Proposed Architecture & Solution

### 1. Native CSS Virtualization via `content-visibility: auto`
Apply `content-visibility: auto` paired with `contain-intrinsic-size: auto 86px` to `.mod-item`:
- **Why this works**: The browser layout engine automatically skips style, layout, rasterization, and image decoding for all cards outside the viewport margin.
- **SortableJS Compatibility**: Because the physical DOM elements remain in the document tree, SortableJS retains **100% of its drag-and-drop mechanics, handle bindings, and drop-slot calculations** without custom virtual scroller hacks.

In [mod-card.css](file:///mnt/GG/VSCodeProjects/CustomModManagerWarhammer3/frontend/src/styles/mod-card.css#L5):
```css
.mod-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 10px;
    margin-bottom: 4px;
    background: var(--color-bg-card);
    border-radius: var(--radius-sm);
    cursor: grab;
    border: 1px solid var(--color-border-subtle);
    user-select: none;

    /* CSS VIRTUALIZATION */
    content-visibility: auto;
    contain-intrinsic-size: auto 86px;

    /* CLEANED TRANSITIONS (Removed unused box-shadow) */
    transition: border-color 0.10s ease, background-color 0.10s ease;
}

/* Guard SortableJS dragged element and drop slot */
.sortable-ghost,
.sortable-drag,
.sortable-chosen {
    content-visibility: visible !important;
}

/* Clean up .order-num (Replaced transition: all) */
.order-num {
    transition: color 0.10s ease, background-color 0.10s ease, border-color 0.10s ease;
}
```

### 2. Pointer-Events Suppression During Active Scroll
Add an `.is-scrolling` class to `.mod-list` while scrolling is active to temporarily disable hit-testing on cards, preventing hover transition triggers:

In [components.css](file:///mnt/GG/VSCodeProjects/CustomModManagerWarhammer3/frontend/src/styles/components.css#L590):
```css
/* Disable hover triggers while scrolling */
.mod-list.is-scrolling .mod-item {
    pointer-events: none !important;
}
```

In [ModList.ts](file:///mnt/GG/VSCodeProjects/CustomModManagerWarhammer3/frontend/src/components/ModList.ts):
```typescript
private bindScrollPerformance(): void {
    const attach = (container: HTMLElement) => {
        let scrollTimer: any = null;

        const onScroll = () => {
            if (!container.classList.contains('is-scrolling')) {
                container.classList.add('is-scrolling');
            }
            clearTimeout(scrollTimer);
            scrollTimer = setTimeout(() => {
                container.classList.remove('is-scrolling');
            }, 100);
        };

        container.addEventListener('scroll', onScroll, { passive: true });
        if ('onscrollend' in window) {
            container.addEventListener('scrollend', () => {
                clearTimeout(scrollTimer);
                container.classList.remove('is-scrolling');
            }, { passive: true });
        }
    };

    attach(this.inactiveContainer);
    attach(this.activeContainer);
}
```

---

## 4. Acceptance Criteria

- [ ] Fast scrolling through 100+ active mods maintains stable **60–120 FPS**.
- [ ] Off-screen cards skip layout and paint passes until approaching the viewport boundary.
- [ ] No visual stutter or frame drop occurs when moving cursor across cards during scroll.
- [ ] SortableJS cross-container drag-and-drop remains 100% functional.
- [ ] Scrollbar thumb remains stable with zero layout jumping from top to bottom.
