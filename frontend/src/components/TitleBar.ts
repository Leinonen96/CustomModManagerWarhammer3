import { getCurrentWindow } from '@tauri-apps/api/window';
import { store } from '../state/store';
import { updateController } from '../controllers/UpdateController';
import { updateModal } from './UpdateModal';

export class TitleBar {
    private element!: HTMLElement;
    private presetBadge!: HTMLElement;
    private updateBadgeEl!: HTMLElement;
    private updateTextEl!: HTMLElement;
    private maxBtn!: HTMLButtonElement;
    private appWindow = getCurrentWindow();

    constructor() {
        this.render();
        this.bindEvents();
    }

    private render(): void {
        this.element = document.createElement('header');
        this.element.className = 'titlebar';
        this.element.setAttribute('data-tauri-drag-region', '');

        this.element.innerHTML = `
            <div class="titlebar-drag-region" data-tauri-drag-region>
                <img src="/gemini-svg.svg" alt="WH3" class="titlebar-icon">
                <span class="titlebar-title">WARHAMMER III MOD MANAGER</span>
                <span id="titlebar-preset-badge" class="titlebar-badge" style="display: none;"></span>
                <span id="titlebar-update-badge" class="titlebar-update-badge" style="display: none;" title="New update available! Click to view release notes and install.">
                    <span class="badge-pulse-dot"></span>
                    <span id="titlebar-update-text">Update Available</span>
                </span>
            </div>
            <div class="titlebar-controls">
                <button type="button" class="titlebar-btn" id="titlebar-minimize" title="Minimize">
                    <svg viewBox="0 0 12 12"><rect y="5.5" width="12" height="1"/></svg>
                </button>
                <button type="button" class="titlebar-btn" id="titlebar-maximize" title="Maximize">
                    <svg id="max-icon" viewBox="0 0 12 12"><rect x="1" y="1" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>
                </button>
                <button type="button" class="titlebar-btn btn-close" id="titlebar-close" title="Close">
                    <svg viewBox="0 0 12 12">
                        <polygon points="11 1.8 10.2 1 6 5.2 1.8 1 1 1.8 5.2 6 1 10.2 1.8 11 6 6.8 10.2 11 11 10.2 6.8 6"/>
                    </svg>
                </button>
            </div>
        `;

        // Prepend as very first child in body
        document.body.insertBefore(this.element, document.body.firstChild);

        this.presetBadge = this.element.querySelector('#titlebar-preset-badge') as HTMLElement;
        this.updateBadgeEl = this.element.querySelector('#titlebar-update-badge') as HTMLElement;
        this.updateTextEl = this.element.querySelector('#titlebar-update-text') as HTMLElement;
        this.maxBtn = this.element.querySelector('#titlebar-maximize') as HTMLButtonElement;
    }

    private bindEvents(): void {
        const minBtn = this.element.querySelector('#titlebar-minimize') as HTMLButtonElement;
        const closeBtn = this.element.querySelector('#titlebar-close') as HTMLButtonElement;

        minBtn.onclick = () => this.appWindow.minimize();
        this.maxBtn.onclick = () => this.appWindow.toggleMaximize();
        closeBtn.onclick = () => this.appWindow.close();

        this.updateBadgeEl.onclick = () => {
            updateModal.show();
        };

        // Update preset badge when store changes
        store.subscribe('SELECTED_PRESET_CHANGED', () => {
            this.updatePresetBadge(store.getSelectedPreset());
        });

        // Listen for update events
        updateController.subscribe((update) => {
            if (update) {
                this.updateBadgeEl.style.display = 'inline-flex';
                this.updateTextEl.innerText = `Update v${update.version}`;
            } else {
                this.updateBadgeEl.style.display = 'none';
            }
        });
    }

    public updatePresetBadge(presetName?: string): void {
        if (!presetName) {
            this.presetBadge.style.display = 'none';
        } else {
            this.presetBadge.style.display = 'inline-block';
            this.presetBadge.innerText = `Preset: ${presetName}`;
        }
    }
}
