/**
 * Reusable modal, custom confirmation dialog, and custom prompt dialog.
 * 100% Custom Dark Studio Elements - Zero OS Native Popups.
 */

export class Modal {
    protected overlay: HTMLElement;
    protected modalBox: HTMLElement;
    private escapeHandler: (e: KeyboardEvent) => void;

    constructor(id: string) {
        let existing = document.getElementById(id);
        if (existing) {
            this.overlay = existing;
            this.modalBox = existing.querySelector('.modal') as HTMLElement;
        } else {
            this.overlay = document.createElement('div');
            this.overlay.id = id;
            this.overlay.className = 'modal-overlay';
            this.modalBox = document.createElement('div');
            this.modalBox.className = 'modal';
            this.overlay.appendChild(this.modalBox);
            document.body.appendChild(this.overlay);
        }

        this.escapeHandler = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && this.isOpen()) {
                this.close();
            }
        };

        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.close();
            }
        });
    }

    public open(): void {
        this.overlay.style.display = 'flex';
        document.addEventListener('keydown', this.escapeHandler);
    }

    public close(): void {
        this.overlay.style.display = 'none';
        document.removeEventListener('keydown', this.escapeHandler);
    }

    public isOpen(): boolean {
        return this.overlay.style.display === 'flex';
    }
}

/**
 * Custom Studio Confirmation Dialog
 */
export function showConfirmDialog(
    title: string,
    message: string,
    confirmText = 'Confirm',
    cancelText = 'Cancel'
): Promise<boolean> {
    return new Promise((resolve) => {
        let overlay = document.getElementById('confirm-modal-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'confirm-modal-overlay';
            overlay.className = 'modal-overlay';
            document.body.appendChild(overlay);
        }

        overlay.innerHTML = `
            <div class="modal confirm-modal">
                <div class="modal-header">
                    <h2 style="color: var(--color-danger);">${escapeHtml(title)}</h2>
                </div>
                <p class="modal-desc" style="margin-top: 8px;">${escapeHtml(message)}</p>
                <div class="modal-buttons" style="justify-content: flex-end;">
                    <button type="button" class="btn btn-secondary" id="confirm-cancel-btn">${cancelText}</button>
                    <button type="button" class="btn btn-danger" id="confirm-ok-btn">${confirmText}</button>
                </div>
            </div>
        `;

        overlay.style.display = 'flex';

        const cleanup = (result: boolean) => {
            overlay!.style.display = 'none';
            document.removeEventListener('keydown', keyHandler);
            resolve(result);
        };

        const keyHandler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') cleanup(false);
            if (e.key === 'Enter') cleanup(true);
        };

        document.addEventListener('keydown', keyHandler);
        document.getElementById('confirm-cancel-btn')!.onclick = () => cleanup(false);
        document.getElementById('confirm-ok-btn')!.onclick = () => cleanup(true);
    });
}

/**
 * Custom Studio Input / Numeric Injection Dialog (Replaces native prompt())
 */
export function showInputDialog(options: {
    title: string;
    message: string;
    defaultValue?: string | number;
    inputType?: 'number' | 'text';
    min?: number;
    max?: number;
    confirmText?: string;
    cancelText?: string;
}): Promise<string | null> {
    return new Promise((resolve) => {
        let overlay = document.getElementById('input-modal-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'input-modal-overlay';
            overlay.className = 'modal-overlay';
            document.body.appendChild(overlay);
        }

        const defVal = options.defaultValue !== undefined ? options.defaultValue.toString() : '1';
        const type = options.inputType || 'number';
        const minAttr = options.min !== undefined ? `min="${options.min}"` : '';
        const maxAttr = options.max !== undefined ? `max="${options.max}"` : '';

        overlay.innerHTML = `
            <div class="modal confirm-modal">
                <div class="modal-header">
                    <h2 style="color: var(--color-primary);">${escapeHtml(options.title)}</h2>
                </div>
                <p class="modal-desc" style="margin-top: 8px;">${escapeHtml(options.message)}</p>
                <div class="form-group" style="margin-bottom: 16px;">
                    <input type="${type}" id="custom-dialog-input" class="text-input" style="width: 100%;" 
                           value="${defVal}" ${minAttr} ${maxAttr}>
                </div>
                <div class="modal-buttons" style="justify-content: flex-end;">
                    <button type="button" class="btn btn-secondary" id="input-cancel-btn">${options.cancelText || 'Cancel'}</button>
                    <button type="button" class="btn btn-primary" id="input-ok-btn">${options.confirmText || 'Inject'}</button>
                </div>
            </div>
        `;

        overlay.style.display = 'flex';

        const input = document.getElementById('custom-dialog-input') as HTMLInputElement;
        if (input) {
            input.focus();
            input.select();
        }

        const cleanup = (val: string | null) => {
            overlay!.style.display = 'none';
            document.removeEventListener('keydown', keyHandler);
            resolve(val);
        };

        const keyHandler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') cleanup(null);
            if (e.key === 'Enter') cleanup(input.value.trim());
        };

        document.addEventListener('keydown', keyHandler);
        document.getElementById('input-cancel-btn')!.onclick = () => cleanup(null);
        document.getElementById('input-ok-btn')!.onclick = () => cleanup(input.value.trim());
    });
}

function escapeHtml(str: string): string {
    const p = document.createElement('p');
    p.textContent = str;
    return p.innerHTML;
}
