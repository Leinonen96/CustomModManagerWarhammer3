# ISSUE-004: StudioTooltip Mid-Scroll DOM Mutation & Capture Invalidation

| Metadata | Details |
| :--- | :--- |
| **Issue ID** | `ISSUE-004` |
| **Title** | StudioTooltip Mid-Scroll DOM Mutation & Capture Invalidation |
| **Status** | Closed (Resolved in `2ed9816`) |
| **Priority** | P2 - Medium |
| **Severity** | S3 (Moderate) |
| **Component** | Frontend / `StudioTooltip` Engine |
| **Impacted Files** | [StudioTooltip.ts](file:///mnt/GG/VSCodeProjects/CustomModManagerWarhammer3/frontend/src/components/StudioTooltip.ts), [components.css](file:///mnt/GG/VSCodeProjects/CustomModManagerWarhammer3/frontend/src/styles/components.css) |

---

## 1. Problem Statement & Observed Behavior

During fast scrolling through mod lists, lingering tooltips occasionally flash or spawn in unexpected locations. More critically, moving the mouse or scrolling past cards introduces micro-stutters because `StudioTooltip` actively modifies element attributes inside the `mouseover` handler.

Furthermore, scrolling the mod list fails to automatically dismiss an open tooltip.

---

## 2. Technical Root Cause Analysis

### Synchronous DOM Mutation on Mouseover
In [StudioTooltip.ts:45-57](file:///mnt/GG/VSCodeProjects/CustomModManagerWarhammer3/frontend/src/components/StudioTooltip.ts#L45-L57):
```typescript
private handleMouseOver(e: MouseEvent): void {
    const target = (e.target as HTMLElement)?.closest('[title], [data-tooltip], [data-studio-tooltip]') as HTMLElement;
    if (!target) return;

    // Extract and suppress native OS tooltip
    if (target.hasAttribute('title')) {
        const rawTitle = target.getAttribute('title') || '';
        if (rawTitle.trim()) {
            target.setAttribute('data-studio-tooltip', rawTitle);
        }
        target.removeAttribute('title');
    }
    // ...
}
```
- When a user moves their cursor over cards (or when cards scroll under the stationary cursor), `handleMouseOver` executes continuously.
- Calling `target.setAttribute(...)` and `target.removeAttribute('title')` **directly mutates the live DOM tree**.
- Attribute changes dirty the element's style cache and trigger style recalculation in the browser's render pipeline while scrolling frames are being composed.

### Broken Scroll Listener (Non-Bubbling Scroll Event)
In [StudioTooltip.ts:42](file:///mnt/GG/VSCodeProjects/CustomModManagerWarhammer3/frontend/src/components/StudioTooltip.ts#L42):
```typescript
window.addEventListener('scroll', () => this.hide(), { passive: true });
```
- The application's `body` has `overflow: hidden`. The actual scrolling elements are the `.mod-list` containers (`#inactive-mods` and `#active-mods`).
- In web standards, DOM `scroll` events **do not bubble**.
- Because the listener is registered on `window` in the bubbling phase (default), it **never receives scroll events** dispatched by `.mod-list`. Tooltips remain visible and continue processing timeouts during list scroll.

---

## 3. Proposed Architecture & Solution

### 1. Passive Attribute Inspection (Zero DOM Mutations on Mouseover)
Avoid mutating the DOM when cursor traverses an element:
- Read `target.getAttribute('title')` or `target.getAttribute('data-tooltip')` directly.
- Suppress native tooltips without altering DOM attributes, or cache the tooltip string in a weak map (`WeakMap<HTMLElement, string>`) rather than writing back to `dataset` attributes.

### 2. Capture-Phase Scroll Event Listener
Register the scroll event listener with `capture: true` on `document`:
```typescript
// StudioTooltip.ts:42
document.addEventListener('scroll', () => this.hide(), { passive: true, capture: true });
```
Because capture listeners intercept events on their way down to target elements, this will reliably capture scroll events originating from `.mod-list`, `.drawer-body`, or any future scrollable container.

---

## 4. Acceptance Criteria

- [ ] Moving the cursor rapidly across mod cards performs zero `setAttribute` or `removeAttribute` DOM mutations.
- [ ] Scrolling either mod list immediately hides any open or pending tooltip.
- [ ] No native OS tooltip text conflicts or double tooltips appear.
- [ ] Tooltip positioning remains accurate and accounts for dynamic UI zoom scale.
