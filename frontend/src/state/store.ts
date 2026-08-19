/**
 * Central Reactive Application State Store.
 */
import { Mod, AppConfig, ConflictAnalysisResult, UserOverrideRule, RuleType } from '../types';
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
    | 'USER_RULES_CHANGED';

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

    // Pinning and User Override Rules
    private pinnedMods: Map<string, number> = new Map();
    private userRules: UserOverrideRule[] = [];

    // Conflict & Inspector State
    private conflictAnalysis: ConflictAnalysisResult | null = null;
    private inspectedMod: Mod | null = null;
    private isDrawerOpen: boolean = false;
    private drawerActiveTab: 'overview' | 'conflicts' | 'dependencies' = 'overview';

    private listeners: Map<StoreEvent, Set<Listener>> = new Map();

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
            'USER_RULES_CHANGED'
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
        this.allMods = mods;
        this.emit('MODS_CHANGED');
    }

    public getActiveMods(): Mod[] {
        return this.activeMods;
    }

    public setActiveMods(mods: Mod[], options: { silent?: boolean } = {}): void {
        this.activeMods = mods;
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
}

export const store = new AppStore();
