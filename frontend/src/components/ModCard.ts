/**
 * Mod item card builder with interactive order badges and quick-action buttons.
 */
import { Mod } from '../types';
import { tauriInvoke } from '../api/client';

export interface ModCardCallbacks {
    onMoveToPosition?: (mod: Mod, targetPos: number) => void;
    onMoveToTop?: (mod: Mod) => void;
    onMoveToBottom?: (mod: Mod) => void;
    onDeactivate?: (mod: Mod) => void;
    onActivate?: (mod: Mod, position: 'top' | 'bottom' | number) => void;
}

export function createModCard(
    mod: Mod,
    orderNumber: number | null = null,
    totalActive: number = 0,
    callbacks?: ModCardCallbacks
): HTMLDivElement {
    const div = document.createElement('div');
    div.className = 'mod-item';
    div.dataset.id = mod.id;
    div.dataset.name = mod.name;

    const steamUrl = mod.url || `https://steamcommunity.com/sharedfiles/filedetails/?id=${mod.id}`;
    const displayTitle = mod.title || mod.name.replace(/\.pack$/i, '').replace(/_/g, ' ');
    const displayOrder = orderNumber !== null ? orderNumber.toString() : '-';
    const thumbSrc = mod.thumb && mod.thumb.length > 0 ? mod.thumb : '/static/gemini-svg.svg';

    // Format file size
    let sizeStr = '';
    if (mod.file_size_bytes && mod.file_size_bytes > 0) {
        const mb = (mod.file_size_bytes / (1024 * 1024)).toFixed(1);
        sizeStr = `<span class="mod-size-badge">${mb} MB</span>`;
    }

    // Action buttons depending on active vs inactive
    let actionsHtml = '';
    if (orderNumber !== null) {
        actionsHtml = `
            <div class="mod-actions">
                <button type="button" class="card-action-btn btn-action-top" title="Jump to Top (#1)">⤒</button>
                <button type="button" class="card-action-btn btn-action-bottom" title="Jump to Bottom">⤓</button>
                <button type="button" class="card-action-btn btn-action-remove" title="Deactivate Mod">✕</button>
            </div>
        `;
    } else {
        actionsHtml = `
            <div class="mod-actions">
                <button type="button" class="card-action-btn btn-action-add-top" title="Add to Top (#1)">⤒ Top</button>
                <button type="button" class="card-action-btn btn-action-inject" title="Inject at custom position"># Insert</button>
                <button type="button" class="card-action-btn btn-action-add" title="Add to Bottom">➕</button>
            </div>
        `;
    }

    div.innerHTML = `
        <div class="order-num ${orderNumber !== null ? 'order-active order-editable' : ''}" 
             title="${orderNumber !== null ? 'Click to edit load order number' : ''}">
             ${displayOrder}
        </div>
        <div class="mod-thumb-container">
            <img src="${thumbSrc}" alt="${escapeHtml(displayTitle)}" class="mod-thumb" loading="lazy" decoding="async">
        </div>
        <div class="mod-info">
            <div class="mod-name-row">
                <div class="mod-title" title="${escapeHtml(displayTitle)}">${escapeHtml(displayTitle)}</div>
                ${sizeStr}
            </div>
            <div class="mod-filename" title="${escapeHtml(mod.name)}">${escapeHtml(mod.name)}</div>
            <div class="mod-meta">
                <span>ID: ${escapeHtml(mod.id)}</span>
                <span class="meta-dot">&bull;</span>
                <a href="${steamUrl}" class="steam-link" title="Open Steam Workshop page">View on Steam ↗</a>
            </div>
        </div>
        ${actionsHtml}
    `;

    // Handle Steam link native browser open
    const steamLink = div.querySelector('.steam-link') as HTMLAnchorElement;
    if (steamLink) {
        steamLink.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            tauriInvoke('open_url', { url: steamUrl });
        };
    }

    // Handle thumbnail fallback
    const img = div.querySelector('.mod-thumb') as HTMLImageElement;
    if (img) {
        img.onerror = () => {
            img.src = '/static/gemini-svg.svg';
            img.classList.add('fallback-thumb');
        };
    }

    // Bind Badge click-to-edit for Active mods
    if (orderNumber !== null && callbacks?.onMoveToPosition) {
        const orderNumEl = div.querySelector('.order-num') as HTMLElement;
        orderNumEl.onclick = (e) => {
            e.stopPropagation();
            if (orderNumEl.querySelector('input')) return; // Already editing

            const currentPos = orderNumber;
            orderNumEl.innerHTML = `<input type="number" class="order-input" min="1" max="${Math.max(1, totalActive)}" value="${currentPos}">`;
            const input = orderNumEl.querySelector('input') as HTMLInputElement;
            input.focus();
            input.select();

            const applyPosition = () => {
                const val = parseInt(input.value, 10);
                if (!isNaN(val) && val > 0 && val !== currentPos) {
                    callbacks.onMoveToPosition!(mod, val);
                } else {
                    orderNumEl.innerText = currentPos.toString();
                }
            };

            input.onkeydown = (ke) => {
                if (ke.key === 'Enter') {
                    ke.preventDefault();
                    applyPosition();
                } else if (ke.key === 'Escape') {
                    orderNumEl.innerText = currentPos.toString();
                }
            };

            input.onblur = () => {
                applyPosition();
            };
        };
    }

    // Bind Active action buttons
    if (orderNumber !== null) {
        const topBtn = div.querySelector('.btn-action-top') as HTMLButtonElement;
        const bottomBtn = div.querySelector('.btn-action-bottom') as HTMLButtonElement;
        const removeBtn = div.querySelector('.btn-action-remove') as HTMLButtonElement;

        if (topBtn && callbacks?.onMoveToTop) {
            topBtn.onclick = (e) => {
                e.stopPropagation();
                callbacks.onMoveToTop!(mod);
            };
        }

        if (bottomBtn && callbacks?.onMoveToBottom) {
            bottomBtn.onclick = (e) => {
                e.stopPropagation();
                callbacks.onMoveToBottom!(mod);
            };
        }

        if (removeBtn && callbacks?.onDeactivate) {
            removeBtn.onclick = (e) => {
                e.stopPropagation();
                callbacks.onDeactivate!(mod);
            };
        }
    } else {
        // Bind Inactive action buttons
        const addBtn = div.querySelector('.btn-action-add') as HTMLButtonElement;
        const addTopBtn = div.querySelector('.btn-action-add-top') as HTMLButtonElement;
        const injectBtn = div.querySelector('.btn-action-inject') as HTMLButtonElement;

        if (addBtn && callbacks?.onActivate) {
            addBtn.onclick = (e) => {
                e.stopPropagation();
                callbacks.onActivate!(mod, 'bottom');
            };
        }

        if (addTopBtn && callbacks?.onActivate) {
            addTopBtn.onclick = (e) => {
                e.stopPropagation();
                callbacks.onActivate!(mod, 'top');
            };
        }

        if (injectBtn && callbacks?.onActivate) {
            injectBtn.onclick = (e) => {
                e.stopPropagation();
                const inputVal = prompt(`Inject "${mod.title || mod.name}" at position # (1 to ${totalActive + 1}):`, '1');
                if (inputVal !== null) {
                    const pos = parseInt(inputVal.trim(), 10);
                    if (!isNaN(pos) && pos >= 1) {
                        callbacks.onActivate!(mod, pos);
                    }
                }
            };
        }
    }

    return div;
}

function escapeHtml(str: string): string {
    const p = document.createElement('p');
    p.textContent = str;
    return p.innerHTML;
}
