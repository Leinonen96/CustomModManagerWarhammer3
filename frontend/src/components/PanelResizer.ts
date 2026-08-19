/**
 * Interactive Movable Splitter Divider between Available Mods & Active Load Order panels.
 * Features persistent split ratios in localStorage and double-click to reset 50/50.
 */

const STORAGE_KEY = 'wh3_panel_split_ratio';
const DEFAULT_RATIO = 0.5;
const MIN_RATIO = 0.22;
const MAX_RATIO = 0.78;

export class PanelResizer {
    private container: HTMLElement;
    private resizerEl: HTMLElement;
    private leftPanel!: HTMLElement;
    private rightPanel!: HTMLElement;
    private isDragging: boolean = false;

    constructor() {
        this.container = document.querySelector('.container') as HTMLElement;
        this.resizerEl = document.getElementById('panel-resizer') as HTMLElement;
        
        const panels = this.container ? this.container.querySelectorAll('.panel') : null;
        if (!panels || panels.length < 2 || !this.resizerEl) {
            console.warn('PanelResizer: Panels or resizer element missing from DOM.');
            return;
        }

        this.leftPanel = panels[0] as HTMLElement;
        this.rightPanel = panels[1] as HTMLElement;

        this.initSplit();
        this.bindEvents();
    }

    private initSplit(): void {
        const saved = localStorage.getItem(STORAGE_KEY);
        let ratio = DEFAULT_RATIO;
        if (saved) {
            const parsed = parseFloat(saved);
            if (!isNaN(parsed) && parsed >= MIN_RATIO && parsed <= MAX_RATIO) {
                ratio = parsed;
            }
        }
        this.applyRatio(ratio);
    }

    private applyRatio(ratio: number): void {
        const leftPercent = (ratio * 100).toFixed(2);
        const rightPercent = ((1 - ratio) * 100).toFixed(2);

        this.leftPanel.style.flex = `0 0 calc(${leftPercent}% - 6px)`;
        this.leftPanel.style.maxWidth = `calc(${leftPercent}% - 6px)`;

        this.rightPanel.style.flex = `0 0 calc(${rightPercent}% - 6px)`;
        this.rightPanel.style.maxWidth = `calc(${rightPercent}% - 6px)`;
    }

    private bindEvents(): void {
        this.resizerEl.addEventListener('pointerdown', (e: PointerEvent) => {
            e.preventDefault();
            this.isDragging = true;
            this.resizerEl.setPointerCapture(e.pointerId);
            document.body.classList.add('resizing-panels');
            this.resizerEl.classList.add('active');
        });

        this.resizerEl.addEventListener('pointermove', (e: PointerEvent) => {
            if (!this.isDragging) return;

            const rect = this.container.getBoundingClientRect();
            if (rect.width <= 0) return;

            const rawRatio = (e.clientX - rect.left) / rect.width;
            const clampedRatio = Math.max(MIN_RATIO, Math.min(MAX_RATIO, rawRatio));

            this.applyRatio(clampedRatio);
        });

        const stopDragging = (e: PointerEvent) => {
            if (!this.isDragging) return;
            this.isDragging = false;
            try {
                this.resizerEl.releasePointerCapture(e.pointerId);
            } catch {
                // Ignore if already released
            }
            document.body.classList.remove('resizing-panels');
            this.resizerEl.classList.remove('active');

            const rect = this.container.getBoundingClientRect();
            if (rect.width > 0) {
                const rawRatio = (e.clientX - rect.left) / rect.width;
                const finalRatio = Math.max(MIN_RATIO, Math.min(MAX_RATIO, rawRatio));
                localStorage.setItem(STORAGE_KEY, finalRatio.toString());
            }
        };

        this.resizerEl.addEventListener('pointerup', stopDragging);
        this.resizerEl.addEventListener('pointercancel', stopDragging);

        // Double-click to reset 50/50 balance
        this.resizerEl.addEventListener('dblclick', () => {
            this.applyRatio(DEFAULT_RATIO);
            localStorage.setItem(STORAGE_KEY, DEFAULT_RATIO.toString());
        });
    }
}
