/**
 * Central Reactive Application State Store.
 */
import { Mod, AppConfig, ConflictAnalysisResult, UserOverrideRule, RuleType, SortField, SortDirection, FilterType } from '../types';
import { saveConfig } from '../api/configApi';

export type StoreEvent = 
    | 'MODS_CHANGED'
    | 'ACTIVE_MODS_CHANGED'
    | 'CONFIG_CHANGED'
    | 'PRESETS_CHANGED'
    | 'SELECTED_PRESET_CHANGED'
    | 'SEARCH_CHANGED'
    | 'STATUS_CHANGED'
    | 'CONFLICTS_CHANGED'
    | 'INSPECTOR_CHANGED'
    | 'DRAWER_TOGGLED'
    | 'PINNED_MODS_CHANGED'
    | 'USER_RULES_CHANGED'
    | 'SORT_FILTER_CHANGED';

type Listener = () => void;

class AppStore {
    private allMods: Mod[] = [];
    private activeMods: Mod[] = [];
    private config: AppConfig | null = null;
    private presets: string[] = [];
    private selectedPreset: string = '';
    private searchInactive: string = '';
    private searchActive: string = '';
    private isApplying: boolean = false;

    // Sorting and Filtering State
    private inactiveSortField: SortField = 'date';
    private inactiveSortDirection: SortDirection = 'desc';
    private inactiveFilterType: FilterType = 'all';
    private activeSortField: SortField = 'order';
    private activeSortDirection: SortDirection = 'asc';
    private activeFilterType: FilterType = 'all';

    // Pinning and User Override Rules
    private pinnedMods: Map<string, number> = new Map();
    private userRules: UserOverrideRule[] = [];

    // Conflict & Inspector State
    private conflictAnalysis: ConflictAnalysisResult | null = null;
    private inspectedMod: Mod | null = null;
    private isDrawerOpen: boolean = false;
    private drawerActiveTab: 'overview' | 'conflicts' | 'dependencies' = 'overview';

    private listeners: Map<StoreEvent, Set<Listener>> = new Map();

    /**
     * Pre-compute lowercase sort keys on Mod objects to eliminate
     * per-comparison .toLowerCase() allocations during sort.
     */
    private normalizeMods(mods: Mod[]): Mod[] {
        for (const m of mods) {
            if (m._normTitle === undefined) {
                m._normTitle = (m.title || m.name || '').toLowerCase();
                m._normName = (m.name || '').toLowerCase();
            }
        }
        return mods;
    }

    constructor() {
        // Initialize listener buckets
        const events: StoreEvent[] = [
            'MODS_CHANGED',
            'ACTIVE_MODS_CHANGED',
            'CONFIG_CHANGED',
            'PRESETS_CHANGED',
            'SELECTED_PRESET_CHANGED',
            'SEARCH_CHANGED',
            'STATUS_CHANGED',
            'CONFLICTS_CHANGED',
            'INSPECTOR_CHANGED',
            'DRAWER_TOGGLED',
            'PINNED_MODS_CHANGED',
            'USER_RULES_CHANGED',
            'SORT_FILTER_CHANGED'
        ];
        events.forEach(e => this.listeners.set(e, new Set()));
    }

    public subscribe(event: StoreEvent, listener: Listener): () => void {
        this.listeners.get(event)?.add(listener);
        return () => this.listeners.get(event)?.delete(listener);
    }

    private emit(event: StoreEvent): void {
        this.listeners.get(event)?.forEach(fn => fn());
    }

    // --- State Getters & Setters ---

    public getAllMods(): Mod[] {
        return this.allMods;
    }

    public setAllMods(mods: Mod[]): void {
        this.allMods = this.normalizeMods(mods);
        this.emit('MODS_CHANGED');
    }

    /**
     * Non-destructive state reconciliation for dynamic mod updates.
     * Updates the full mod catalog while strictly preserving active load orders,
     * custom pin assignments, and selection states.
     */
    public updateAllModsPreservingState(newMods: Mod[]): { added: number; removed: number; changed: boolean } {
        const getModKey = (m: { name?: string; id?: string }) => m.name || m.id || '';

        const oldMap = new Map(this.allMods.map(m => [getModKey(m), m]));
        const newMap = new Map(newMods.map(m => [getModKey(m), m]));

        let added = 0;
        let removed = 0;

        for (const [key] of newMap) {
            if (!oldMap.has(key)) added++;
        }
        for (const [key] of oldMap) {
            if (!newMap.has(key)) removed++;
        }

        const changed = added > 0 || removed > 0;

        if (changed || this.allMods.length !== newMods.length) {
            this.allMods = this.normalizeMods(newMods);

            // Reconcile active mods: preserve exact order and pinned state, but prune mods that no longer exist on disk
            const updatedActive = this.activeMods
                .filter(m => newMap.has(getModKey(m)))
                .map(m => newMap.get(getModKey(m)) || m);

            const activeChanged = updatedActive.length !== this.activeMods.length;
            this.activeMods = updatedActive;

            this.emit('MODS_CHANGED');
            if (activeChanged) {
                this.emit('ACTIVE_MODS_CHANGED');
            }
        }

        return { added, removed, changed };
    }

    public getActiveMods(): Mod[] {
        return this.activeMods;
    }

    public setActiveMods(mods: Mod[], options: { silent?: boolean } = {}): void {
        this.activeMods = this.normalizeMods(mods);
        if (!options.silent) {
            this.emit('ACTIVE_MODS_CHANGED');
        }
    }

    public getInactiveMods(): Mod[] {
        const activeIds = new Set(this.activeMods.map(m => m.id));
        return this.allMods.filter(m => !activeIds.has(m.id));
    }

    public getConfig(): AppConfig | null {
        return this.config;
    }

    public setConfig(config: AppConfig): void {
        this.config = config;
        // Sync pinned mods and rules from config
        if (config.pinned_mods) {
            this.pinnedMods = new Map(Object.entries(config.pinned_mods));
        }
        if (config.user_rules) {
            this.userRules = [...config.user_rules];
        }
        this.emit('CONFIG_CHANGED');
        this.emit('PINNED_MODS_CHANGED');
        this.emit('USER_RULES_CHANGED');
    }

    // --- Pinned Mods & Custom Rules Management ---

    public getPinnedMods(): Map<string, number> {
        return this.pinnedMods;
    }

    public getPinnedModsObject(): Record<string, number> {
        const obj: Record<string, number> = {};
        this.pinnedMods.forEach((pos, key) => {
            obj[key] = pos;
        });
        return obj;
    }

    public isModPinned(identifier: string): boolean {
        return this.pinnedMods.has(identifier);
    }

    public getModPinnedPosition(identifier: string): number | undefined {
        return this.pinnedMods.get(identifier);
    }

    public setModPinned(identifier: string, position: number): void {
        this.pinnedMods.set(identifier, position);
        this.persistPinsAndRules();
        this.emit('PINNED_MODS_CHANGED');
    }

    public unpinMod(identifier: string): void {
        if (this.pinnedMods.has(identifier)) {
            this.pinnedMods.delete(identifier);
            this.persistPinsAndRules();
            this.emit('PINNED_MODS_CHANGED');
        }
    }

    public toggleModPin(identifier: string, currentPosition?: number): boolean {
        if (this.pinnedMods.has(identifier)) {
            this.pinnedMods.delete(identifier);
            this.persistPinsAndRules();
            this.emit('PINNED_MODS_CHANGED');
            return false;
        } else {
            const pos = currentPosition || 1;
            this.pinnedMods.set(identifier, pos);
            this.persistPinsAndRules();
            this.emit('PINNED_MODS_CHANGED');
            return true;
        }
    }

    public getUserRules(): UserOverrideRule[] {
        return this.userRules;
    }

    public addUserRule(sourceMod: string, targetMod: string, ruleType: RuleType): void {
        // Remove duplicate/inverse rule if exists
        this.userRules = this.userRules.filter(r => 
            !(r.source_mod === sourceMod && r.target_mod === targetMod) &&
            !(r.source_mod === targetMod && r.target_mod === sourceMod)
        );
        this.userRules.push({ source_mod: sourceMod, target_mod: targetMod, rule_type: ruleType });
        this.persistPinsAndRules();
        this.emit('USER_RULES_CHANGED');
    }

    public removeUserRule(index: number): void {
        if (index >= 0 && index < this.userRules.length) {
            this.userRules.splice(index, 1);
            this.persistPinsAndRules();
            this.emit('USER_RULES_CHANGED');
        }
    }

    public clearUserRules(): void {
        this.userRules = [];
        this.persistPinsAndRules();
        this.emit('USER_RULES_CHANGED');
    }

    private persistPinsAndRules(): void {
        if (this.config) {
            this.config.pinned_mods = this.getPinnedModsObject();
            this.config.user_rules = [...this.userRules];
            saveConfig(this.config).catch(err => {
                console.error('Failed to auto-save pins/rules to config:', err);
            });
        }
    }

    // --- Presets, Search, & Status ---

    public getPresets(): string[] {
        return this.presets;
    }

    public setPresets(presets: string[]): void {
        this.presets = presets;
        this.emit('PRESETS_CHANGED');
    }

    public getSelectedPreset(): string {
        return this.selectedPreset;
    }

    public setSelectedPreset(presetName: string): void {
        this.selectedPreset = presetName;
        this.emit('SELECTED_PRESET_CHANGED');
    }

    public getSearchInactive(): string {
        return this.searchInactive;
    }

    public setSearchInactive(term: string): void {
        this.searchInactive = term.trim().toLowerCase();
        this.emit('SEARCH_CHANGED');
    }

    public getSearchActive(): string {
        return this.searchActive;
    }

    public setSearchActive(term: string): void {
        this.searchActive = term.trim().toLowerCase();
        this.emit('SEARCH_CHANGED');
    }

    public getIsApplying(): boolean {
        return this.isApplying;
    }

    public setIsApplying(applying: boolean): void {
        this.isApplying = applying;
        this.emit('STATUS_CHANGED');
    }

    // --- Conflict & Inspector Methods ---

    public getConflictAnalysis(): ConflictAnalysisResult | null {
        return this.conflictAnalysis;
    }

    public setConflictAnalysis(result: ConflictAnalysisResult | null): void {
        this.conflictAnalysis = result;
        this.emit('CONFLICTS_CHANGED');
    }

    public getInspectedMod(): Mod | null {
        return this.inspectedMod;
    }

    public setInspectedMod(mod: Mod | null): void {
        this.inspectedMod = mod;
        this.emit('INSPECTOR_CHANGED');
    }

    public getIsDrawerOpen(): boolean {
        return this.isDrawerOpen;
    }

    public setDrawerOpen(open: boolean): void {
        if (this.isDrawerOpen !== open) {
            this.isDrawerOpen = open;
            this.emit('DRAWER_TOGGLED');
        }
    }

    public toggleDrawer(): void {
        this.setDrawerOpen(!this.isDrawerOpen);
    }

    public getDrawerTab(): 'overview' | 'conflicts' | 'dependencies' {
        return this.drawerActiveTab;
    }

    public setDrawerTab(tab: 'overview' | 'conflicts' | 'dependencies'): void {
        this.drawerActiveTab = tab;
        this.emit('INSPECTOR_CHANGED');
    }

    // --- Sorting & Filtering Engine ---

    public getInactiveSort(): { field: SortField; direction: SortDirection } {
        return { field: this.inactiveSortField, direction: this.inactiveSortDirection };
    }

    public setInactiveSort(field: SortField, direction: SortDirection): void {
        this.inactiveSortField = field;
        this.inactiveSortDirection = direction;
        this.emit('SORT_FILTER_CHANGED');
    }

    public getInactiveFilterType(): FilterType {
        return this.inactiveFilterType;
    }

    public setInactiveFilterType(filter: FilterType): void {
        this.inactiveFilterType = filter;
        this.emit('SORT_FILTER_CHANGED');
    }

    public getActiveSort(): { field: SortField; direction: SortDirection } {
        return { field: this.activeSortField, direction: this.activeSortDirection };
    }

    public setActiveSort(field: SortField, direction: SortDirection): void {
        this.activeSortField = field;
        this.activeSortDirection = direction;
        this.emit('SORT_FILTER_CHANGED');
    }

    public getActiveFilterType(): FilterType {
        return this.activeFilterType;
    }

    public setActiveFilterType(filter: FilterType): void {
        this.activeFilterType = filter;
        this.emit('SORT_FILTER_CHANGED');
    }

    private compareMods(a: Mod, b: Mod, field: SortField, direction: SortDirection): number {
        let diff = 0;
        switch (field) {
            case 'date': {
                diff = (a.last_modified || 0) - (b.last_modified || 0);
                break;
            }
            case 'title': {
                const tA = a._normTitle || '';
                const tB = b._normTitle || '';
                diff = tA < tB ? -1 : (tA > tB ? 1 : 0);
                break;
            }
            case 'filename': {
                const nA = a._normName || '';
                const nB = b._normName || '';
                diff = nA < nB ? -1 : (nA > nB ? 1 : 0);
                break;
            }
            case 'size': {
                diff = (a.file_size_bytes || 0) - (b.file_size_bytes || 0);
                break;
            }
            case 'source': {
                const srcA = (a.source_type || 'Workshop').toLowerCase();
                const srcB = (b.source_type || 'Workshop').toLowerCase();
                diff = srcA < srcB ? -1 : (srcA > srcB ? 1 : 0);
                break;
            }
            case 'conflicts': {
                diff = this.getModConflictScore(a) - this.getModConflictScore(b);
                break;
            }
            default:
                diff = 0;
        }

        // Secondary tiebreaker by pre-normalized title
        if (diff === 0 && field !== 'title') {
            const tA = a._normTitle || '';
            const tB = b._normTitle || '';
            diff = tA < tB ? -1 : (tA > tB ? 1 : 0);
        }

        return direction === 'asc' ? diff : -diff;
    }

    public getModConflictScore(mod: Mod): number {
        const summaries = this.conflictAnalysis?.summaries;
        if (!summaries) return 0;
        const s = summaries[mod.name] || (mod.id ? summaries[mod.id] : null);
        if (!s) return 0;
        return (s.fatal_startpos_count * 1000) + 
               ((s.script_overrides_won + s.script_overrides_lost + s.ui_overrides_won + s.ui_overrides_lost) * 10) + 
               (s.missing_dependencies?.length || 0);
    }

    public getFilteredAndSortedInactiveMods(): Mod[] {
        const activeIds = new Set(this.activeMods.map(m => m.name || m.id));
        let list = this.allMods.filter(m => !activeIds.has(m.name || m.id));

        // Filter Type
        if (this.inactiveFilterType === 'workshop') {
            list = list.filter(m => (m.source_type || 'Workshop').toLowerCase() === 'workshop' && m.id !== 'Local');
        } else if (this.inactiveFilterType === 'local') {
            list = list.filter(m => (m.source_type || '').toLowerCase() === 'local' || m.id === 'Local');
        }

        // Sort
        list.sort((a, b) => this.compareMods(a, b, this.inactiveSortField, this.inactiveSortDirection));
        return list;
    }

    public getFilteredAndSortedActiveMods(): { mod: Mod; originalOrder: number }[] {
        let items = this.activeMods.map((mod, index) => ({
            mod,
            originalOrder: index + 1
        }));

        // Filter Type
        if (this.activeFilterType === 'workshop') {
            items = items.filter(item => (item.mod.source_type || 'Workshop').toLowerCase() === 'workshop' && item.mod.id !== 'Local');
        } else if (this.activeFilterType === 'local') {
            items = items.filter(item => (item.mod.source_type || '').toLowerCase() === 'local' || item.mod.id === 'Local');
        }

        // Sort
        if (this.activeSortField !== 'order') {
            items.sort((a, b) => this.compareMods(a.mod, b.mod, this.activeSortField, this.activeSortDirection));
        } else if (this.activeSortDirection === 'desc') {
            items.reverse();
        }

        return items;
    }
}

export const store = new AppStore();
