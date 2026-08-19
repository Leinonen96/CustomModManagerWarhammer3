/**
 * High-performance Mod list manager integrating SortableJS, Keyed DOM Reconciliation,
 * Event Delegation, fast RAF-batched filtering, and async conflict indexing.
 */
import Sortable from 'sortablejs';
import { store } from '../state/store';
import { Mod } from '../types';
import { createModCard, updateModCardState, updateModCardConflicts, getModIdentifier } from './ModCard';
import { showInputDialog } from './Modal';
import { Toast } from './Toast';
import { tauriInvoke } from '../api/client';
import { analyzeLoadOrderConflicts } from '../api/conflictApi';
import { ContextMenu } from './ContextMenu';

export class ModListManager {
    private inactiveContainer: HTMLElement;
    private activeContainer: HTMLElement;
    private inactiveCountBadge: HTMLElement | null = null;
    private activeCountBadge: HTMLElement | null = null;
    private sortableInactive: Sortable | null = null;
    private sortableActive: Sortable | null = null;
    private isInternalDrag: boolean = false;
    private conflictDebounceTimer: any = null;
    private filterRafId: number | null = null;

    // Persistent DOM Node Cache keyed by mod identifier (name or id)
    private cardCache: Map<string, HTMLElement> = new Map();

    constructor(inactiveContainerId: string, activeContainerId: string) {
        this.inactiveContainer = document.getElementById(inactiveContainerId) as HTMLElement;
        this.activeContainer = document.getElementById(activeContainerId) as HTMLElement;
        this.inactiveCountBadge = document.getElementById('count-inactive');
        this.activeCountBadge = document.getElementById('count-active');

        this.initSortable();
        this.bindDelegatedEvents();
        this.bindStoreEvents();
    }

    private initSortable(): void {
        const commonOptions: Sortable.Options = {
            group: 'shared-mods',
            animation: 150,
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            dragClass: 'sortable-drag',
            fallbackTolerance: 3,
            onEnd: () => {
                this.isInternalDrag = true;
                this.syncActiveModsFromDom();
                this.isInternalDrag = false;
                this.triggerConflictAnalysis();
            }
        };

        if (this.inactiveContainer) {
            this.sortableInactive = new Sortable(this.inactiveContainer, commonOptions);
        }

        if (this.activeContainer) {
            this.sortableActive = new Sortable(this.activeContainer, commonOptions);
        }
    }

    /**
     * Single high-performance Event Delegation listener for all card actions.
     * Eliminates thousands of per-card event closures and memory leaks.
     */
    private bindDelegatedEvents(): void {
        const handleContainerClick = (e: MouseEvent, isSourceActive: boolean) => {
            const target = e.target as HTMLElement | null;
            if (!target) return;

            const cardEl = target.closest('.mod-item') as HTMLElement | null;
            if (!cardEl) return;

            const modName = cardEl.dataset.name || '';
            const modId = cardEl.dataset.id || '';
            const allMods = store.getAllMods();
            const mod = allMods.find(m => (m.name && m.name === modName) || (m.id && m.id === modId)) || {
                name: modName,
                id: modId,
                title: cardEl.querySelector('.mod-title')?.textContent || modName || modId,
                real_path: '',
                thumb: '/gemini-svg.svg',
                url: cardEl.dataset.steamUrl || ''
            };

            // Check if a specific sub-action button or link was clicked
            const actionEl = target.closest('[data-action]') as HTMLElement | null;
            const action = actionEl ? actionEl.dataset.action : null;

            if (!action) {
                // Clicking anywhere on the card body highlights it and live updates the inspection view
                store.setInspectedMod(mod);
                return;
            }

            if (action === 'steam') {
                e.preventDefault();
                e.stopPropagation();
                const steamUrl = cardEl.dataset.steamUrl || mod.url || `https://steamcommunity.com/sharedfiles/filedetails/?id=${mod.id}`;
                tauriInvoke('open_url', { url: steamUrl });
            } else if (action === 'inspect') {
                e.stopPropagation();
                store.setInspectedMod(mod);
                store.setDrawerOpen(true);
            } else if (action === 'top') {
                e.stopPropagation();
                this.moveModToPosition(mod, 1);
            } else if (action === 'bottom') {
                e.stopPropagation();
                this.moveModToPosition(mod, store.getActiveMods().length);
            } else if (action === 'deactivate') {
                e.stopPropagation();
                this.deactivateMod(mod);
            } else if (action === 'add') {
                e.stopPropagation();
                this.activateMod(mod, 'bottom');
            } else if (action === 'toggle-pin') {
                e.stopPropagation();
                if (isSourceActive) {
                    const activeMods = store.getActiveMods();
                    const currentIdx = activeMods.findIndex(m => (m.name || m.id) === (mod.name || mod.id)) + 1;
                    const isNowPinned = store.toggleModPin(mod.name || mod.id, currentIdx > 0 ? currentIdx : 1);
                    if (isNowPinned) {
                        Toast.success(`Pinned "${mod.title || mod.name}" to position #${currentIdx}`);
                    } else {
                        Toast.info(`Unpinned "${mod.title || mod.name}"`);
                    }
                    this.render();
                }
            } else if (action === 'add-top') {
                e.stopPropagation();
                this.activateMod(mod, 'top');
            } else if (action === 'inject') {
                e.stopPropagation();
                this.promptInjectMod(mod);
            } else if (action === 'edit-order') {
                if (isSourceActive) {
                    e.stopPropagation();
                    this.startInlineOrderEdit(cardEl, mod);
                }
            }
        };

        const handleContextMenu = (e: MouseEvent, isSourceActive: boolean) => {
            const target = e.target as HTMLElement;
            const cardEl = target.closest('.mod-item') as HTMLElement | null;
            if (!cardEl) return;

            e.preventDefault();
            e.stopPropagation();

            const modName = cardEl.dataset.name || '';
            const modId = cardEl.dataset.id || '';
            const allMods = store.getAllMods();
            const mod = allMods.find(m => (m.name && m.name === modName) || (m.id && m.id === modId)) || {
                name: modName,
                id: modId,
                title: cardEl.querySelector('.mod-title')?.textContent || modName || modId,
                real_path: '',
                thumb: '/gemini-svg.svg',
                url: cardEl.dataset.steamUrl || ''
            };

            // Right-click also selects and highlights the mod
            store.setInspectedMod(mod);

            let orderIndex: number | null = null;
            if (isSourceActive) {
                const activeMods = store.getActiveMods();
                const idx = activeMods.findIndex(m => (m.name || m.id) === (mod.name || mod.id));
                orderIndex = idx !== -1 ? idx + 1 : null;
            }

            ContextMenu.getInstance().show(e.clientX, e.clientY, mod, isSourceActive, orderIndex);
        };

        if (this.inactiveContainer) {
            this.inactiveContainer.addEventListener('click', (e) => handleContainerClick(e, false));
            this.inactiveContainer.addEventListener('contextmenu', (e) => handleContextMenu(e, false));
        }
        if (this.activeContainer) {
            this.activeContainer.addEventListener('click', (e) => handleContainerClick(e, true));
            this.activeContainer.addEventListener('contextmenu', (e) => handleContextMenu(e, true));
        }
    }

    private bindStoreEvents(): void {
        store.subscribe('MODS_CHANGED', () => {
            if (!this.isInternalDrag) this.render();
        });
        store.subscribe('ACTIVE_MODS_CHANGED', () => {
            if (!this.isInternalDrag) this.render();
            this.triggerConflictAnalysis();
        });
        store.subscribe('PINNED_MODS_CHANGED', () => {
            if (!this.isInternalDrag) this.render();
        });
        store.subscribe('USER_RULES_CHANGED', () => {
            if (!this.isInternalDrag) this.render();
        });
        store.subscribe('SEARCH_CHANGED', () => this.applyFilters());
        store.subscribe('CONFLICTS_CHANGED', () => {
            this.updateConflictBadges();
        });
        store.subscribe('INSPECTOR_CHANGED', () => {
            this.updateInspectedHighlight();
        });
    }

    public triggerConflictAnalysis(): void {
        clearTimeout(this.conflictDebounceTimer);
        this.conflictDebounceTimer = setTimeout(async () => {
            const activeMods = store.getActiveMods();
            if (activeMods.length === 0) {
                store.setConflictAnalysis(null);
                return;
            }

            try {
                const result = await analyzeLoadOrderConflicts(activeMods);
                store.setConflictAnalysis(result);
            } catch (err) {
                console.warn('Conflict analysis failed:', err);
            }
        }, 180);
    }

    private updateConflictBadges(): void {
        const conflictData = store.getConflictAnalysis();
        const summaries = conflictData?.summaries || {};

        const cards = this.activeContainer.children;
        for (let i = 0; i < cards.length; i++) {
            const cardEl = cards[i] as HTMLElement;
            const name = cardEl.dataset.name || '';
            const id = cardEl.dataset.id || '';
            const summary = summaries[name] || (id ? summaries[id] : null);
            updateModCardConflicts(cardEl, summary, false);
        }
    }

    /**
     * High-performance Keyed DOM Reconciliation.
     * Reuses existing card DOM elements from `cardCache` instead of wiping innerHTML,
     * maintaining hardware image decodes and eliminating layout reflows.
     */
    public render(): void {
        const allMods = store.getAllMods();
        const activeMods = store.getActiveMods();
        
        const activeNameSet = new Set(activeMods.map(m => m.name || m.id));
        const inactiveMods = allMods.filter(m => !activeNameSet.has(m.name || m.id));

        // 1. Reconcile Inactive Container
        const inactiveFrag = document.createDocumentFragment();
        inactiveMods.forEach(mod => {
            const key = getModIdentifier(mod);
            let card = this.cardCache.get(key);
            if (!card) {
                card = createModCard(mod, null, activeMods.length);
                this.cardCache.set(key, card);
            } else {
                updateModCardState(card, null, activeMods.length);
            }
            inactiveFrag.appendChild(card);
        });
        this.inactiveContainer.replaceChildren(inactiveFrag);

        // 2. Reconcile Active Container
        const activeFrag = document.createDocumentFragment();
        activeMods.forEach((mod, index) => {
            const key = getModIdentifier(mod);
            let card = this.cardCache.get(key);
            if (!card) {
                card = createModCard(mod, index + 1, activeMods.length);
                this.cardCache.set(key, card);
            } else {
                updateModCardState(card, index + 1, activeMods.length);
            }
            activeFrag.appendChild(card);
        });
        this.activeContainer.replaceChildren(activeFrag);

        this.updateCounts(inactiveMods.length, activeMods.length);
        this.applyFilters();
        this.updateConflictBadges();
    }

    private updateInspectedHighlight(): void {
        const inspectedMod = store.getInspectedMod();
        const inspectedKey = inspectedMod ? getModIdentifier(inspectedMod) : null;

        const updateContainer = (container: HTMLElement) => {
            const children = container.children;
            for (let i = 0; i < children.length; i++) {
                const card = children[i] as HTMLElement;
                const key = card.dataset.name || card.dataset.id;
                const isInspected = Boolean(inspectedKey && key === inspectedKey);
                card.classList.toggle('mod-item-inspected', isInspected);
            }
        };

        updateContainer(this.activeContainer);
        updateContainer(this.inactiveContainer);
    }

    public moveModToPosition(mod: Mod, targetPos: number): void {
        const activeMods = [...store.getActiveMods()];
        const currentIndex = activeMods.findIndex(m => 
            (m.name && mod.name && m.name === mod.name) || 
            (m.id && mod.id && m.id === mod.id) ||
            ((m.name || m.id) === (mod.name || mod.id))
        );
        if (currentIndex === -1) return;

        const clampedPos = Math.max(1, Math.min(targetPos, activeMods.length));
        if (currentIndex === clampedPos - 1) return;

        const [removed] = activeMods.splice(currentIndex, 1);
        activeMods.splice(clampedPos - 1, 0, removed);

        store.setActiveMods(activeMods);
        Toast.info(`Moved "${mod.title || mod.name}" to position #${clampedPos}`);

        this.highlightCard(mod.name || mod.id);
    }

    public deactivateMod(mod: Mod): void {
        const activeMods = store.getActiveMods().filter(m => (m.name || m.id) !== (mod.name || mod.id));
        store.setActiveMods(activeMods);
        Toast.info(`Deactivated "${mod.title || mod.name}"`);
    }

    public activateMod(mod: Mod, position: 'top' | 'bottom' | number = 'bottom'): void {
        const activeMods = [...store.getActiveMods()];
        
        let targetIndex = activeMods.length;
        let posLabel = `#${activeMods.length + 1}`;

        if (position === 'top') {
            activeMods.unshift(mod);
            targetIndex = 0;
            posLabel = '#1 (Top)';
        } else if (position === 'bottom') {
            activeMods.push(mod);
            targetIndex = activeMods.length - 1;
            posLabel = `#${activeMods.length} (Bottom)`;
        } else if (typeof position === 'number') {
            const clamped = Math.max(1, Math.min(position, activeMods.length + 1));
            activeMods.splice(clamped - 1, 0, mod);
            targetIndex = clamped - 1;
            posLabel = `#${clamped}`;
        }

        store.setActiveMods(activeMods);
        Toast.success(`Injected "${mod.title || mod.name}" at ${posLabel}`);

        this.highlightCard(mod.name || mod.id);
    }

    private async promptInjectMod(mod: Mod): Promise<void> {
        const totalActive = store.getActiveMods().length;
        const inputVal = await showInputDialog({
            title: 'Inject Mod into Load Order',
            message: `Enter position # for "${mod.title || mod.name}" (1 to ${totalActive + 1}):`,
            defaultValue: 1,
            inputType: 'number',
            min: 1,
            max: totalActive + 1,
            confirmText: 'Inject at Position'
        });

        if (inputVal !== null) {
            const pos = parseInt(inputVal.trim(), 10);
            if (!isNaN(pos) && pos >= 1) {
                this.activateMod(mod, pos);
            }
        }
    }

    private startInlineOrderEdit(cardEl: HTMLElement, mod: Mod): void {
        const orderNumEl = cardEl.querySelector('.order-num') as HTMLElement | null;
        if (!orderNumEl || orderNumEl.querySelector('input')) return;

        const currentPosStr = orderNumEl.innerText.trim();
        const currentPos = parseInt(currentPosStr, 10) || 1;

        orderNumEl.innerHTML = `<input type="text" inputmode="numeric" pattern="[0-9]*" class="order-input-square" value="${currentPos}">`;
        const input = orderNumEl.querySelector('input') as HTMLInputElement;
        input.focus();
        input.select();

        let applied = false;
        const applyPosition = () => {
            if (applied) return;
            applied = true;
            const val = parseInt(input.value.trim(), 10);
            // Clean up DOM text before triggering store update
            orderNumEl.innerText = currentPos.toString();

            if (!isNaN(val) && val > 0 && val !== currentPos) {
                this.moveModToPosition(mod, val);
            }
        };

        input.onkeydown = (ke) => {
            if (ke.key === 'Enter') {
                ke.preventDefault();
                applyPosition();
            } else if (ke.key === 'Escape') {
                applied = true;
                orderNumEl.innerText = currentPos.toString();
            }
        };

        input.onblur = () => {
            applyPosition();
        };
    }

    private highlightCard(identifier: string): void {
        setTimeout(() => {
            const card = this.activeContainer.querySelector(`[data-name="${identifier}"], [data-id="${identifier}"]`) as HTMLElement | null;
            if (card) {
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                card.classList.add('mod-item-highlight');
                setTimeout(() => card.classList.remove('mod-item-highlight'), 1600);
            }
        }, 60);
    }

    public syncActiveModsFromDom(): void {
        const allMods = store.getAllMods();
        const nameMap = new Map(allMods.map(m => [m.name, m]));
        const idMap = new Map(allMods.map(m => [m.id, m]));
        const newActiveMods: Mod[] = [];

        const children = this.activeContainer.children;
        for (let i = 0; i < children.length; i++) {
            const el = children[i] as HTMLElement;
            const name = el.dataset.name;
            const id = el.dataset.id;
            const found = (name && nameMap.get(name)) || (id && idMap.get(id));
            if (found) {
                newActiveMods.push(found);
            } else if (name || id) {
                newActiveMods.push({
                    id: id || '',
                    name: name || '',
                    title: name || id || '',
                    real_path: '',
                    thumb: '/static/gemini-svg.svg',
                    url: ''
                });
            }
        }

        store.setActiveMods(newActiveMods, { silent: true });
        this.updateOrderNumbers();
    }

    public updateOrderNumbers(): void {
        const activeChildren = this.activeContainer.children;
        const totalActive = activeChildren.length;

        for (let i = 0; i < totalActive; i++) {
            const el = activeChildren[i] as HTMLElement;
            const numEl = el.querySelector('.order-num') as HTMLElement | null;
            if (numEl && !numEl.querySelector('input')) {
                const targetText = (i + 1).toString();
                if (numEl.innerText !== targetText) numEl.innerText = targetText;
                numEl.classList.add('order-active', 'order-editable');
            }
            const bottomBtn = el.querySelector('.btn-action-bottom') as HTMLElement | null;
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
        }

        const allMods = store.getAllMods();
        this.updateCounts(allMods.length - totalActive, totalActive);
    }

    private updateCounts(inactiveCount: number, activeCount: number): void {
        if (this.inactiveCountBadge) {
            this.inactiveCountBadge.innerText = Math.max(0, inactiveCount).toString();
        }
        if (this.activeCountBadge) {
            this.activeCountBadge.innerText = activeCount.toString();
        }
    }

    /**
     * Fast RAF-batched filter application.
     * Uses dataset.search directly with zero DOM layout queries.
     */
    private applyFilters(): void {
        if (this.filterRafId !== null) {
            cancelAnimationFrame(this.filterRafId);
        }

        this.filterRafId = requestAnimationFrame(() => {
            const termInactive = store.getSearchInactive();
            const termActive = store.getSearchActive();

            this.filterList(this.inactiveContainer, termInactive);
            this.filterList(this.activeContainer, termActive);
            this.filterRafId = null;
        });
    }

    private filterList(container: HTMLElement, term: string): void {
        const children = container.children;
        for (let i = 0; i < children.length; i++) {
            const el = children[i] as HTMLElement;
            if (!term) {
                el.classList.remove('mod-item-hidden');
                continue;
            }
            const searchStr = el.dataset.search || '';
            const matches = searchStr.includes(term);
            el.classList.toggle('mod-item-hidden', !matches);
        }
    }
}
