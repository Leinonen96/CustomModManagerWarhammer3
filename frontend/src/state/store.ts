/**
 * Central Reactive Application State Store.
 */
import { Mod, AppConfig, ConflictAnalysisResult } from '../types';

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
    | 'DRAWER_TOGGLED';

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
            'DRAWER_TOGGLED'
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
        this.emit('CONFIG_CHANGED');
    }

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
        if (mod && !this.isDrawerOpen) {
            this.setDrawerOpen(true);
        }
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
