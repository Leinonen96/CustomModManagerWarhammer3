# ISSUE-005: Forced Synchronous Layout Thrashing in Order Synchronization

| Metadata | Details |
| :--- | :--- |
| **Issue ID** | `ISSUE-005` |
| **Title** | Forced Synchronous Layout Thrashing in Order Synchronization |
| **Status** | Open |
| **Priority** | P2 - Medium |
| **Severity** | S3 (Moderate) |
| **Component** | Frontend / `ModList` / DOM Sync |
| **Impacted Files** | [ModList.ts](file:///mnt/GG/VSCodeProjects/CustomModManagerWarhammer3/frontend/src/components/ModList.ts) |

---

## 1. Problem Statement & Observed Behavior

After dragging to reorder a mod, deleting a mod, or auto-sorting a load order containing 100+ items, the UI exhibits a noticeable pause (100–250 ms) before the list settles and becomes responsive again.

---

## 2. Technical Root Cause Analysis

### Layout Thrashing via `innerText` Loop
In [ModList.ts:635-670](file:///mnt/GG/VSCodeProjects/CustomModManagerWarhammer3/frontend/src/components/ModList.ts#L635-L670):
```typescript
public updateOrderNumbers(): void {
    const activeChildren = this.activeContainer.children;
    const totalActive = activeChildren.length;

    for (let i = 0; i < totalActive; i++) {
        const el = activeChildren[i] as HTMLElement;
        const numEl = el.querySelector('.order-num') as HTMLElement | null;
        if (numEl && !numEl.querySelector('input')) {
            const targetText = (i + 1).toString();
            // FORCED SYNCHRONOUS LAYOUT (READ + WRITE)
            if (numEl.innerText !== targetText) numEl.innerText = targetText;
            numEl.classList.add('order-active', 'order-editable');
        }
        const bottomBtn = el.querySelector('[data-action="bottom"]') as HTMLElement | null;
        if (bottomBtn) {
            bottomBtn.title = `Move to Bottom (Priority #${totalActive})`;
        }
    }

    const inactiveChildren = this.inactiveContainer.children;
    for (let i = 0; i < inactiveChildren.length; i++) {
        const el = inactiveChildren[i] as HTMLElement;
        const numEl = el.querySelector('.order-num') as HTMLElement | null;
        if (numEl && numEl.innerText !== '-') {
            numEl.innerText = '-';
            numEl.classList.remove('order-active', 'order-editable');
        }
        // ...
    }
}
```

### The Difference Between `innerText` and `textContent`
1. `textContent` returns and sets the raw character content of a node. It does **not** query styles or layout.
2. `innerText` computes rendered text. To determine what text is visible, the browser engine must compute the element's CSS box model, check `visibility` and `display: none`, and run a full layout pass.
3. Because `numEl.innerText` is read and then immediately written to inside a loop across hundreds of elements, the browser is forced into **Forced Synchronous Layout (Layout Thrashing)** on every iteration:
   $$\text{Read } \rightarrow \text{Mutate } \rightarrow \text{Reflow } \rightarrow \text{Read } \rightarrow \text{Mutate } \rightarrow \text{Reflow ...}$$

---

## 3. Proposed Architecture & Solution

Replace all instances of `innerText` in tight synchronization loops with `textContent`:

```typescript
// Proposed ModList.ts:643-662
for (let i = 0; i < totalActive; i++) {
    const el = activeChildren[i] as HTMLElement;
    const numEl = el.querySelector('.order-num') as HTMLElement | null;
    if (numEl && !numEl.querySelector('input')) {
        const targetText = (i + 1).toString();
        if (numEl.textContent !== targetText) {
            numEl.textContent = targetText;
        }
        if (!numEl.classList.contains('order-active')) {
            numEl.classList.add('order-active', 'order-editable');
        }
    }
    const bottomBtn = el.querySelector('[data-action="bottom"]') as HTMLElement | null;
    if (bottomBtn) {
        bottomBtn.title = `Move to Bottom (Priority #${totalActive})`;
    }
}

const inactiveChildren = this.inactiveContainer.children;
for (let i = 0; i < inactiveChildren.length; i++) {
    const el = inactiveChildren[i] as HTMLElement;
    const numEl = el.querySelector('.order-num') as HTMLElement | null;
    if (numEl && numEl.textContent !== '-') {
        numEl.textContent = '-';
        numEl.classList.remove('order-active', 'order-editable');
    }
}
```

---

## 4. Acceptance Criteria

- [ ] Reordering items in active load order updates numeric badges instantly (< 16 ms) without layout thrashing warnings in DevTools.
- [ ] Drag-and-drop end callback (`onEnd`) completes within a single animation frame.
- [ ] Number badges correctly reflect updated 1-based order positions for all active items.
- [ ] Inactive mod cards correctly display '-' with zero style recalculation overhead.
