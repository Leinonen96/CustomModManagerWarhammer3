/**
 * Custom Studio Dark Dropdown Component (Replaces native OS <select>).
 * 100% DOM-rendered with zero OS native popup menus.
 */

export interface CustomSelectOption {
    value: string;
    label: string;
}

export class CustomSelect {
    private container: HTMLElement;
    private trigger!: HTMLButtonElement;
    private labelEl!: HTMLElement;
    private menuEl!: HTMLElement;
    private options: CustomSelectOption[] = [];
    private selectedValue: string = '';
    private isOpen: boolean = false;
    private changeCallbacks: ((value: string) => void)[] = [];
    private highlightedIndex: number = -1;
    private placeholder: string = '-- Select --';

    constructor(containerIdOrElement: string | HTMLElement, placeholder: string = '-- Select --') {
        this.placeholder = placeholder;
        if (typeof containerIdOrElement === 'string') {
            this.container = document.getElementById(containerIdOrElement) as HTMLElement;
        } else {
            this.container = containerIdOrElement;
        }

        this.render();
        this.bindEvents();
    }

    private render(): void {
        this.container.classList.add('custom-select-wrapper');
        this.container.innerHTML = `
            <button type="button" class="custom-select-trigger" aria-haspopup="listbox" aria-expanded="false">
                <span class="custom-select-label">${this.placeholder}</span>
                <span class="custom-select-arrow"></span>
            </button>
            <div class="custom-select-menu" role="listbox" style="display: none;"></div>
        `;

        this.trigger = this.container.querySelector('.custom-select-trigger') as HTMLButtonElement;
        this.labelEl = this.container.querySelector('.custom-select-label') as HTMLElement;
        this.menuEl = this.container.querySelector('.custom-select-menu') as HTMLElement;
    }

    private bindEvents(): void {
        // Toggle on click
        this.trigger.onclick = (e) => {
            e.stopPropagation();
            this.toggle();
        };

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (this.isOpen && !this.container.contains(e.target as Node)) {
                this.close();
            }
        });

        // Keyboard navigation
        this.container.addEventListener('keydown', (e: KeyboardEvent) => {
            if (!this.isOpen) {
                if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === ' ') {
                    e.preventDefault();
                    this.open();
                }
                return;
            }

            if (e.key === 'Escape') {
                e.preventDefault();
                this.close();
                this.trigger.focus();
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.highlightNext();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.highlightPrev();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (this.highlightedIndex >= 0 && this.highlightedIndex < this.options.length) {
                    this.setValue(this.options[this.highlightedIndex].value, true);
                    this.close();
                    this.trigger.focus();
                }
            }
        });
    }

    public setOptions(options: (CustomSelectOption | string)[], selectedValue?: string): void {
        this.options = options.map(opt => {
            if (typeof opt === 'string') {
                return { value: opt, label: opt || this.placeholder };
            }
            return opt;
        });

        if (selectedValue !== undefined) {
            this.selectedValue = selectedValue;
        }

        this.renderMenu();
        this.updateTriggerText();
    }

    private renderMenu(): void {
        this.menuEl.innerHTML = '';
        this.options.forEach((opt, index) => {
            const item = document.createElement('div');
            item.className = 'custom-select-item';
            if (opt.value === this.selectedValue) {
                item.classList.add('selected');
            }
            item.dataset.value = opt.value;
            item.dataset.index = index.toString();
            item.innerText = opt.label;

            item.onclick = (e) => {
                e.stopPropagation();
                this.setValue(opt.value, true);
                this.close();
            };

            this.menuEl.appendChild(item);
        });
    }

    public setValue(value: string, triggerChange = true): void {
        this.selectedValue = value;
        this.updateTriggerText();

        const items = this.menuEl.querySelectorAll('.custom-select-item');
        items.forEach(el => {
            const itemEl = el as HTMLElement;
            if (itemEl.dataset.value === value) {
                itemEl.classList.add('selected');
            } else {
                itemEl.classList.remove('selected');
            }
        });

        if (triggerChange) {
            this.changeCallbacks.forEach(fn => fn(value));
        }
    }

    public getValue(): string {
        return this.selectedValue;
    }

    public onChange(callback: (value: string) => void): void {
        this.changeCallbacks.push(callback);
    }

    public open(): void {
        this.isOpen = true;
        this.menuEl.style.display = 'block';
        this.container.classList.add('open');
        this.trigger.setAttribute('aria-expanded', 'true');

        // Highlight selected item
        const selectedIndex = this.options.findIndex(o => o.value === this.selectedValue);
        this.setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
    }

    public close(): void {
        this.isOpen = false;
        this.menuEl.style.display = 'none';
        this.container.classList.remove('open');
        this.trigger.setAttribute('aria-expanded', 'false');
    }

    public toggle(): void {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    private updateTriggerText(): void {
        const found = this.options.find(o => o.value === this.selectedValue);
        this.labelEl.innerText = found ? (found.label || this.placeholder) : this.placeholder;
    }

    private highlightNext(): void {
        const next = Math.min(this.highlightedIndex + 1, this.options.length - 1);
        this.setHighlightedIndex(next);
    }

    private highlightPrev(): void {
        const prev = Math.max(this.highlightedIndex - 1, 0);
        this.setHighlightedIndex(prev);
    }

    private setHighlightedIndex(index: number): void {
        this.highlightedIndex = index;
        const items = this.menuEl.querySelectorAll('.custom-select-item');
        items.forEach((el, i) => {
            if (i === index) {
                el.classList.add('highlighted');
                el.scrollIntoView({ block: 'nearest' });
            } else {
                el.classList.remove('highlighted');
            }
        });
    }
}
