/**
 * Reusable modal and confirmation dialog component.
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

export function showConfirmDialog(title: string, message: string, confirmText = 'Confirm', cancelText = 'Cancel'): Promise<boolean> {
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
                <h3 style="margin-top: 0; color: #f87171;">${title}</h3>
                <p style="color: #d1d5db; line-height: 1.5; margin: 15px 0;">${message}</p>
                <div class="modal-buttons">
                    <button class="btn-secondary" id="confirm-cancel-btn">${cancelText}</button>
                    <button class="btn-red" id="confirm-ok-btn">${confirmText}</button>
                </div>
            </div>
        `;

        overlay.style.display = 'flex';

        const cleanup = (result: boolean) => {
            overlay!.style.display = 'none';
            resolve(result);
        };

        document.getElementById('confirm-cancel-btn')!.onclick = () => cleanup(false);
        document.getElementById('confirm-ok-btn')!.onclick = () => cleanup(true);
    });
}
