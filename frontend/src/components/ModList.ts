/**
 * Mod list manager integrating SortableJS, async conflict indexing, and inspector highlights.
 */
import Sortable from 'sortablejs';
import { store } from '../state/store';
import { Mod } from '../types';
import { createModCard, ModCardCallbacks } from './ModCard';
import { Toast } from './Toast';
import { analyzeLoadOrderConflicts } from '../api/conflictApi';

export class ModListManager {
    private inactiveContainer: HTMLElement;
    private activeContainer: HTMLElement;
    private inactiveCountBadge: HTMLElement | null = null;
    private activeCountBadge: HTMLElement | null = null;
    private sortableInactive: Sortable | null = null;
    private sortableActive: Sortable | null = null;
    private isInternalDrag: boolean = false;
    private conflictDebounceTimer: any = null;

    constructor(inactiveContainerId: string, activeContainerId: string) {
        this.inactiveContainer = document.getElementById(inactiveContainerId) as HTMLElement;
        this.activeContainer = document.getElementById(activeContainerId) as HTMLElement;
        this.inactiveCountBadge = document.getElementById('count-inactive');
        this.activeCountBadge = document.getElementById('count-active');

        this.initSortable();
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

    private bindStoreEvents(): void {
        store.subscribe('MODS_CHANGED', () => {
            if (!this.isInternalDrag) this.render();
        });
        store.subscribe('ACTIVE_MODS_CHANGED', () => {
            if (!this.isInternalDrag) this.render();
            this.triggerConflictAnalysis();
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
        }, 200);
    }

    private updateConflictBadges(): void {
        const conflictData = store.getConflictAnalysis();
        const summaries = conflictData?.summaries || {};

        const cards = this.activeContainer.querySelectorAll('.mod-item');
        cards.forEach(card => {
            const el = card as HTMLElement;
            const name = el.dataset.name || '';
            const id = el.dataset.id || '';
            const summary = summaries[name] || (id ? summaries[id] : null);

            const metaEl = el.querySelector('.mod-meta');
            if (!metaEl) return;

            let badgeGroup = metaEl.querySelector('.conflict-badge-group') as HTMLElement;
            if (!summary || summary.total_conflicts === 0) {
                if (badgeGroup) badgeGroup.remove();
                return;
            }

            let badgesHtml = '';
            if (summary.fatal_startpos_count > 0) {
                badgesHtml += `<span class="conflict-badge badge-fatal" title="Fatal Startpos Collision: ${summary.fatal_startpos_count} file(s)">❌ STARTPOS</span>`;
            }
            const won = summary.script_overrides_won + summary.ui_overrides_won;
            if (won > 0) {
                badgesHtml += `<span class="conflict-badge badge-won" title="Overrides ${won} script/UI file(s) in lower mods">▲ ${won}</span>`;
            }
            const lost = summary.script_overrides_lost + summary.ui_overrides_lost;
            if (lost > 0) {
                badgesHtml += `<span class="conflict-badge badge-lost" title="Overridden by higher mods in ${lost} script/UI file(s)">▼ ${lost}</span>`;
            }
            if (summary.is_movie_pack) {
                badgesHtml += `<span class="conflict-badge badge-movie" title="Movie Pack: Auto-loaded first by engine">🎬 MOVIE</span>`;
            }
            if (summary.missing_dependencies && summary.missing_dependencies.length > 0) {
                badgesHtml += `<span class="conflict-badge badge-dep" title="Missing ${summary.missing_dependencies.length} prerequisite mod(s)">⚠️ DEP</span>`;
            }

            if (!badgesHtml) {
                if (badgeGroup) badgeGroup.remove();
                return;
            }

            if (!badgeGroup) {
                badgeGroup = document.createElement('div');
                badgeGroup.className = 'conflict-badge-group';
                metaEl.appendChild(badgeGroup);
            }
            badgeGroup.innerHTML = badgesHtml;
        });
    }

    public render(): void {
        const allMods = store.getAllMods();
        const activeMods = store.getActiveMods();
        
        const activeNameSet = new Set(activeMods.map(m => m.name || m.id));
        const inactiveMods = allMods.filter(m => !activeNameSet.has(m.name || m.id));

        const callbacks: ModCardCallbacks = {
            onMoveToPosition: (mod, pos) => this.moveModToPosition(mod, pos),
            onMoveToTop: (mod) => this.moveModToPosition(mod, 1),
            onMoveToBottom: (mod) => this.moveModToPosition(mod, activeMods.length),
            onDeactivate: (mod) => this.deactivateMod(mod),
            onActivate: (mod, pos) => this.activateMod(mod, pos),
            onInspect: (mod) => store.setInspectedMod(mod)
        };

        // Render Inactive mods
        this.inactiveContainer.innerHTML = '';
        const inactiveFrag = document.createDocumentFragment();
        inactiveMods.forEach(mod => {
            inactiveFrag.appendChild(createModCard(mod, null, activeMods.length, callbacks));
        });
        this.inactiveContainer.appendChild(inactiveFrag);

        // Render Active mods
        this.activeContainer.innerHTML = '';
        const activeFrag = document.createDocumentFragment();
        activeMods.forEach((mod, index) => {
            activeFrag.appendChild(createModCard(mod, index + 1, activeMods.length, callbacks));
        });
        this.activeContainer.appendChild(activeFrag);

        this.updateCounts(inactiveMods.length, activeMods.length);
        this.applyFilters();
    }

    private updateInspectedHighlight(): void {
        const inspectedMod = store.getInspectedMod();
        const allCards = document.querySelectorAll('.mod-item');
        allCards.forEach(c => {
            const cardEl = c as HTMLElement;
            const name = cardEl.dataset.name;
            const id = cardEl.dataset.id;
            if (inspectedMod && (name === inspectedMod.name || (id && id === inspectedMod.id))) {
                cardEl.classList.add('mod-item-inspected');
            } else {
                cardEl.classList.remove('mod-item-inspected');
            }
        });
    }

    public moveModToPosition(mod: Mod, targetPos: number): void {
        const activeMods = [...store.getActiveMods()];
        const currentIndex = activeMods.findIndex(m => (m.name || m.id) === (mod.name || mod.id));
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

    private highlightCard(identifier: string): void {
        setTimeout(() => {
            const card = this.activeContainer.querySelector(`[data-name="${identifier}"], [data-id="${identifier}"]`) as HTMLElement;
            if (card) {
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                card.classList.add('mod-item-highlight');
                setTimeout(() => card.classList.remove('mod-item-highlight'), 1600);
            }
        }, 80);
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
        const activeChildren = this.activeContainer.querySelectorAll('.mod-item');
        activeChildren.forEach((el, index) => {
            const numEl = el.querySelector('.order-num') as HTMLElement;
            if (numEl && !numEl.querySelector('input')) {
                numEl.innerText = (index + 1).toString();
                numEl.classList.add('order-active');
            }
        });

        const inactiveChildren = this.inactiveContainer.querySelectorAll('.mod-item');
        inactiveChildren.forEach((el) => {
            const numEl = el.querySelector('.order-num') as HTMLElement;
            if (numEl) {
                numEl.innerText = '-';
                numEl.classList.remove('order-active');
            }
        });

        const allMods = store.getAllMods();
        const activeMods = store.getActiveMods();
        this.updateCounts(allMods.length - activeMods.length, activeMods.length);
    }

    private updateCounts(inactiveCount: number, activeCount: number): void {
        if (this.inactiveCountBadge) {
            this.inactiveCountBadge.innerText = Math.max(0, inactiveCount).toString();
        }
        if (this.activeCountBadge) {
            this.activeCountBadge.innerText = activeCount.toString();
        }
    }

    private applyFilters(): void {
        const termInactive = store.getSearchInactive();
        const termActive = store.getSearchActive();

        this.filterList(this.inactiveContainer, termInactive);
        this.filterList(this.activeContainer, termActive);
    }

    private filterList(container: HTMLElement, term: string): void {
        const items = container.querySelectorAll('.mod-item');
        items.forEach((item) => {
            const el = item as HTMLElement;
            if (!term) {
                el.style.display = 'flex';
                return;
            }
            const name = (el.dataset.name || '').toLowerCase();
            const id = (el.dataset.id || '').toLowerCase();
            const title = (el.querySelector('.mod-title')?.textContent || '').toLowerCase();

            const matches = name.includes(term) || id.includes(term) || title.includes(term);
            el.style.display = matches ? 'flex' : 'none';
        });
    }
}
