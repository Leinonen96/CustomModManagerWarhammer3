/**
 * UI Zoom Controller with Dynamic Scaling.
 * Zooms the workspace content while keeping the native Titlebar and OS controls strictly fixed.
 */
import { store } from '../state/store';
import { saveConfig } from '../api/configApi';

export class ZoomController {
    private currentScale: number = 1.0;
    private indicatorEl!: HTMLElement;
    private hideTimeout: any = null;
    private saveDebounceTimeout: any = null;

    constructor() {
        this.createIndicator();
        this.bindEvents();
    }

    private createIndicator(): void {
        this.indicatorEl = document.createElement('div');
        this.indicatorEl.id = 'zoom-indicator';
        document.body.appendChild(this.indicatorEl);
    }

    public setScale(scale: number, persist = true): void {
        const clamped = Math.round(Math.min(Math.max(scale, 0.70), 1.60) * 100) / 100;
        this.currentScale = clamped;

        // Apply zoom scale strictly to the application workspace (Titlebar remains 100% fixed)
        const workspace = document.getElementById('app-workspace');
        if (workspace) {
            workspace.style.zoom = `${clamped}`;
        }
        document.documentElement.style.setProperty('--ui-scale', `${clamped}`);

        this.showIndicator();

        if (persist) {
            clearTimeout(this.saveDebounceTimeout);
            this.saveDebounceTimeout = setTimeout(() => {
                const config = store.getConfig();
                if (config) {
                    config.ui_scale = clamped;
                    saveConfig(config).catch(() => {});
                }
            }, 800);
        }
    }

    public getScale(): number {
        return this.currentScale;
    }

    private showIndicator(): void {
        const pct = Math.round(this.currentScale * 100);
        this.indicatorEl.innerText = `🔍 ${pct}%`;
        this.indicatorEl.classList.add('visible');

        clearTimeout(this.hideTimeout);
        this.hideTimeout = setTimeout(() => {
            this.indicatorEl.classList.remove('visible');
        }, 1400);
    }

    private bindEvents(): void {
        // Keyboard zoom shortcuts (Ctrl + / Ctrl - / Ctrl 0)
        window.addEventListener('keydown', (e: KeyboardEvent) => {
            if (!e.ctrlKey && !e.metaKey) return;

            if (e.key === '=' || e.key === '+') {
                e.preventDefault();
                this.setScale(this.currentScale + 0.05);
            } else if (e.key === '-' || e.key === '_') {
                e.preventDefault();
                this.setScale(this.currentScale - 0.05);
            } else if (e.key === '0') {
                e.preventDefault();
                this.setScale(1.0);
            }
        });

        // Mousewheel zoom (Ctrl + Wheel)
        window.addEventListener('wheel', (e: WheelEvent) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const delta = e.deltaY < 0 ? 0.04 : -0.04;
                this.setScale(this.currentScale + delta);
            }
        }, { passive: false });
    }
}
