/**
 * Header controls managing presets, settings triggers, and applying load orders.
 * Integrated with 100% custom studio CustomSelect (Zero OS default popups).
 */
import { store } from '../state/store';
import { fetchPresetsList, fetchPresetDetails, savePreset, deletePreset } from '../api/presetApi';
import { applyLoadOrder, launchGame } from '../api/loadOrderApi';
import { saveConfig } from '../api/configApi';
import { autoSortDependencies } from '../api/conflictApi';
import { syncController } from '../controllers/SyncController';
import { CustomSelect } from './CustomSelect';
import { SettingsModal } from './SettingsModal';
import { Toast } from './Toast';
import { showConfirmDialog } from './Modal';

export class HeaderControls {
    private presetSelect!: CustomSelect;
    private presetNameInput!: HTMLInputElement;
    private loadPresetBtn!: HTMLButtonElement;
    private savePresetBtn!: HTMLButtonElement;
    private deletePresetBtn!: HTMLButtonElement;
    private refreshBtn!: HTMLButtonElement;
    private autoSortBtn!: HTMLButtonElement;
    private toggleInspectorBtn!: HTMLButtonElement;
    private settingsBtn!: HTMLButtonElement;
    private applyBtn!: HTMLButtonElement;
    private launchGameBtn!: HTMLButtonElement;
    private settingsModal: SettingsModal;

    constructor(settingsModal: SettingsModal) {
        this.settingsModal = settingsModal;
        this.bindElements();
        this.bindEvents();
        this.bindStore();
    }

    private bindElements(): void {
        this.presetSelect = new CustomSelect('preset-select-container');
        this.presetNameInput = document.getElementById('preset-name') as HTMLInputElement;
        this.loadPresetBtn = document.getElementById('btn-load-preset') as HTMLButtonElement;
        this.savePresetBtn = document.getElementById('btn-save-preset') as HTMLButtonElement;
        this.deletePresetBtn = document.getElementById('btn-delete-preset') as HTMLButtonElement;
        this.refreshBtn = document.getElementById('btn-refresh-mods') as HTMLButtonElement;
        this.autoSortBtn = document.getElementById('btn-auto-sort') as HTMLButtonElement;
        this.toggleInspectorBtn = document.getElementById('btn-toggle-inspector') as HTMLButtonElement;
        this.settingsBtn = document.getElementById('btn-open-settings') as HTMLButtonElement;
        this.applyBtn = document.getElementById('btn-apply-order') as HTMLButtonElement;
        this.launchGameBtn = document.getElementById('btn-launch-game') as HTMLButtonElement;
    }

    private bindEvents(): void {
        this.presetSelect.onChange((selected) => {
            store.setSelectedPreset(selected);
            if (selected) {
                this.presetNameInput.value = selected;
            }
        });

        this.loadPresetBtn.onclick = () => this.handleLoadPreset();
        this.savePresetBtn.onclick = () => this.handleSavePreset();
        this.deletePresetBtn.onclick = () => this.handleDeletePreset();
        
        if (this.refreshBtn) {
            this.refreshBtn.onclick = () => {
                syncController.refreshNow(true);
            };
        }
        
        if (this.autoSortBtn) {
            this.autoSortBtn.onclick = async () => {
                const active = store.getActiveMods();
                if (active.length <= 1) {
                    Toast.info('Need at least 2 active mods to auto-sort dependencies.');
                    return;
                }
                try {
                    this.autoSortBtn.disabled = true;
                    this.autoSortBtn.innerHTML = `
                        <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> Sorting...
                    `;
                    const pinned = store.getPinnedModsObject();
                    const rules = store.getUserRules();
                    const sorted = await autoSortDependencies(active, pinned, rules);
                    store.setActiveMods(sorted);
                    const pinCount = Object.keys(pinned).length;
                    const ruleCount = rules.length;
                    let extraMsg = '';
                    if (pinCount > 0 && ruleCount > 0) extraMsg = ` (${pinCount} pinned, ${ruleCount} custom rules)`;
                    else if (pinCount > 0) extraMsg = ` (${pinCount} pinned)`;
                    else if (ruleCount > 0) extraMsg = ` (${ruleCount} custom rules)`;
                    Toast.success(`Auto-sorted ${sorted.length} active mods by dependency DAG${extraMsg}!`);
                } catch (err: any) {
                    Toast.error(`Auto-sort failed: ${err.message || err}`);
                } finally {
                    this.autoSortBtn.disabled = false;
                    this.autoSortBtn.innerHTML = `
                        <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg> Auto-Sort
                    `;
                }
            };
        }

        if (this.toggleInspectorBtn) {
            this.toggleInspectorBtn.onclick = () => {
                store.toggleDrawer();
            };
        }

        this.settingsBtn.onclick = () => this.settingsModal.openAndLoad();
        this.applyBtn.onclick = () => this.handleApplyLoadOrder();
        if (this.launchGameBtn) {
            this.launchGameBtn.onclick = () => this.handleLaunchGame();
        }
    }

    private bindStore(): void {
        store.subscribe('PRESETS_CHANGED', () => this.renderPresetDropdown());
        store.subscribe('SELECTED_PRESET_CHANGED', () => {
            this.presetSelect.setValue(store.getSelectedPreset(), false);
        });
    }

    public async refreshPresets(): Promise<void> {
        try {
            const presets = await fetchPresetsList();
            store.setPresets(presets);
        } catch (err: any) {
            Toast.error(`Failed to load presets: ${err.message}`);
        }
    }

    private renderPresetDropdown(): void {
        const presets = store.getPresets();
        const current = store.getSelectedPreset();
        this.presetSelect.setOptions(['', ...presets], current);
    }

    public async loadPresetByName(name: string, silent = false): Promise<boolean> {
        if (!name) return false;

        try {
            const res = await fetchPresetDetails(name);
            const data = res.data;
            if (!data) return false;

            const allMods = store.getAllMods();
            const nameMap = new Map(allMods.map(m => [m.name, m]));
            const idMap = new Map(allMods.map(m => [m.id, m]));

            const loadedActiveMods = data.mods.map(m => {
                return nameMap.get(m.name) || idMap.get(m.id) || m;
            });

            store.setActiveMods(loadedActiveMods);
            store.setSelectedPreset(name);
            this.presetNameInput.value = name;
            this.presetSelect.setValue(name, false);

            // Persist as last preset
            const config = store.getConfig();
            if (config) {
                config.last_preset = name;
                saveConfig(config).catch(() => {});
            }

            if (!silent) {
                if (data.missing_mods && data.missing_mods.length > 0) {
                    Toast.warning(`Loaded preset '${name}', but ${data.missing_mods.length} mod(s) are missing from your workshop.`);
                } else {
                    Toast.success(`Preset '${name}' loaded successfully! (${loadedActiveMods.length} mods)`);
                }
            }
            return true;
        } catch (err: any) {
            if (!silent) Toast.error(`Failed to load preset: ${err.message}`);
            return false;
        }
    }

    private async handleLoadPreset(): Promise<void> {
        const name = this.presetSelect.getValue();
        if (!name) {
            Toast.info('Please select a preset from the dropdown to load.');
            return;
        }
        await this.loadPresetByName(name, false);
    }

    private async handleSavePreset(): Promise<void> {
        const name = this.presetNameInput.value.trim();
        if (!name) {
            Toast.warning('Please enter a name for the preset.');
            this.presetNameInput.focus();
            return;
        }

        const activeMods = store.getActiveMods();
        try {
            await savePreset(name, activeMods);
            Toast.success(`Preset '${name}' saved with ${activeMods.length} mods!`);
            await this.refreshPresets();
            store.setSelectedPreset(name);

            // Persist as last preset
            const config = store.getConfig();
            if (config) {
                config.last_preset = name;
                saveConfig(config).catch(() => {});
            }
        } catch (err: any) {
            Toast.error(`Failed to save preset: ${err.message}`);
        }
    }

    private async handleDeletePreset(): Promise<void> {
        const name = this.presetSelect.getValue();
        if (!name) {
            Toast.info('Please select a preset to delete.');
            return;
        }

        const confirmed = await showConfirmDialog(
            'Delete Preset',
            `Are you sure you want to delete the preset "${name}"? This action cannot be undone.`,
            'Delete',
            'Cancel'
        );

        if (!confirmed) return;

        try {
            await deletePreset(name);
            Toast.success(`Preset '${name}' deleted.`);
            store.setSelectedPreset('');
            this.presetNameInput.value = '';
            await this.refreshPresets();

            const config = store.getConfig();
            if (config && config.last_preset === name) {
                config.last_preset = undefined;
                saveConfig(config).catch(() => {});
            }
        } catch (err: any) {
            Toast.error(`Failed to delete preset: ${err.message}`);
        }
    }

    private async handleApplyLoadOrder(): Promise<void> {
        const activeMods = store.getActiveMods();
        
        this.applyBtn.disabled = true;
        this.applyBtn.innerHTML = `
            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> Deploying...
        `;

        try {
            const res = await applyLoadOrder(activeMods);
            Toast.success(res.message || `✓ Deployed ${activeMods.length} mods to Total War: WARHAMMER III!`, 5000);
            
            // Visual green button success confirmation
            this.applyBtn.classList.add('btn-apply-success');
            this.applyBtn.innerHTML = `✓ DEPLOYED (${activeMods.length} MODS)!`;

            setTimeout(() => {
                this.applyBtn.classList.remove('btn-apply-success');
                this.applyBtn.innerHTML = `
                    <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Deploy to Game
                `;
                this.applyBtn.disabled = false;
            }, 2400);
        } catch (err: any) {
            Toast.error(`Failed to deploy load order: ${err.message}`);
            this.applyBtn.disabled = false;
            this.applyBtn.innerHTML = `
                <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Deploy to Game
            `;
        }
    }

    private async handleLaunchGame(): Promise<void> {
        if (!this.launchGameBtn) return;
        this.launchGameBtn.disabled = true;
        this.launchGameBtn.innerHTML = `
            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> Launching...
        `;

        try {
            // Launches whatever was previously deployed to the game
            await launchGame();
            Toast.success('Launching Total War: WARHAMMER III via Steam...', 5000);

            setTimeout(() => {
                this.launchGameBtn.disabled = false;
                this.launchGameBtn.innerHTML = `
                    <svg class="btn-icon" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> PLAY GAME
                `;
            }, 3000);
        } catch (err: any) {
            Toast.error(`Launch failed: ${err.message || err}`);
            this.launchGameBtn.disabled = false;
            this.launchGameBtn.innerHTML = `
                <svg class="btn-icon" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> PLAY GAME
            `;
        }
    }
}
