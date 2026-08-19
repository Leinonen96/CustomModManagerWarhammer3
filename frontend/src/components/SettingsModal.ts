/**
 * Settings modal with live path validation, auto-detection, and native directory browsing.
 */
import { Modal } from './Modal';
import { store } from '../state/store';
import { fetchConfig, saveConfig, validateConfigPaths, autoDetectPaths, pickFolder } from '../api/configApi';
import { fetchMods } from '../api/modApi';
import { updateController } from '../controllers/UpdateController';
import { Toast } from './Toast';

export class SettingsModal extends Modal {
    private workshopInput!: HTMLInputElement;
    private dataInput!: HTMLInputElement;
    private scriptInput!: HTMLInputElement;
    private browseWorkshopBtn!: HTMLButtonElement;
    private browseDataBtn!: HTMLButtonElement;
    private browseScriptBtn!: HTMLButtonElement;
    private autoDetectBtn!: HTMLButtonElement;
    private checkUpdatesBtn!: HTMLButtonElement;
    private autoCheckUpdatesInput!: HTMLInputElement;
    private saveBtn!: HTMLButtonElement;
    private cancelBtn!: HTMLButtonElement;

    constructor() {
        super('settings-modal');
        this.render();
        this.bindEvents();
    }

    private render(): void {
        this.modalBox.innerHTML = `
            <div class="modal-header">
                <h2><svg class="modal-header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg> Mod Manager Settings</h2>
                <button class="btn-close" id="settings-close-icon" title="Close Settings">
                    <svg class="close-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
            <p class="modal-desc">Configure the paths for your Warhammer 3 installation and Proton/Steam user scripts.</p>
            
            <div class="form-group">
                <div class="form-label-row">
                    <label for="config-workshop">Workshop Directory</label>
                    <span id="badge-workshop" class="status-badge">Checking...</span>
                </div>
                <div class="input-with-browse">
                    <input type="text" id="config-workshop" placeholder=".../steamapps/workshop/content/1142710">
                    <button type="button" class="btn btn-secondary btn-sm" id="btn-browse-workshop" title="Browse for Workshop folder">
                        <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg> Browse
                    </button>
                </div>
                <small class="help-text">Where Steam downloads subscribed .pack files and preview images.</small>
            </div>

            <div class="form-group">
                <div class="form-label-row">
                    <label for="config-data">Game Data Directory</label>
                    <span id="badge-data" class="status-badge">Checking...</span>
                </div>
                <div class="input-with-browse">
                    <input type="text" id="config-data" placeholder=".../Total War WARHAMMER III/data">
                    <button type="button" class="btn btn-secondary btn-sm" id="btn-browse-data" title="Browse for Game Data folder">
                        <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg> Browse
                    </button>
                </div>
                <small class="help-text">The game's actual data folder where mod symlinks are placed.</small>
            </div>

            <div class="form-group">
                <div class="form-label-row">
                    <label for="config-script">User Script File (user.script.txt)</label>
                    <span id="badge-script" class="status-badge">Checking...</span>
                </div>
                <div class="input-with-browse">
                    <input type="text" id="config-script" placeholder=".../scripts/user.script.txt">
                    <button type="button" class="btn btn-secondary btn-sm" id="btn-browse-script" title="Browse for Scripts folder">
                        <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg> Browse
                    </button>
                </div>
                <small class="help-text">The script file that commands the game engine's active load order.</small>
            </div>

            <div class="form-group settings-rules-group">
                <div class="form-label-row">
                    <label>Auto-Sort Rules & Pinned Mods</label>
                    <span id="rules-count-badge" class="status-badge">0 active</span>
                </div>
                <div class="settings-rules-panel" id="settings-rules-list">
                    <!-- Populated dynamically -->
                </div>
            </div>

            <div class="form-group settings-update-group">
                <div class="form-label-row">
                    <label>Application & Updates</label>
                    <span id="settings-app-version" class="version-display-badge">v${typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '2.1.0'}</span>
                </div>
                <div class="settings-update-row">
                    <button type="button" class="btn btn-secondary btn-sm" id="btn-settings-check-updates">
                        <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                        </svg> Check for Updates
                    </button>
                    <label class="checkbox-label" for="config-auto-check-updates">
                        <input type="checkbox" id="config-auto-check-updates" checked>
                        <span>Automatically check for updates on startup</span>
                    </label>
                </div>
            </div>

            <div class="modal-buttons">
                <button type="button" class="btn btn-secondary" id="btn-autodetect">
                    <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg> Auto-Detect Paths
                </button>
                <div style="flex-grow: 1;"></div>
                <button type="button" class="btn btn-secondary" id="close-modal-btn">Cancel</button>
                <button type="button" class="btn btn-primary" id="btn-save-settings">Save & Apply</button>
            </div>
        `;

        this.workshopInput = this.modalBox.querySelector('#config-workshop') as HTMLInputElement;
        this.dataInput = this.modalBox.querySelector('#config-data') as HTMLInputElement;
        this.scriptInput = this.modalBox.querySelector('#config-script') as HTMLInputElement;
        this.browseWorkshopBtn = this.modalBox.querySelector('#btn-browse-workshop') as HTMLButtonElement;
        this.browseDataBtn = this.modalBox.querySelector('#btn-browse-data') as HTMLButtonElement;
        this.browseScriptBtn = this.modalBox.querySelector('#btn-browse-script') as HTMLButtonElement;
        this.autoDetectBtn = this.modalBox.querySelector('#btn-autodetect') as HTMLButtonElement;
        this.checkUpdatesBtn = this.modalBox.querySelector('#btn-settings-check-updates') as HTMLButtonElement;
        this.autoCheckUpdatesInput = this.modalBox.querySelector('#config-auto-check-updates') as HTMLInputElement;
        this.saveBtn = this.modalBox.querySelector('#btn-save-settings') as HTMLButtonElement;
        this.cancelBtn = this.modalBox.querySelector('#close-modal-btn') as HTMLButtonElement;
    }

    private bindEvents(): void {
        this.cancelBtn.onclick = () => this.close();
        const closeIcon = this.modalBox.querySelector('#settings-close-icon') as HTMLElement;
        if (closeIcon) closeIcon.onclick = () => this.close();

        // Check for updates handler
        this.checkUpdatesBtn.onclick = async () => {
            this.checkUpdatesBtn.disabled = true;
            this.checkUpdatesBtn.innerHTML = '<svg class="btn-icon spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a10 10 0 0 1 10 10"></path></svg> Checking...';
            try {
                await updateController.checkForUpdates(false);
            } finally {
                this.checkUpdatesBtn.disabled = false;
                this.checkUpdatesBtn.innerHTML = '<svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> Check for Updates';
            }
        };

        // Native folder browsing handlers
        this.browseWorkshopBtn.onclick = async () => {
            const path = await pickFolder('Select Steam Workshop (1142710) Directory');
            if (path) {
                this.workshopInput.value = path;
                this.updateValidationBadges();
            }
        };

        this.browseDataBtn.onclick = async () => {
            const path = await pickFolder('Select Total War WARHAMMER III data Directory');
            if (path) {
                this.dataInput.value = path;
                this.updateValidationBadges();
            }
        };

        this.browseScriptBtn.onclick = async () => {
            const path = await pickFolder('Select Total War WARHAMMER III Scripts Directory');
            if (path) {
                const normPath = path.replace(/\\/g, '/');
                this.scriptInput.value = normPath.endsWith('user.script.txt') ? normPath : `${normPath}/user.script.txt`;
                this.updateValidationBadges();
            }
        };

        this.autoDetectBtn.onclick = async () => {
            this.autoDetectBtn.disabled = true;
            this.autoDetectBtn.innerHTML = '<svg class="btn-icon spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a10 10 0 0 1 10 10"></path></svg> Detecting...';
            try {
                const res = await autoDetectPaths();
                if (res.data?.detected) {
                    if (res.data.WORKSHOP_DIR) this.workshopInput.value = res.data.WORKSHOP_DIR;
                    if (res.data.GAME_DATA_DIR) this.dataInput.value = res.data.GAME_DATA_DIR;
                    if (res.data.SCRIPT_FILE) this.scriptInput.value = res.data.SCRIPT_FILE;
                    Toast.success('Auto-detected Warhammer 3 Steam paths!');
                    this.updateValidationBadges();
                } else {
                    Toast.warning('Could not automatically find all paths. Please use "Browse" to set them.');
                }
            } catch (err: any) {
                Toast.error(`Detection failed: ${err.message}`);
            } finally {
                this.autoDetectBtn.disabled = false;
                this.autoDetectBtn.innerHTML = '<svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg> Auto-Detect Paths';
            }
        };

        this.saveBtn.onclick = async () => {
            const config = {
                workshop_dir: this.workshopInput.value.trim(),
                game_data_dir: this.dataInput.value.trim(),
                script_file: this.scriptInput.value.trim(),
                auto_backup: true,
                auto_check_updates: this.autoCheckUpdatesInput.checked,
                theme: 'dark',
                pinned_mods: store.getPinnedModsObject(),
                user_rules: store.getUserRules()
            };

            if (!config.workshop_dir || !config.game_data_dir || !config.script_file) {
                Toast.warning('Please fill in all three required path settings.');
                return;
            }

            this.saveBtn.disabled = true;
            try {
                await saveConfig(config);
                store.setConfig(config);
                const mods = await fetchMods();
                store.setAllMods(mods);
                Toast.success('Settings saved successfully!');
                this.close();
            } catch (err: any) {
                Toast.error(`Failed to save settings: ${err.message}`);
            } finally {
                this.saveBtn.disabled = false;
            }
        };

        [this.workshopInput, this.dataInput, this.scriptInput].forEach(input => {
            input.addEventListener('input', () => this.updateValidationBadges());
        });
    }

    public async openAndLoad(): Promise<void> {
        try {
            const config = await fetchConfig();
            store.setConfig(config);
            this.workshopInput.value = config.workshop_dir || config.WORKSHOP_DIR || '';
            this.dataInput.value = config.game_data_dir || config.GAME_DATA_DIR || '';
            this.scriptInput.value = config.script_file || config.SCRIPT_FILE || '';
            this.autoCheckUpdatesInput.checked = config.auto_check_updates !== false;
            this.updateValidationBadges();
            this.renderRulesList();
        } catch (err) {
            console.error('Failed to load settings', err);
        }
        this.open();
    }

    private renderRulesList(): void {
        const container = this.modalBox.querySelector('#settings-rules-list') as HTMLElement;
        const countBadge = this.modalBox.querySelector('#rules-count-badge') as HTMLElement;
        if (!container || !countBadge) return;

        const pinnedMods = store.getPinnedMods();
        const userRules = store.getUserRules();
        const totalItems = pinnedMods.size + userRules.length;

        countBadge.innerText = `${totalItems} active`;
        countBadge.className = totalItems > 0 ? 'status-badge badge-success' : 'status-badge';

        if (totalItems === 0) {
            container.innerHTML = `
                <div class="rules-empty-state">
                    <span>No custom rules or pinned mods active. Pin mods or resolve conflicts in the Inspector to lock preferences.</span>
                </div>
            `;
            return;
        }

        let html = '';

        // Render Pinned Mods
        if (pinnedMods.size > 0) {
            html += `<div class="rules-category-title"><svg class="inline-icon" viewBox="0 0 24 24" fill="currentColor" width="12" height="12"><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.89A2 2 0 0 1 15 10.77V5a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v5.77a2 2 0 0 1-1.11 1.79l-1.78.89A2 2 0 0 0 5 15.24Z"></path></svg> Pinned Mod Anchors (${pinnedMods.size})</div>`;
            pinnedMods.forEach((pos, modName) => {
                html += `
                    <div class="rule-item-row">
                        <span class="rule-pinned-badge">PIN #${pos}</span>
                        <span class="rule-mod-title font-mono" title="${modName}">${modName}</span>
                        <button type="button" class="btn-rule-delete" data-unpin="${modName}" title="Unpin mod">
                            <svg class="close-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>
                `;
            });
        }

        // Render Custom Override Rules
        if (userRules.length > 0) {
            html += `<div class="rules-category-title" style="margin-top: 8px;"><svg class="inline-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><polyline points="18 15 12 9 6 15"></polyline></svg> Relative Overwrite Rules (${userRules.length})</div>`;
            userRules.forEach((rule, idx) => {
                const typeLabel = rule.rule_type === 'above' ? 'loads ABOVE' : 'loads BELOW';
                html += `
                    <div class="rule-item-row">
                        <span class="rule-mod-title font-mono" title="${rule.source_mod}">${rule.source_mod}</span>
                        <span class="rule-rel-badge">${typeLabel}</span>
                        <span class="rule-mod-title font-mono" title="${rule.target_mod}">${rule.target_mod}</span>
                        <button type="button" class="btn-rule-delete" data-delete-rule="${idx}" title="Delete rule">
                            <svg class="close-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>
                `;
            });
        }

        container.innerHTML = html;

        // Bind delete / unpin handlers
        container.querySelectorAll('[data-unpin]').forEach(btn => {
            const el = btn as HTMLElement;
            el.onclick = () => {
                const name = el.dataset.unpin;
                if (name) {
                    store.unpinMod(name);
                    this.renderRulesList();
                }
            };
        });

        container.querySelectorAll('[data-delete-rule]').forEach(btn => {
            const el = btn as HTMLElement;
            el.onclick = () => {
                const idx = parseInt(el.dataset.deleteRule || '-1', 10);
                if (idx >= 0) {
                    store.removeUserRule(idx);
                    this.renderRulesList();
                }
            };
        });
    }

    private async updateValidationBadges(): Promise<void> {
        try {
            const res = await validateConfigPaths();
            const val = res.data;
            if (!val) return;

            this.setBadge('badge-workshop', val.workshop_dir.exists, val.workshop_dir.exists ? 'Valid' : 'Not Found');
            this.setBadge('badge-data', val.game_data_dir.exists, val.game_data_dir.exists ? 'Valid' : 'Not Found');
            const isScriptValid = Boolean(val.script_file.exists || val.script_file.parent_exists);
            this.setBadge('badge-script', isScriptValid, 
                val.script_file.exists ? 'Valid' : (val.script_file.parent_exists ? 'Parent Exists' : 'Not Found'));
        } catch {
            // Silently ignore
        }
    }

    private setBadge(id: string, isValid: boolean, text: string): void {
        const badge = document.getElementById(id);
        if (!badge) return;
        badge.className = `status-badge ${isValid ? 'badge-success' : 'badge-error'}`;
        badge.innerText = text;
    }
}
