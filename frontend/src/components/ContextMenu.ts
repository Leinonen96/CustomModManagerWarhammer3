/**
 * Custom Dark Studio Right-Click Context Menu for Mod Cards.
 * Supports quick load order manipulation, inspection, file manager opening, and clipboard copying.
 */
import { Mod } from '../types';
import { store } from '../state/store';
import { Toast } from './Toast';
import { tauriInvoke } from '../api/client';
import { showInputDialog } from './Modal';

const MENU_ICONS = {
    inspect: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`,
    pin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"></line><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.89A2 2 0 0 1 15 10.77V5a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v5.77a2 2 0 0 1-1.11 1.79l-1.78.89A2 2 0 0 0 5 15.24Z"></path></svg>`,
    pinFilled: `<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22" stroke-width="2.5"></line><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.89A2 2 0 0 1 15 10.77V5a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v5.77a2 2 0 0 1-1.11 1.79l-1.78.89A2 2 0 0 0 5 15.24Z"></path></svg>`,
    top: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline><line x1="6" y1="5" x2="18" y2="5"></line></svg>`,
    bottom: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline><line x1="6" y1="19" x2="18" y2="19"></line></svg>`,
    edit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`,
    add: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`,
    remove: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
    steam: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`,
    folder: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`,
    copy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`
};

export class ContextMenu {
    private static instance: ContextMenu | null = null;
    private menuEl!: HTMLElement;
    private activeMod: Mod | null = null;
    private isActiveList: boolean = false;
    private currentOrder: number | null = null;

    private constructor() {
        this.createMenuDOM();
        this.bindGlobalEvents();
    }

    public static getInstance(): ContextMenu {
        if (!ContextMenu.instance) {
            ContextMenu.instance = new ContextMenu();
        }
        return ContextMenu.instance;
    }

    private createMenuDOM(): void {
        let existing = document.getElementById('custom-context-menu');
        if (existing) existing.remove();

        this.menuEl = document.createElement('div');
        this.menuEl.id = 'custom-context-menu';
        this.menuEl.className = 'custom-context-menu';
        document.body.appendChild(this.menuEl);
    }

    private bindGlobalEvents(): void {
        // Close menu on outside click or scroll
        window.addEventListener('click', () => this.hide());
        window.addEventListener('contextmenu', (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest('.mod-item') && !target.closest('.custom-context-menu')) {
                this.hide();
            }
        });
        window.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Escape') this.hide();
        });
        window.addEventListener('resize', () => this.hide());
    }

    public show(x: number, y: number, mod: Mod, isActive: boolean, orderIndex: number | null = null): void {
        this.activeMod = mod;
        this.isActiveList = isActive;
        this.currentOrder = orderIndex;

        const totalActive = store.getActiveMods().length;
        const steamUrl = mod.url || (mod.id ? `https://steamcommunity.com/sharedfiles/filedetails/?id=${mod.id}` : '');
        const isPinned = store.isModPinned(mod.name) || Boolean(mod.id && store.isModPinned(mod.id));
        const pinnedPos = isPinned ? (store.getModPinnedPosition(mod.name) || (mod.id ? store.getModPinnedPosition(mod.id) : undefined)) : undefined;

        let itemsHtml = `
            <div class="menu-header">
                <span class="menu-mod-title">${this.escapeHtml(mod.title || mod.name)}</span>
                <span class="menu-mod-id">${isActive ? (isPinned ? `Active #${orderIndex} (Pinned)` : `Active #${orderIndex}`) : 'Available Mod'}</span>
            </div>
            <div class="menu-divider"></div>

            <button type="button" class="menu-item" data-menu-action="inspect">
                <span class="menu-icon">${MENU_ICONS.inspect}</span>
                <span class="menu-label">Inspect Pack & Conflicts</span>
            </button>
        `;

        if (isActive) {
            itemsHtml += `
                <button type="button" class="menu-item" data-menu-action="toggle-pin">
                    <span class="menu-icon">${isPinned ? MENU_ICONS.pinFilled : MENU_ICONS.pin}</span>
                    <span class="menu-label">${isPinned ? `Unpin from Position #${pinnedPos || orderIndex}` : `Pin to Position #${orderIndex} (Lock in Auto-Sort)`}</span>
                </button>
                <button type="button" class="menu-item" data-menu-action="top">
                    <span class="menu-icon">${MENU_ICONS.top}</span>
                    <span class="menu-label">Move to Top (Priority #1)</span>
                </button>
                <button type="button" class="menu-item" data-menu-action="bottom">
                    <span class="menu-icon">${MENU_ICONS.bottom}</span>
                    <span class="menu-label">Move to Bottom (Priority #${totalActive})</span>
                </button>
                <button type="button" class="menu-item" data-menu-action="change-pos">
                    <span class="menu-icon">${MENU_ICONS.edit}</span>
                    <span class="menu-label">Set Order Position...</span>
                </button>
                <button type="button" class="menu-item menu-item-danger" data-menu-action="deactivate">
                    <span class="menu-icon">${MENU_ICONS.remove}</span>
                    <span class="menu-label">Remove from Load Order</span>
                </button>
            `;
        } else {
            itemsHtml += `
                <button type="button" class="menu-item" data-menu-action="add-top">
                    <span class="menu-icon">${MENU_ICONS.top}</span>
                    <span class="menu-label">Add to Top (Priority #1)</span>
                </button>
                <button type="button" class="menu-item" data-menu-action="add-bottom">
                    <span class="menu-icon">${MENU_ICONS.bottom}</span>
                    <span class="menu-label">Add to Bottom (Priority #${totalActive + 1})</span>
                </button>
                <button type="button" class="menu-item" data-menu-action="inject">
                    <span class="menu-icon">${MENU_ICONS.add}</span>
                    <span class="menu-label">Insert at Specific Position...</span>
                </button>
            `;
        }

        itemsHtml += `
            <div class="menu-divider"></div>
            ${steamUrl ? `
                <button type="button" class="menu-item" data-menu-action="steam">
                    <span class="menu-icon">${MENU_ICONS.steam}</span>
                    <span class="menu-label">Open Steam Workshop Page</span>
                </button>
            ` : ''}
            ${mod.real_path ? `
                <button type="button" class="menu-item" data-menu-action="open-folder">
                    <span class="menu-icon">${MENU_ICONS.folder}</span>
                    <span class="menu-label">Show in File Manager</span>
                </button>
            ` : ''}
            <button type="button" class="menu-item" data-menu-action="copy-name">
                <span class="menu-icon">${MENU_ICONS.copy}</span>
                <span class="menu-label">Copy Pack Filename</span>
            </button>
            ${mod.id ? `
                <button type="button" class="menu-item" data-menu-action="copy-id">
                    <span class="menu-icon">${MENU_ICONS.copy}</span>
                    <span class="menu-label">Copy Workshop ID</span>
                </button>
            ` : ''}
        `;

        this.menuEl.innerHTML = itemsHtml;
        this.bindItemActions();

        // Position with viewport clamping
        this.menuEl.style.display = 'flex';
        const menuRect = this.menuEl.getBoundingClientRect();
        let posX = x;
        let posY = y;

        if (posX + menuRect.width > window.innerWidth - 8) {
            posX = window.innerWidth - menuRect.width - 8;
        }
        if (posY + menuRect.height > window.innerHeight - 8) {
            posY = window.innerHeight - menuRect.height - 8;
        }

        this.menuEl.style.left = `${Math.max(8, posX)}px`;
        this.menuEl.style.top = `${Math.max(8, posY)}px`;
        this.menuEl.classList.add('visible');
    }

    private bindItemActions(): void {
        this.menuEl.querySelectorAll('.menu-item').forEach(item => {
            const btn = item as HTMLButtonElement;
            btn.onclick = async (e: MouseEvent) => {
                e.stopPropagation();
                const action = btn.dataset.menuAction;
                const mod = this.activeMod;
                if (!mod) return;

                this.hide();

                if (action === 'inspect') {
                    store.setInspectedMod(mod);
                    store.setDrawerOpen(true);
                } else if (action === 'toggle-pin') {
                    const isNowPinned = store.toggleModPin(mod.name || mod.id, this.currentOrder || 1);
                    if (isNowPinned) {
                        Toast.success(`Pinned "${mod.title || mod.name}" to position #${this.currentOrder || 1}`);
                    } else {
                        Toast.info(`Unpinned "${mod.title || mod.name}"`);
                    }
                } else if (action === 'top') {
                    this.moveMod(mod, 1);
                } else if (action === 'bottom') {
                    this.moveMod(mod, store.getActiveMods().length);
                } else if (action === 'change-pos') {
                    this.promptChangePos(mod);
                } else if (action === 'deactivate') {
                    const activeMods = store.getActiveMods().filter(m => (m.name || m.id) !== (mod.name || mod.id));
                    store.setActiveMods(activeMods);
                    Toast.info(`Deactivated "${mod.title || mod.name}"`);
                } else if (action === 'add-top') {
                    const activeMods = [mod, ...store.getActiveMods()];
                    store.setActiveMods(activeMods);
                    Toast.success(`Added "${mod.title || mod.name}" at #1 (Top)`);
                } else if (action === 'add-bottom') {
                    const activeMods = [...store.getActiveMods(), mod];
                    store.setActiveMods(activeMods);
                    Toast.success(`Added "${mod.title || mod.name}" at #${activeMods.length} (Bottom)`);
                } else if (action === 'inject') {
                    this.promptInject(mod);
                } else if (action === 'steam') {
                    const steamUrl = mod.url || (mod.id ? `https://steamcommunity.com/sharedfiles/filedetails/?id=${mod.id}` : '');
                    if (steamUrl) tauriInvoke('open_url', { url: steamUrl });
                } else if (action === 'open-folder') {
                    if (mod.real_path) {
                        tauriInvoke('open_path', { path: mod.real_path });
                    }
                } else if (action === 'copy-name') {
                    navigator.clipboard.writeText(mod.name);
                    Toast.success('Copied pack filename to clipboard');
                } else if (action === 'copy-id') {
                    navigator.clipboard.writeText(mod.id);
                    Toast.success('Copied Workshop ID to clipboard');
                }
            };
        });
    }

    private moveMod(mod: Mod, targetPos: number): void {
        const activeMods = [...store.getActiveMods()];
        const currentIndex = activeMods.findIndex(m => 
            (m.name && mod.name && m.name === mod.name) || 
            (m.id && mod.id && m.id === mod.id) ||
            ((m.name || m.id) === (mod.name || mod.id))
        );
        if (currentIndex === -1) return;

        const clampedPos = Math.max(1, Math.min(targetPos, activeMods.length));
        if (currentIndex === clampedPos - 1) return;

        const [removed] = activeMods.splice(currentIndex, 1);
        activeMods.splice(clampedPos - 1, 0, removed);

        store.setActiveMods(activeMods);
        Toast.info(`Moved "${mod.title || mod.name}" to position #${clampedPos}`);
    }

    private async promptChangePos(mod: Mod): Promise<void> {
        const totalActive = store.getActiveMods().length;
        const currentIdx = store.getActiveMods().findIndex(m => (m.name || m.id) === (mod.name || mod.id)) + 1;
        const inputVal = await showInputDialog({
            title: 'Change Load Order Position',
            message: `Set position # for "${mod.title || mod.name}" (1 to ${totalActive}):`,
            defaultValue: currentIdx > 0 ? currentIdx : 1,
            inputType: 'number',
            min: 1,
            max: totalActive,
            confirmText: 'Apply Position'
        });

        if (inputVal !== null) {
            const pos = parseInt(inputVal.trim(), 10);
            if (!isNaN(pos) && pos >= 1) {
                this.moveMod(mod, pos);
            }
        }
    }

    private async promptInject(mod: Mod): Promise<void> {
        const totalActive = store.getActiveMods().length;
        const inputVal = await showInputDialog({
            title: 'Insert into Load Order',
            message: `Enter position # for "${mod.title || mod.name}" (1 to ${totalActive + 1}):`,
            defaultValue: 1,
            inputType: 'number',
            min: 1,
            max: totalActive + 1,
            confirmText: 'Insert Mod'
        });

        if (inputVal !== null) {
            const pos = parseInt(inputVal.trim(), 10);
            if (!isNaN(pos) && pos >= 1) {
                const activeMods = [...store.getActiveMods()];
                const clamped = Math.max(1, Math.min(pos, activeMods.length + 1));
                activeMods.splice(clamped - 1, 0, mod);
                store.setActiveMods(activeMods);
                Toast.success(`Inserted "${mod.title || mod.name}" at #${clamped}`);
            }
        }
    }

    public hide(): void {
        this.menuEl.classList.remove('visible');
        this.menuEl.style.display = 'none';
        this.activeMod = null;
    }

    private escapeHtml(str: string): string {
        const p = document.createElement('p');
        p.textContent = str;
        return p.innerHTML;
    }
}
