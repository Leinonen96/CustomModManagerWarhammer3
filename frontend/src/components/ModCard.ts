/**
 * High-performance Mod item card builder and reconciler.
 * Uses event delegation, lightweight DOM updates, and data-attributes for 120 FPS scrolling & rendering.
 */
import { Mod, ModConflictSummary } from '../types';
import { convertFileSrc } from '@tauri-apps/api/core';
import { store } from '../state/store';

export function getModIdentifier(mod: { name?: string; id?: string }): string {
    return mod.name || mod.id || '';
}

function escapeHtml(str: string): string {
    const p = document.createElement('p');
    p.textContent = str;
    return p.innerHTML;
}

const ICONS = {
    search: `<svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`,
    top: `<svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline><line x1="6" y1="5" x2="18" y2="5"></line></svg>`,
    bottom: `<svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline><line x1="6" y1="19" x2="18" y2="19"></line></svg>`,
    plus: `<svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`,
    remove: `<svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
    pin: `<svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"></line><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.89A2 2 0 0 1 15 10.77V5a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v5.77a2 2 0 0 1-1.11 1.79l-1.78.89A2 2 0 0 0 5 15.24Z"></path></svg>`,
    pinFilled: `<svg class="action-icon action-icon-pinned" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22" stroke-width="2.5"></line><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.89A2 2 0 0 1 15 10.77V5a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v5.77a2 2 0 0 1-1.11 1.79l-1.78.89A2 2 0 0 0 5 15.24Z"></path></svg>`,
    clock: `<svg class="chip-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`,
    disk: `<svg class="chip-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="12" x2="2" y2="12"></line><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path><line x1="6" y1="16" x2="6.01" y2="16"></line><line x1="10" y1="16" x2="10.01" y2="16"></line></svg>`,
    globe: `<svg class="chip-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`,
    folder: `<svg class="chip-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`,
    external: `<svg class="chip-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>`,
    core: `<svg class="badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>`,
    fatal: `<svg class="badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`,
    up: `<svg class="badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"></polyline></svg>`,
    down: `<svg class="badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>`,
    movie: `<svg class="badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="2" y1="7" x2="7" y2="7"></line><line x1="2" y1="17" x2="7" y2="17"></line><line x1="17" y1="17" x2="22" y2="17"></line><line x1="17" y1="7" x2="22" y2="7"></line></svg>`,
    dep: `<svg class="badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`
};

export function formatDate(timestamp?: number): { relative: string; full: string; isRecent: boolean } | null {
    if (!timestamp || timestamp <= 0) return null;
    const ms = timestamp < 1e11 ? timestamp * 1000 : timestamp;
    const date = new Date(ms);
    if (isNaN(date.getTime())) return null;

    const now = Date.now();
    const diffMs = now - ms;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    const isRecent = diffDay <= 7 && diffDay >= 0;

    let relative = '';
    if (diffDay === 0) {
        if (diffMin < 1) relative = 'Just now';
        else if (diffMin < 60) relative = `${diffMin}m ago`;
        else relative = `${diffHour}h ago`;
    } else if (diffDay === 1) {
        relative = 'Yesterday';
    } else if (diffDay < 30) {
        relative = `${diffDay}d ago`;
    } else if (diffDay < 365) {
        const months = Math.floor(diffDay / 30);
        relative = `${months}mo ago`;
    } else {
        const years = Math.floor(diffDay / 365);
        relative = `${years}y ago`;
    }

    const full = date.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    return { relative, full, isRecent };
}

export function formatFileSize(bytes?: number): string {
    if (!bytes || bytes <= 0) return '';
    if (bytes < 1024 * 1024) {
        return (bytes / 1024).toFixed(0) + ' KB';
    }
    if (bytes < 1024 * 1024 * 1024) {
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

function buildConflictBadgesHtml(summary: ModConflictSummary | null | undefined, isMoviePackMod: boolean = false, isPinned: boolean = false, pinnedPos?: number): string {
    let badgesHtml = '';
    if (isPinned) {
        badgesHtml += `<span class="conflict-badge badge-pinned" title="Pinned: Locked at position #${pinnedPos || 1} during Auto-Sort.">${ICONS.pinFilled} PIN #${pinnedPos || 1}</span>`;
    }
    if (!summary && !isMoviePackMod) return badgesHtml;

    if (summary?.is_framework) {
        badgesHtml += `<span class="conflict-badge badge-core" title="Core Framework: Foundational parent framework (e.g. Mixer, CBfM, MCT) loaded first.">${ICONS.core} CORE</span>`;
    }
    if (summary && summary.fatal_startpos_count > 0) {
        badgesHtml += `<span class="conflict-badge badge-fatal" title="Fatal Conflict: Alters startpos.esf. Multiple startpos mods active will cause campaign crashes.">${ICONS.fatal} STARTPOS</span>`;
    }
    if (summary) {
        const won = summary.script_overrides_won + summary.ui_overrides_won;
        if (won > 0) {
            badgesHtml += `<span class="conflict-badge badge-won" title="Winning Override: Overwrites ${won} file(s) in lower-priority active mods.">${ICONS.up} ${won}</span>`;
        }
        const lost = summary.script_overrides_lost + summary.ui_overrides_lost;
        if (lost > 0) {
            badgesHtml += `<span class="conflict-badge badge-lost" title="Overridden: ${lost} file(s) in this mod are overwritten by higher-priority active mods.">${ICONS.down} ${lost}</span>`;
        }
    }
    if (summary?.is_movie_pack || isMoviePackMod) {
        badgesHtml += `<span class="conflict-badge badge-movie" title="Movie Pack: Auto-loaded first by the game engine directly from /data (bypasses user script).">${ICONS.movie} MOVIE</span>`;
    }
    if (summary?.missing_dependencies && summary.missing_dependencies.length > 0) {
        badgesHtml += `<span class="conflict-badge badge-dep" title="Missing Dependency: Requires ${summary.missing_dependencies.length} prerequisite mod(s) not in active load order.">${ICONS.dep} DEP</span>`;
    }

    return badgesHtml;
}

export function buildConflictSignature(summary: ModConflictSummary | null | undefined, isMovie: boolean, isPinned: boolean = false): string {
    return [
        isPinned ? 1 : 0,
        summary?.is_framework ? 1 : 0,
        summary?.fatal_startpos_count || 0,
        (summary?.script_overrides_won || 0) + (summary?.ui_overrides_won || 0),
        (summary?.script_overrides_lost || 0) + (summary?.ui_overrides_lost || 0),
        (summary?.is_movie_pack || isMovie) ? 1 : 0,
        summary?.missing_dependencies?.length || 0
    ].join(':');
}

export function buildActionsHtml(isOrderActive: boolean, totalActive: number = 0, isPinned: boolean = false, orderNumber: number | null = null): string {
    if (isOrderActive) {
        const pinTitle = isPinned 
            ? `Unpin from position #${orderNumber || 1}` 
            : `Pin to fixed position #${orderNumber || 1} (locks during Auto-Sort)`;
        return `
            <div class="mod-actions">
                <button type="button" class="card-action-btn ${isPinned ? 'card-action-btn-pinned' : ''}" data-action="toggle-pin" title="${pinTitle}">
                    ${isPinned ? ICONS.pinFilled : ICONS.pin}<span>${isPinned ? 'Pinned' : 'Pin'}</span>
                </button>
                <button type="button" class="card-action-btn" data-action="top" title="Move to Top (Priority #1)">
                    ${ICONS.top}<span>Top</span>
                </button>
                <button type="button" class="card-action-btn" data-action="bottom" title="Move to Bottom (Priority #${totalActive})">
                    ${ICONS.bottom}<span>Bottom</span>
                </button>
                <button type="button" class="card-action-btn card-action-btn-remove" data-action="deactivate" title="Remove from active load order">
                    ${ICONS.remove}<span>Remove</span>
                </button>
            </div>
        `;
    }
    return `
        <div class="mod-actions">
            <button type="button" class="card-action-btn" data-action="add-top" title="Add to top of active load order">
                ${ICONS.top}<span>Top</span>
            </button>
            <button type="button" class="card-action-btn" data-action="inject" title="Insert at specific position">
                ${ICONS.plus}<span>Insert</span>
            </button>
            <button type="button" class="card-action-btn" data-action="add" title="Add to bottom of active load order">
                ${ICONS.bottom}<span>Bottom</span>
            </button>
        </div>
    `;
}

export function createModCard(
    mod: Mod,
    orderNumber: number | null = null,
    totalActive: number = 0
): HTMLElement {
    const div = document.createElement('div');
    div.className = 'mod-item';
    div.dataset.name = mod.name;
    div.dataset.id = mod.id;

    // Cache pre-computed search string on dataset to eliminate DOM queries during filtering
    const searchTokens = `${mod.name} ${mod.id} ${mod.title || ''}`.toLowerCase();
    div.dataset.search = searchTokens;

    const inspectedMod = store.getInspectedMod();
    if (inspectedMod && (inspectedMod.name === mod.name || (inspectedMod.id && inspectedMod.id === mod.id))) {
        div.classList.add('mod-item-inspected');
    }

    // Format file size & date
    const sizeFormatted = formatFileSize(mod.file_size_bytes);
    const dateInfo = formatDate(mod.last_modified);

    const isWorkshop = (mod.source_type || 'Workshop').toLowerCase() === 'workshop' || Boolean(mod.id && mod.id.length > 5 && !isNaN(Number(mod.id)));
    const steamUrl = mod.url || (isWorkshop && mod.id ? `https://steamcommunity.com/sharedfiles/filedetails/?id=${mod.id}` : '');
    div.dataset.steamUrl = steamUrl;

    // Fast image conversion via Tauri protocol
    let finalThumbSrc = '/gemini-svg.svg';
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
    const isPinned = isOrderActive && (store.isModPinned(mod.name) || Boolean(mod.id && store.isModPinned(mod.id)));
    const pinnedPos = isPinned ? (store.getModPinnedPosition(mod.name) || (mod.id ? store.getModPinnedPosition(mod.id) : undefined)) : undefined;

    let orderClass = 'order-num';
    if (isOrderActive) {
        orderClass = isPinned ? 'order-num order-active order-editable order-pinned' : 'order-num order-active order-editable';
    }
    const orderText = isOrderActive ? orderNumber.toString() : '-';

    // Conflict badges
    const conflictData = store.getConflictAnalysis();
    const summary = conflictData?.summaries ? (conflictData.summaries[mod.name] || (mod.id ? conflictData.summaries[mod.id] : null)) : null;
    const conflictSig = buildConflictSignature(summary, Boolean(mod.is_movie_pack), isPinned);
    div.dataset.conflictSig = conflictSig;
    const conflictBadgesHtml = buildConflictBadgesHtml(summary, Boolean(mod.is_movie_pack), isPinned, pinnedPos);

    const actionsHtml = buildActionsHtml(isOrderActive, totalActive, isPinned, orderNumber);

    div.innerHTML = `
        <div class="${orderClass}" data-action="edit-order" title="${isOrderActive ? (isPinned ? `Pinned at #${pinnedPos || orderNumber} (Click to change)` : 'Click to change order position') : ''}">${orderText}</div>
        <div class="mod-thumb-container">
            <img class="mod-thumb" width="72" height="72" loading="lazy" decoding="async" fetchpriority="low" src="${finalThumbSrc}" alt="${escapeHtml(mod.title || mod.name)}" onerror="this.src='/gemini-svg.svg';this.classList.add('fallback-thumb');">
        </div>
        <div class="mod-info">
            <span class="mod-title" title="${escapeHtml(mod.title || mod.name)}">${escapeHtml(mod.title || mod.name)}</span>
            <span class="mod-filename" title="${escapeHtml(mod.name)}">${escapeHtml(mod.name)}</span>
            <div class="mod-meta">
                ${dateInfo ? `<span class="meta-detail ${dateInfo.isRecent ? 'meta-recent' : ''}" title="Last Modified: ${dateInfo.full}">${ICONS.clock} ${dateInfo.isRecent ? 'Updated ' + dateInfo.relative : dateInfo.relative}</span>` : ''}
                ${dateInfo && sizeFormatted ? '<span class="meta-sep"></span>' : ''}
                ${sizeFormatted ? `<span class="meta-detail" title="Pack File Size: ${sizeFormatted}">${ICONS.disk} ${sizeFormatted}</span>` : ''}
                <span class="meta-sep"></span>
                <span class="meta-detail meta-origin ${isWorkshop ? 'meta-origin-ws' : 'meta-origin-local'}" title="${isWorkshop ? `Workshop ID: ${escapeHtml(mod.id || '')}` : 'Local /data/ Pack'}">${isWorkshop ? ICONS.globe : ICONS.folder} ${isWorkshop ? 'Workshop' : 'Local'}</span>
                ${steamUrl ? `<span class="meta-sep"></span><a href="${steamUrl}" class="meta-link steam-link" data-action="steam" title="Open Steam Workshop page">${ICONS.external} Steam</a>` : ''}
                ${conflictBadgesHtml ? `<div class="conflict-badge-group">${conflictBadgesHtml}</div>` : ''}
            </div>
        </div>
        <div class="mod-right-section">
            ${actionsHtml}
        </div>
    `;

    return div;
}

/**
 * In-place reconciliation updater for existing mod card DOM nodes.
 * Avoids destroying & re-creating DOM nodes, keeping image decode cache and layout alive.
 */
export function updateModCardState(
    cardEl: HTMLElement,
    orderNumber: number | null,
    totalActive: number
): void {
    const isOrderActive = orderNumber !== null;
    const currentOrderText = isOrderActive ? orderNumber.toString() : '-';
    const modName = cardEl.dataset.name || '';
    const modId = cardEl.dataset.id || '';
    const isPinned = isOrderActive && (store.isModPinned(modName) || Boolean(modId && store.isModPinned(modId)));
    const pinnedPos = isPinned ? (store.getModPinnedPosition(modName) || (modId ? store.getModPinnedPosition(modId) : undefined)) : undefined;

    const orderNumEl = cardEl.querySelector('.order-num') as HTMLElement | null;
    if (orderNumEl) {
        orderNumEl.innerText = currentOrderText;
        if (isOrderActive) {
            orderNumEl.className = isPinned ? 'order-num order-active order-editable order-pinned' : 'order-num order-active order-editable';
            orderNumEl.title = isPinned ? `Pinned at #${pinnedPos || orderNumber} (Click to change position)` : 'Click to change order position';
        } else {
            orderNumEl.className = 'order-num';
            orderNumEl.title = '';
        }
    }

    // Update Action Buttons
    const actionsContainer = cardEl.querySelector('.mod-actions') as HTMLElement | null;
    const isCurrentlyActiveCard = Boolean(cardEl.querySelector('[data-action="deactivate"]'));
    const isCurrentlyPinned = Boolean(cardEl.querySelector('.card-action-btn-pinned'));

    if (isOrderActive !== isCurrentlyActiveCard || isPinned !== isCurrentlyPinned || !actionsContainer) {
        const newActionsHtml = buildActionsHtml(isOrderActive, totalActive, isPinned, orderNumber);
        if (actionsContainer) {
            actionsContainer.outerHTML = newActionsHtml;
        } else {
            const rightSection = cardEl.querySelector('.mod-right-section');
            if (rightSection) {
                rightSection.insertAdjacentHTML('afterbegin', newActionsHtml);
            }
        }
    } else if (isOrderActive && actionsContainer) {
        // Update bottom button title if total active count shifted
        const bottomBtn = actionsContainer.querySelector('[data-action="bottom"]') as HTMLElement | null;
        if (bottomBtn) {
            bottomBtn.title = `Move to Bottom (Priority #${totalActive})`;
        }
    }
}

/**
 * Fast conflict badge updater with dirty signature checking.
 */
export function updateModCardConflicts(
    cardEl: HTMLElement,
    summary: ModConflictSummary | null | undefined,
    isMoviePack: boolean = false
): void {
    const newSig = buildConflictSignature(summary, isMoviePack);
    if (cardEl.dataset.conflictSig === newSig) {
        return; // No DOM change needed!
    }
    cardEl.dataset.conflictSig = newSig;

    const metaEl = cardEl.querySelector('.mod-meta');
    if (!metaEl) return;

    let badgeGroup = metaEl.querySelector('.conflict-badge-group') as HTMLElement | null;
    const badgesHtml = buildConflictBadgesHtml(summary, isMoviePack);

    if (!badgesHtml) {
        if (badgeGroup) badgeGroup.remove();
        return;
    }

    if (!badgeGroup) {
        badgeGroup = document.createElement('div');
        badgeGroup.className = 'conflict-badge-group';
        metaEl.appendChild(badgeGroup);
    }
    badgeGroup.innerHTML = badgesHtml;
}
