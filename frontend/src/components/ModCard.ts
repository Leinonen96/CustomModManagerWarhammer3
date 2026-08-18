/**
 * Mod item card builder with interactive order badges, conflict indicators, and quick actions.
 */
import { Mod } from '../types';
import { tauriInvoke } from '../api/client';
import { convertFileSrc } from '@tauri-apps/api/core';
import { showInputDialog } from './Modal';
import { store } from '../state/store';

export interface ModCardCallbacks {
    onMoveToPosition?: (mod: Mod, targetPos: number) => void;
    onMoveToTop?: (mod: Mod) => void;
    onMoveToBottom?: (mod: Mod) => void;
    onDeactivate?: (mod: Mod) => void;
    onActivate?: (mod: Mod, position: 'top' | 'bottom' | number) => void;
    onInspect?: (mod: Mod) => void;
}

export function createModCard(
    mod: Mod,
    orderNumber: number | null = null,
    totalActive: number = 0,
    callbacks?: ModCardCallbacks
): HTMLElement {
    const div = document.createElement('div');
    div.className = 'mod-item';
    div.dataset.name = mod.name;
    div.dataset.id = mod.id;

    const inspectedMod = store.getInspectedMod();
    if (inspectedMod && (inspectedMod.name === mod.name || (inspectedMod.id && inspectedMod.id === mod.id))) {
        div.classList.add('mod-item-inspected');
    }

    // Format file size
    const sizeMb = mod.file_size_bytes
        ? (mod.file_size_bytes / (1024 * 1024)).toFixed(1) + ' MB'
        : '';

    // Fast image conversion via Tauri protocol
    let finalThumbSrc = '/static/gemini-svg.svg';
    if (mod.thumb) {
        if (mod.thumb.startsWith('/') || mod.thumb.includes(':\\')) {
            try {
                finalThumbSrc = convertFileSrc(mod.thumb);
            } catch {
                finalThumbSrc = mod.thumb;
            }
        } else {
            finalThumbSrc = mod.thumb;
        }
    }

    const isOrderActive = orderNumber !== null;
    const orderClass = isOrderActive ? 'order-num order-active order-editable' : 'order-num';
    const orderText = isOrderActive ? orderNumber.toString() : '-';

    // Conflict badges
    let conflictBadgesHtml = '';
    const conflictData = store.getConflictAnalysis();
    if (conflictData && conflictData.summaries) {
        const summary = conflictData.summaries[mod.name] || (mod.id ? conflictData.summaries[mod.id] : null);
        if (summary) {
            if (summary.fatal_startpos_count > 0) {
                conflictBadgesHtml += `<span class="conflict-badge badge-fatal" title="Fatal Startpos Collision: ${summary.fatal_startpos_count} file(s)">❌ STARTPOS</span>`;
            }
            const won = summary.script_overrides_won + summary.ui_overrides_won;
            if (won > 0) {
                conflictBadgesHtml += `<span class="conflict-badge badge-won" title="Overrides ${won} script/UI file(s) in lower mods">▲ ${won}</span>`;
            }
            const lost = summary.script_overrides_lost + summary.ui_overrides_lost;
            if (lost > 0) {
                conflictBadgesHtml += `<span class="conflict-badge badge-lost" title="Overridden by higher mods in ${lost} script/UI file(s)">▼ ${lost}</span>`;
            }
            if (summary.is_movie_pack || mod.is_movie_pack) {
                conflictBadgesHtml += `<span class="conflict-badge badge-movie" title="Movie Pack: Auto-loaded first by engine">🎬 MOVIE</span>`;
            }
            if (summary.missing_dependencies && summary.missing_dependencies.length > 0) {
                conflictBadgesHtml += `<span class="conflict-badge badge-dep" title="Missing ${summary.missing_dependencies.length} prerequisite mod(s)">⚠️ DEP</span>`;
            }
        }
    }

    let actionsHtml = '';
    if (orderNumber !== null) {
        actionsHtml = `
            <div class="mod-actions">
                <button type="button" class="card-action-btn btn-action-inspect" title="Inspect Pack Manifest & Conflicts">🔍</button>
                <button type="button" class="card-action-btn btn-action-top" title="Move to Top (Priority #1)">⤒</button>
                <button type="button" class="card-action-btn btn-action-bottom" title="Move to Bottom (Priority #${totalActive})">⤓</button>
                <button type="button" class="card-action-btn btn-action-remove" title="Deactivate Mod">✕</button>
            </div>
        `;
    } else {
        actionsHtml = `
            <div class="mod-actions">
                <button type="button" class="card-action-btn btn-action-inspect" title="Inspect Pack Manifest & Contents">🔍</button>
                <button type="button" class="card-action-btn btn-action-add" title="Add to bottom of Load Order">＋ Bottom</button>
                <button type="button" class="card-action-btn btn-action-add-top" title="Add to top of Load Order">＋ Top</button>
                <button type="button" class="card-action-btn btn-action-inject" title="Insert at specific position"># Insert</button>
            </div>
        `;
    }

    const steamUrl = mod.url || `https://steamcommunity.com/sharedfiles/filedetails/?id=${mod.id}`;

    div.innerHTML = `
        <div class="${orderClass}" title="${isOrderActive ? 'Click to change order position' : ''}">${orderText}</div>
        <div class="mod-thumb-container">
            <img class="mod-thumb" loading="lazy" decoding="async" src="${finalThumbSrc}" alt="${escapeHtml(mod.title || mod.name)}">
        </div>
        <div class="mod-info">
            <div class="mod-name-row">
                <span class="mod-title" title="${escapeHtml(mod.title || mod.name)}">${escapeHtml(mod.title || mod.name)}</span>
                ${sizeMb ? `<span class="mod-size-badge">${sizeMb}</span>` : ''}
            </div>
            <span class="mod-filename" title="${escapeHtml(mod.name)}">${escapeHtml(mod.name)}</span>
            <div class="mod-meta">
                <span class="mod-id">ID: ${escapeHtml(mod.id || 'Local')}</span>
                <span class="meta-dot">&bull;</span>
                <a href="${steamUrl}" class="steam-link" title="Open Steam Workshop page">View on Steam ↗</a>
                ${conflictBadgesHtml ? `<div class="conflict-badge-group">${conflictBadgesHtml}</div>` : ''}
            </div>
        </div>
        ${actionsHtml}
    `;

    // Handle Steam link
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

    // Handle inspect trigger
    const inspectBtn = div.querySelector('.btn-action-inspect') as HTMLButtonElement;
    if (inspectBtn) {
        inspectBtn.onclick = (e) => {
            e.stopPropagation();
            if (callbacks?.onInspect) {
                callbacks.onInspect(mod);
            } else {
                store.setInspectedMod(mod);
            }
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
            injectBtn.onclick = async (e) => {
                e.stopPropagation();
                const inputVal = await showInputDialog({
                    title: 'Inject Mod into Load Order',
                    message: `Enter position # for "${mod.title || mod.name}" (1 to ${totalActive + 1}):`,
                    defaultValue: 1,
                    inputType: 'number',
                    min: 1,
                    max: totalActive + 1,
                    confirmText: 'Inject at Position'
                });

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
