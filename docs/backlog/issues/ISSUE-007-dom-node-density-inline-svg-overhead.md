# ISSUE-007: Excessive DOM Node Density & Inline SVG Vector Duplication

| Metadata | Details |
| :--- | :--- |
| **Issue ID** | `ISSUE-007` |
| **Title** | Excessive DOM Node Density & Inline SVG Vector Duplication |
| **Status** | Closed (Wontfix - WebKitGTK shadow root overhead) |
| **Priority** | P3 - Low |
| **Severity** | S4 (Minor) |
| **Component** | Frontend / `ModCard` Architecture / Graphics Assets |
| **Impacted Files** | [ModCard.ts](file:///mnt/GG/VSCodeProjects/CustomModManagerWarhammer3/frontend/src/components/ModCard.ts), [components.css](file:///mnt/GG/VSCodeProjects/CustomModManagerWarhammer3/frontend/src/styles/components.css), [animations.css](file:///mnt/GG/VSCodeProjects/CustomModManagerWarhammer3/frontend/src/styles/animations.css) |

---

## 1. Problem Statement & Observed Behavior

The overall memory footprint of the webview and DOM tree grows rapidly as the mod library scales. The DOM inspection tree is cluttered with thousands of repetitive SVG XML trees and wrapper tags, increasing layout complexity and memory consumption.

---

## 2. Technical Root Cause Analysis

### Inline SVG Redundancy
In [ModCard.ts:20-38](file:///mnt/GG/VSCodeProjects/CustomModManagerWarhammer3/frontend/src/components/ModCard.ts#L20-L38), icon definitions (`search`, `top`, `bottom`, `plus`, `remove`, `pin`, `clock`, `disk`, `globe`, `folder`, `core`, `fatal`, `movie`, etc.) are declared as raw inline SVG string templates:
```typescript
const ICONS = {
    top: `<svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"...><polyline points="18 15 12 9 6 15"></polyline><line x1="6" y1="5" x2="18" y2="5"></line></svg>`,
    // ...
};
```
- Each mod card inserts 6 to 10 of these complete SVG trees into its markup.
- For 400 mods, the browser parses and stores over **2,500 distinct SVG vector DOM nodes** in memory.
- Each inline SVG requires separate style computation, namespace evaluation, and box metric tracking.

### Heavy Compositing Layers
- `#zoom-indicator` ([animations.css:56](file:///mnt/GG/VSCodeProjects/CustomModManagerWarhammer3/frontend/src/styles/animations.css#L56)) and `.studio-tooltip` ([components.css:954](file:///mnt/GG/VSCodeProjects/CustomModManagerWarhammer3/frontend/src/styles/components.css#L954)) utilize `backdrop-filter: blur(12px)`.
- When layered above scrolling surfaces with hundreds of cards, `backdrop-filter` forces the browser compositor into expensive GPU offscreen render passes on each animation frame.

---

## 3. Proposed Architecture & Solution

### 1. Unified SVG Symbol Sprite Sheet
Declare all icons once in a hidden root `<svg id="icon-sprite" style="display: none;">` with `<symbol id="icon-top" viewBox="0 0 24 24">...</symbol>`.

In [ModCard.ts](file:///mnt/GG/VSCodeProjects/CustomModManagerWarhammer3/frontend/src/components/ModCard.ts), reference icons via standard `<use>` elements:
```html
<svg class="action-icon"><use href="#icon-top"/></svg>
```
*Benefits*:
- Reduces node count per card from ~50 down to ~25 (**50% reduction in total live DOM elements**).
- Drastically reduces string memory and HTML parsing overhead during card creation.

### 2. Backdrop Filter Optimization
Reduce `backdrop-filter` radius from `12px` to `6px` or fall back to high-opacity dark surfaces (`rgba(12, 16, 26, 0.96)`) on lower-power GPU environments.

---

## 4. Acceptance Criteria

- [ ] Total live DOM element count for 400 mods decreases from ~20,000 to under ~10,000.
- [ ] Visual appearance of icons and badges remains identical to current design.
- [ ] Memory footprint in Tauri webview process decreases measurably.
