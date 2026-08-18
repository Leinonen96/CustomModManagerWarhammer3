/**
 * Modern, non-blocking toast notification system.
 */

export type ToastType = 'success' | 'error' | 'info' | 'warning';

class ToastManager {
    private container: HTMLElement | null = null;

    private ensureContainer(): HTMLElement {
        if (!this.container || !document.body.contains(this.container)) {
            this.container = document.createElement('div');
            this.container.id = 'toast-container';
            this.container.className = 'toast-container';
            document.body.appendChild(this.container);
        }
        return this.container;
    }

    public show(message: string, type: ToastType = 'info', duration: number = 4000): void {
        const container = this.ensureContainer();

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        const iconMap: Record<ToastType, string> = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };

        toast.innerHTML = `
            <div class="toast-icon">${iconMap[type]}</div>
            <div class="toast-message">${this.escapeHtml(message)}</div>
            <button class="toast-close" aria-label="Close">&times;</button>
        `;

        const closeBtn = toast.querySelector('.toast-close') as HTMLElement;
        const removeToast = () => {
            toast.classList.add('toast-fadeout');
            setTimeout(() => {
                if (toast.parentElement) {
                    toast.parentElement.removeChild(toast);
                }
            }, 300);
        };

        closeBtn.onclick = removeToast;

        container.appendChild(toast);

        if (duration > 0) {
            setTimeout(removeToast, duration);
        }
    }

    public success(message: string, duration?: number): void {
        this.show(message, 'success', duration);
    }

    public error(message: string, duration?: number): void {
        this.show(message, 'error', duration || 5000);
    }

    public warning(message: string, duration?: number): void {
        this.show(message, 'warning', duration);
    }

    public info(message: string, duration?: number): void {
        this.show(message, 'info', duration);
    }

    private escapeHtml(str: string): string {
        const div = document.createElement('div');
        div.innerText = str;
        return div.innerHTML;
    }
}

export const Toast = new ToastManager();
