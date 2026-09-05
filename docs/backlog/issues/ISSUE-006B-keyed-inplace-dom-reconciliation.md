# ISSUE-006B: Keyed In-Place DOM Reconciliation

| Metadata | Details |
| :--- | :--- |
| **Issue ID** | `ISSUE-006B` |
| **Title** | Keyed In-Place DOM Reconciliation |
| **Status** | Closed (Resolved in `2ed9816`) |
| **Priority** | P2 - Medium (Phase 3) |
| **Severity** | S3 (Moderate) |
| **Component** | Frontend / `ModListManager` / DOM Reconciliation |
| **Impacted Files** | [ModList.ts](file:///mnt/GG/VSCodeProjects/CustomModManagerWarhammer3/frontend/src/components/ModList.ts) |
| **Split From** | [ISSUE-006](file:///mnt/GG/VSCodeProjects/CustomModManagerWarhammer3/docs/backlog/issues/ISSUE-006-reconciliation-dom-teardown-and-comparator-sorting.md) |

---

## 1. Problem Statement & Observed Behavior

Toggling a mod's pin status, adding/removing user override rules, or switching filters causes a full visual flash across both mod columns. The browser is forced into a complete render tree rebuild, discarding element geometry, scroll positions, and active hover states.

---

## 2. Technical Root Cause Analysis

### Wholesale DOM Teardown via `replaceChildren()`
In [ModList.ts:415-453](file:///mnt/GG/VSCodeProjects/CustomModManagerWarhammer3/frontend/src/components/ModList.ts#L415-L453):
```typescript
// ModList.ts:433
this.inactiveContainer.replaceChildren(inactiveFrag);
// ModList.ts:448
this.activeContainer.replaceChildren(activeFrag);
```
- Every time any store event fires (`ACTIVE_MODS_CHANGED`, `PINNED_MODS_CHANGED`, `USER_RULES_CHANGED`, `SORT_FILTER_CHANGED`):
  - Both containers run `replaceChildren()`, removing all 400 card nodes from the document tree and appending fresh fragments.
- Even though existing DOM nodes are cached in `cardCache`, detaching and reattaching the entire node tree forces the browser to discard:
  1. Box model calculations and layout boundaries.
  2. Image render caches and hardware-accelerated layer associations.
  3. Active focus and text selection states.

---

## 3. Proposed Architecture & Solution

### Keyed Delta-Aware Reconciliation
Instead of replacing the entire container on every update:
1. **In-Place Update When Order is Stable**: If the list item count and keys match the current DOM children (such as when toggling a pin, updating conflict badges, or renaming a preset), update only the modified card in place via `updateModCardState()` without detaching siblings.
2. **Minimal DOM Moves**: When re-sorting or injecting a card, compare target sequence against current DOM children and perform surgical `insertBefore()` operations only for elements whose index changed.

```typescript
// Proposed ModList.ts keyed reconciliation
private reconcileContainer(container: HTMLElement, targetItems: Mod[], isOrderActive: boolean): void {
    const currentChildren = Array.from(container.children) as HTMLElement[];
    const currentKeys = currentChildren.map(el => el.dataset.name || el.dataset.id || '');
    const targetKeys = targetItems.map(m => getModIdentifier(m));

    // Fast Path: Identical sequence (state update only)
    if (currentKeys.length === targetKeys.length && currentKeys.every((k, i) => k === targetKeys[i])) {
        targetItems.forEach((mod, idx) => {
            const cardEl = currentChildren[idx];
            updateModCardState(cardEl, isOrderActive ? idx + 1 : null, targetItems.length);
        });
        return;
    }

    // Fallback Path: Structural reorder via DocumentFragment
    const frag = document.createDocumentFragment();
    targetItems.forEach((mod, idx) => {
        const key = getModIdentifier(mod);
        let card = this.cardCache.get(key);
        if (!card) {
            card = createModCard(mod, isOrderActive ? idx + 1 : null, targetItems.length);
            this.cardCache.set(key, card);
        } else {
            updateModCardState(card, isOrderActive ? idx + 1 : null, targetItems.length);
        }
        frag.appendChild(card);
    });
    container.replaceChildren(frag);
}
```

### Validation with SortableJS
Because SortableJS maintains DOM references to containers, ensure SortableJS handles and drag listeners are preserved across in-place reconciliations.

---

## 4. Acceptance Criteria

- [ ] Toggling a mod pin (Pin/Unpin) updates the badge in place with zero visual flash and without remounting sibling cards.
- [ ] Updating conflict badges after conflict analysis updates only affected cards without tearing down the container.
- [ ] SortableJS drag-and-drop handles remain fully functional after in-place reconciliation.
- [ ] Browser layout recalculation time during pin toggles drops from ~35 ms to < 2 ms.
