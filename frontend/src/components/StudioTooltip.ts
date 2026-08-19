/**
 * StudioTooltip: High-performance, zero-dependency custom tooltip engine.
 * Automatically suppresses OS-native tooltips and renders sleek, glassmorphic tooltips.
 */

export class StudioTooltip {
    private static instance: StudioTooltip;
    private tooltipEl: HTMLElement | null = null;
    private showTimeout: number | null = null;
    private currentTarget: HTMLElement | null = null;

    private constructor() {
        this.init();
    }

    public static init(): StudioTooltip {
        if (!StudioTooltip.instance) {
            StudioTooltip.instance = new StudioTooltip();
        }
        return StudioTooltip.instance;
    }

    private init(): void {
        this.createTooltipElement();
        this.bindEvents();
    }

    private createTooltipElement(): void {
        if (this.tooltipEl) return;
        this.tooltipEl = document.createElement('div');
        this.tooltipEl.id = 'studio-tooltip';
        this.tooltipEl.className = 'studio-tooltip';
        this.tooltipEl.setAttribute('role', 'tooltip');
        this.tooltipEl.setAttribute('aria-hidden', 'true');
        document.body.appendChild(this.tooltipEl);
    }

    private bindEvents(): void {
        document.addEventListener('mouseover', (e) => this.handleMouseOver(e), { passive: true });
        document.addEventListener('mouseout', (e) => this.handleMouseOut(e), { passive: true });
        document.addEventListener('mousedown', () => this.hide(), { passive: true });
        window.addEventListener('scroll', () => this.hide(), { passive: true });
    }

    private handleMouseOver(e: MouseEvent): void {
        const target = (e.target as HTMLElement)?.closest('[title], [data-tooltip], [data-studio-tooltip]') as HTMLElement;
        if (!target) return;

        // Extract and suppress native OS tooltip
        if (target.hasAttribute('title')) {
            const rawTitle = target.getAttribute('title') || '';
            if (rawTitle.trim()) {
                target.setAttribute('data-studio-tooltip', rawTitle);
            }
            target.removeAttribute('title');
        }

        const text = target.getAttribute('data-studio-tooltip') || target.getAttribute('data-tooltip');
        if (!text || !text.trim()) return;

        this.currentTarget = target;
        if (this.showTimeout) {
            clearTimeout(this.showTimeout);
        }

        // Snappy 120ms reveal delay for smooth UX
        this.showTimeout = window.setTimeout(() => {
            this.show(target, text);
        }, 120);
    }

    private handleMouseOut(e: MouseEvent): void {
        const relatedTarget = e.relatedTarget as HTMLElement;
        if (this.currentTarget && (!relatedTarget || !this.currentTarget.contains(relatedTarget))) {
            this.hide();
        }
    }

    private show(target: HTMLElement, text: string): void {
        if (!this.tooltipEl) return;

        this.tooltipEl.textContent = text;
        this.tooltipEl.classList.add('studio-tooltip-visible');
        this.tooltipEl.setAttribute('aria-hidden', 'false');

        // Calculate Position
        const targetRect = target.getBoundingClientRect();
        const tooltipRect = this.tooltipEl.getBoundingClientRect();
        const gap = 6;
        const padding = 8;

        // Horizontal Centering
        let left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
        if (left < padding) {
            left = padding;
        } else if (left + tooltipRect.width > window.innerWidth - padding) {
            left = window.innerWidth - tooltipRect.width - padding;
        }

        // Vertical Placement (Prefer above, flip below if not enough space)
        let top = targetRect.top - tooltipRect.height - gap;
        let isBelow = false;

        if (top < padding) {
            top = targetRect.bottom + gap;
            isBelow = true;
        }

        this.tooltipEl.style.left = `${Math.round(left)}px`;
        this.tooltipEl.style.top = `${Math.round(top)}px`;
        this.tooltipEl.classList.toggle('studio-tooltip-below', isBelow);
    }

    private hide(): void {
        if (this.showTimeout) {
            clearTimeout(this.showTimeout);
            this.showTimeout = null;
        }
        this.currentTarget = null;
        if (this.tooltipEl) {
            this.tooltipEl.classList.remove('studio-tooltip-visible');
            this.tooltipEl.setAttribute('aria-hidden', 'true');
        }
    }
}
