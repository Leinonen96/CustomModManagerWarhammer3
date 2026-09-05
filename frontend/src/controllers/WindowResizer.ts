/**
 * Frameless Window Edge Resizer for Linux / Windows (Tauri v2).
 */
import { getCurrentWindow } from '@tauri-apps/api/window';

type ResizeDirection = 'East' | 'North' | 'NorthEast' | 'NorthWest' | 'South' | 'SouthEast' | 'SouthWest' | 'West';

export class WindowResizer {
    private appWindow = getCurrentWindow();
    private container!: HTMLElement;

    constructor() {
        this.render();
        this.bindEvents();
    }

    private render(): void {
        this.container = document.createElement('div');
        this.container.className = 'window-resize-handles';
        this.container.innerHTML = `
            <div class="resize-handle resize-top" data-dir="North"></div>
            <div class="resize-handle resize-bottom" data-dir="South"></div>
            <div class="resize-handle resize-left" data-dir="West"></div>
            <div class="resize-handle resize-right" data-dir="East"></div>
            <div class="resize-handle resize-top-left" data-dir="NorthWest"></div>
            <div class="resize-handle resize-top-right" data-dir="NorthEast"></div>
            <div class="resize-handle resize-bottom-left" data-dir="SouthWest"></div>
            <div class="resize-handle resize-bottom-right" data-dir="SouthEast"></div>
        `;
        document.body.appendChild(this.container);
    }

    private bindEvents(): void {
        const handles = this.container.querySelectorAll<HTMLElement>('.resize-handle');
        handles.forEach(handle => {
            handle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                const dir = handle.dataset.dir as ResizeDirection;
                if (dir) {
                    this.appWindow.startResizeDragging(dir);
                }
            });
        });

        // Hide handles when maximized - debounced to avoid IPC flood during edge dragging
        let resizeDebounce: any = null;
        this.appWindow.onResized(() => {
            clearTimeout(resizeDebounce);
            resizeDebounce = setTimeout(async () => {
                try {
                    const isMaximized = await this.appWindow.isMaximized();
                    this.container.style.display = isMaximized ? 'none' : 'block';
                } catch {
                    // Ignore transient IPC errors on minimize/close
                }
            }, 100);
        });
    }
}
