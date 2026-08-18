/**
 * Settings modal with live path validation and auto-detection.
 */
import { Modal } from './Modal';
import { store } from '../state/store';
import { fetchConfig, saveConfig, validateConfigPaths, autoDetectPaths } from '../api/configApi';
import { Toast } from './Toast';

export class SettingsModal extends Modal {
    private workshopInput!: HTMLInputElement;
    private dataInput!: HTMLInputElement;
    private scriptInput!: HTMLInputElement;
    private autoDetectBtn!: HTMLButtonElement;
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
                <h2>⚙️ Mod Manager Settings</h2>
                <button class="btn-close" id="settings-close-icon">&times;</button>
            </div>
            <p class="modal-desc">Configure the absolute paths for your Warhammer 3 installation and Proton/Steam user scripts.</p>
            
            <div class="form-group">
                <div class="form-label-row">
                    <label for="config-workshop">Workshop Directory</label>
                    <span id="badge-workshop" class="status-badge">Checking...</span>
                </div>
                <div class="tooltip-container">
                    <input type="text" id="config-workshop" placeholder="e.g., .../steamapps/workshop/content/1142710">
                    <small class="help-text">Where Steam downloads subscribed .pack files and preview images.</small>
                </div>
            </div>

            <div class="form-group">
                <div class="form-label-row">
                    <label for="config-data">Game Data Directory</label>
                    <span id="badge-data" class="status-badge">Checking...</span>
                </div>
                <div class="tooltip-container">
                    <input type="text" id="config-data" placeholder="e.g., .../Total War WARHAMMER III/data">
                    <small class="help-text">The game's actual data folder where mod symlinks are placed.</small>
                </div>
            </div>

            <div class="form-group">
                <div class="form-label-row">
                    <label for="config-script">User Script File (user.script.txt)</label>
                    <span id="badge-script" class="status-badge">Checking...</span>
                </div>
                <div class="tooltip-container">
                    <input type="text" id="config-script" placeholder="e.g., .../scripts/user.script.txt">
                    <small class="help-text">The script file that commands the game engine's active load order.</small>
                </div>
            </div>

            <div class="modal-buttons">
                <button type="button" class="btn-secondary" id="btn-autodetect">🔍 Auto-Detect Paths</button>
                <div style="flex-grow: 1;"></div>
                <button type="button" class="btn-secondary" id="close-modal-btn">Cancel</button>
                <button type="button" class="btn-primary" id="btn-save-settings">Save & Reload</button>
            </div>
        `;

        this.workshopInput = this.modalBox.querySelector('#config-workshop') as HTMLInputElement;
        this.dataInput = this.modalBox.querySelector('#config-data') as HTMLInputElement;
        this.scriptInput = this.modalBox.querySelector('#config-script') as HTMLInputElement;
        this.autoDetectBtn = this.modalBox.querySelector('#btn-autodetect') as HTMLButtonElement;
        this.saveBtn = this.modalBox.querySelector('#btn-save-settings') as HTMLButtonElement;
        this.cancelBtn = this.modalBox.querySelector('#close-modal-btn') as HTMLButtonElement;
    }

    private bindEvents(): void {
        this.cancelBtn.onclick = () => this.close();
        const closeIcon = this.modalBox.querySelector('#settings-close-icon') as HTMLElement;
        if (closeIcon) closeIcon.onclick = () => this.close();

        this.autoDetectBtn.onclick = async () => {
            this.autoDetectBtn.disabled = true;
            this.autoDetectBtn.innerText = 'Detecting...';
            try {
                const res = await autoDetectPaths();
                if (res.data?.detected) {
                    if (res.data.WORKSHOP_DIR) this.workshopInput.value = res.data.WORKSHOP_DIR;
                    if (res.data.GAME_DATA_DIR) this.dataInput.value = res.data.GAME_DATA_DIR;
                    if (res.data.SCRIPT_FILE) this.scriptInput.value = res.data.SCRIPT_FILE;
                    Toast.success('Auto-detected Warhammer 3 Steam paths!');
                    this.updateValidationBadges();
                } else {
                    Toast.warning('Could not automatically find all paths. Please enter them manually.');
                }
            } catch (err: any) {
                Toast.error(`Detection failed: ${err.message}`);
            } finally {
                this.autoDetectBtn.disabled = false;
                this.autoDetectBtn.innerText = '🔍 Auto-Detect Paths';
            }
        };

        this.saveBtn.onclick = async () => {
            const config = {
                WORKSHOP_DIR: this.workshopInput.value.trim(),
                GAME_DATA_DIR: this.dataInput.value.trim(),
                SCRIPT_FILE: this.scriptInput.value.trim()
            };

            if (!config.WORKSHOP_DIR || !config.GAME_DATA_DIR || !config.SCRIPT_FILE) {
                Toast.warning('Please fill in all three required path settings.');
                return;
            }

            this.saveBtn.disabled = true;
            try {
                await saveConfig(config);
                store.setConfig(config);
                Toast.success('Settings saved successfully!');
                this.close();
                setTimeout(() => location.reload(), 600);
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
            this.workshopInput.value = config.WORKSHOP_DIR || '';
            this.dataInput.value = config.GAME_DATA_DIR || '';
            this.scriptInput.value = config.SCRIPT_FILE || '';
            this.updateValidationBadges();
        } catch (err) {
            console.error('Failed to load settings', err);
        }
        this.open();
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
            // Silently ignore during typing
        }
    }

    private setBadge(id: string, isValid: boolean, text: string): void {
        const badge = document.getElementById(id);
        if (!badge) return;
        badge.className = `status-badge ${isValid ? 'badge-success' : 'badge-error'}`;
        badge.innerText = text;
    }
}
