/**
 * UI Zoom Controller with Dynamic Scaling.
 * Zooms the workspace content while keeping the native Titlebar and OS controls strictly fixed.
 * Features a hard-capped rate limiter and queue manager to prevent input spam latency.
 */
import { store } from '../state/store';
import { saveConfig } from '../api/configApi';

export class ZoomController {
    private static readonly MIN_SCALE = 0.70;
    private static readonly MAX_SCALE = 1.60;
    private static readonly STEP_DELTA = 0.05;

    // Rate Limiting & Queue Capping Constants
    private static readonly MAX_REQUESTS_PER_SECOND = 20; // Hard cap: max 20 updates / second
    private static readonly MIN_REQUEST_INTERVAL_MS = 1000 / ZoomController.MAX_REQUESTS_PER_SECOND; // 50ms min spacing
    private static readonly MAX_QUEUED_REQUESTS = 3; // Hard cap: max 3 pending requests in queue

    private currentScale: number = 1.0;
    private targetScale: number = 1.0;
    private pendingQueue: number[] = [];
    private lastAppliedTime: number = 0;
    private dispatchTimeout: any = null;

    private workspaceEl: HTMLElement | null = null;
    private indicatorEl!: HTMLElement;
    private indicatorValueEl!: HTMLElement;
    private hideTimeout: any = null;
    private saveDebounceTimeout: any = null;

    constructor() {
        this.createIndicator();
        this.bindEvents();
    }

    private createIndicator(): void {
        this.indicatorEl = document.createElement('div');
        this.indicatorEl.id = 'zoom-indicator';
        this.indicatorEl.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -2px; margin-right: 4px;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg><span class="zoom-percent">100%</span>`;
        this.indicatorValueEl = this.indicatorEl.querySelector('.zoom-percent') as HTMLElement;
        document.body.appendChild(this.indicatorEl);
    }

    private getWorkspace(): HTMLElement | null {
        if (!this.workspaceEl) {
            this.workspaceEl = document.getElementById('app-workspace');
        }
        return this.workspaceEl;
    }

    private clamp(scale: number): number {
        return Math.round(Math.min(Math.max(scale, ZoomController.MIN_SCALE), ZoomController.MAX_SCALE) * 100) / 100;
    }

    /**
     * Immediate synchronous scale setter (used for initial config restoration and instant reset).
     * Clears all pending queued requests.
     */
    public setScale(scale: number, persist = true): void {
        this.clearQueue();

        const clamped = this.clamp(scale);
        this.currentScale = clamped;
        this.targetScale = clamped;
        this.lastAppliedTime = performance.now();

        const workspace = this.getWorkspace();
        if (workspace) {
            workspace.style.zoom = `${clamped}`;
        }

        this.showIndicator(clamped);

        if (persist) {
            this.scheduleSave(clamped);
        }
    }

    /**
     * Rate-limited, queue-capped relative scale adjuster.
     * Enforces a hard cap of at most 20 requests per second and at most 3 items in queue.
     * Drops incoming spam requests when the queue buffer is full.
     */
    public adjustScale(delta: number, persist = true): void {
        // Drop request if queue is at capacity (hard spam protection)
        if (this.pendingQueue.length >= ZoomController.MAX_QUEUED_REQUESTS) {
            return;
        }

        this.pendingQueue.push(delta);
        this.processQueue(persist);
    }

    private processQueue(persist: boolean): void {
        if (this.dispatchTimeout !== null) return;
        if (this.pendingQueue.length === 0) return;

        const now = performance.now();
        const elapsed = now - this.lastAppliedTime;
        const waitTime = Math.max(0, ZoomController.MIN_REQUEST_INTERVAL_MS - elapsed);

        if (waitTime === 0) {
            this.applyNextQueuedStep(persist);
        } else {
            this.dispatchTimeout = setTimeout(() => {
                this.dispatchTimeout = null;
                this.applyNextQueuedStep(persist);
            }, waitTime);
        }
    }

    private applyNextQueuedStep(persist: boolean): void {
        if (this.pendingQueue.length === 0) return;

        const delta = this.pendingQueue.shift()!;
        const next = this.clamp(this.targetScale + delta);
        this.targetScale = next;
        this.currentScale = next;
        this.lastAppliedTime = performance.now();

        const workspace = this.getWorkspace();
        if (workspace) {
            workspace.style.zoom = `${this.currentScale}`;
        }

        this.showIndicator(this.currentScale);

        if (persist) {
            this.scheduleSave(this.currentScale);
        }

        // If items remain in queue, schedule next step after minimum interval
        if (this.pendingQueue.length > 0) {
            this.dispatchTimeout = setTimeout(() => {
                this.dispatchTimeout = null;
                this.applyNextQueuedStep(persist);
            }, ZoomController.MIN_REQUEST_INTERVAL_MS);
        }
    }

    private clearQueue(): void {
        this.pendingQueue = [];
        if (this.dispatchTimeout !== null) {
            clearTimeout(this.dispatchTimeout);
            this.dispatchTimeout = null;
        }
    }

    public getScale(): number {
        return this.currentScale;
    }

    private scheduleSave(scale: number): void {
        clearTimeout(this.saveDebounceTimeout);
        this.saveDebounceTimeout = setTimeout(() => {
            const config = store.getConfig();
            if (config) {
                config.ui_scale = scale;
                saveConfig(config).catch(() => {});
            }
        }, 500);
    }

    private showIndicator(scale: number): void {
        const pct = Math.round(scale * 100);
        if (this.indicatorValueEl) {
            this.indicatorValueEl.textContent = `${pct}%`;
        }
        this.indicatorEl.classList.add('visible');

        clearTimeout(this.hideTimeout);
        this.hideTimeout = setTimeout(() => {
            this.indicatorEl.classList.remove('visible');
        }, 1200);
    }

    private bindEvents(): void {
        // Keyboard zoom shortcuts with numpad & international layout support
        window.addEventListener('keydown', (e: KeyboardEvent) => {
            if (!e.ctrlKey && !e.metaKey) return;

            const isZoomIn = e.key === '=' || e.key === '+' || e.code === 'NumpadAdd' || e.code === 'Equal';
            const isZoomOut = e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract' || e.code === 'Minus';
            const isReset = e.key === '0' || e.code === 'Numpad0' || e.code === 'Digit0';

            if (isZoomIn) {
                e.preventDefault();
                this.adjustScale(ZoomController.STEP_DELTA);
            } else if (isZoomOut) {
                e.preventDefault();
                this.adjustScale(-ZoomController.STEP_DELTA);
            } else if (isReset) {
                e.preventDefault();
                this.setScale(1.0);
            }
        });

        // Mousewheel zoom with rate-limited queue
        window.addEventListener('wheel', (e: WheelEvent) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const delta = e.deltaY < 0 ? 0.04 : -0.04;
                this.adjustScale(delta);
            }
        }, { passive: false });
    }
}


