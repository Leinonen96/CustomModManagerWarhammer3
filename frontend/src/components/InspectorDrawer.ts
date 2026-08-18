/**
 * Collapsible Right Slide-Over Inspector Drawer with 3-Tier Progressive Disclosure.
 * Displays Pack File Manifests, Conflict Diffs, Dependencies, and Technical Specifications.
 */
import { store } from '../state/store';
import { Mod, PackedFileManifest, FileConflictDetail, ModConflictSummary } from '../types';
import { getPackFileTree, autoSortDependencies } from '../api/conflictApi';
import { Toast } from './Toast';
import { convertFileSrc } from '@tauri-apps/api/core';
import { tauriInvoke } from '../api/client';

export class InspectorDrawer {
    private drawerEl!: HTMLElement;
    private titleEl!: HTMLElement;
    private subtitleEl!: HTMLElement;
    private bodyEl!: HTMLElement;
    private closeBtn!: HTMLButtonElement;
    private autoSortBtn!: HTMLButtonElement;
    private tabs!: NodeListOf<HTMLButtonElement>;
    private conflictsBadge!: HTMLElement;

    private cachedManifests: Map<string, PackedFileManifest> = new Map();
    private isLoadingManifest: boolean = false;

    constructor() {
        this.createDrawerDOM();
        this.bindEvents();
        this.bindStore();
    }

    private createDrawerDOM(): void {
        let existing = document.getElementById('inspector-drawer');
        if (existing) existing.remove();

        this.drawerEl = document.createElement('aside');
        this.drawerEl.id = 'inspector-drawer';
        this.drawerEl.className = 'inspector-drawer';

        this.drawerEl.innerHTML = `
            <div class="drawer-header">
                <div class="drawer-title-box">
                    <span class="drawer-pretitle" id="drawer-pretitle">Mod Inspector</span>
                    <h3 class="drawer-title" id="drawer-mod-title">No Mod Selected</h3>
                    <span class="drawer-subtitle" id="drawer-mod-subtitle"></span>
                </div>
                <button type="button" id="drawer-close-btn" class="drawer-close-btn" title="Close Drawer (Escape)">✕</button>
            </div>

            <div class="drawer-tabs">
                <button type="button" class="drawer-tab active" data-tab="overview">Overview</button>
                <button type="button" class="drawer-tab" data-tab="conflicts">
                    Conflicts Diff <span id="tab-conflicts-count" class="tab-badge">0</span>
                </button>
                <button type="button" class="drawer-tab" data-tab="dependencies">Dependencies</button>
            </div>

            <div class="drawer-body" id="drawer-body">
                <div class="drawer-empty-state">
                    <p>Select any mod or click 🔍 to inspect its internal pack manifest, dependencies, and conflicts.</p>
                </div>
            </div>

            <div class="drawer-footer">
                <button type="button" id="drawer-btn-autosort" class="btn btn-secondary" title="Auto-sort active load order based on dependencies">
                    ⚡ Auto-Sort Order
                </button>
            </div>
        `;

        // Insert inside #app-workspace or body
        const workspace = document.getElementById('app-workspace') || document.body;
        workspace.appendChild(this.drawerEl);

        this.titleEl = this.drawerEl.querySelector('#drawer-mod-title') as HTMLElement;
        this.subtitleEl = this.drawerEl.querySelector('#drawer-mod-subtitle') as HTMLElement;
        this.bodyEl = this.drawerEl.querySelector('#drawer-body') as HTMLElement;
        this.closeBtn = this.drawerEl.querySelector('#drawer-close-btn') as HTMLButtonElement;
        this.autoSortBtn = this.drawerEl.querySelector('#drawer-btn-autosort') as HTMLButtonElement;
        this.conflictsBadge = this.drawerEl.querySelector('#tab-conflicts-count') as HTMLElement;
        this.tabs = this.drawerEl.querySelectorAll('.drawer-tab');
    }

    private bindEvents(): void {
        this.closeBtn.onclick = () => {
            store.setDrawerOpen(false);
        };

        this.tabs.forEach(tab => {
            tab.onclick = () => {
                const targetTab = tab.dataset.tab as 'overview' | 'conflicts' | 'dependencies';
                store.setDrawerTab(targetTab);
            };
        });

        this.autoSortBtn.onclick = async () => {
            await this.handleAutoSort();
        };

        // Escape key closes drawer
        window.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Escape' && store.getIsDrawerOpen()) {
                store.setDrawerOpen(false);
            }
        });
    }

    private bindStore(): void {
        store.subscribe('DRAWER_TOGGLED', () => this.syncDrawerVisibility());
        store.subscribe('INSPECTOR_CHANGED', () => this.render());
        store.subscribe('CONFLICTS_CHANGED', () => this.render());
    }

    private syncDrawerVisibility(): void {
        const isOpen = store.getIsDrawerOpen();
        if (isOpen) {
            this.drawerEl.classList.add('open');
            document.body.classList.add('drawer-open');
        } else {
            this.drawerEl.classList.remove('open');
            document.body.classList.remove('drawer-open');
        }
    }

    public async inspectMod(mod: Mod): Promise<void> {
        store.setInspectedMod(mod);
    }

    private async render(): Promise<void> {
        const mod = store.getInspectedMod();
        const activeTab = store.getDrawerTab();

        // Update active tab buttons
        this.tabs.forEach(t => {
            if (t.dataset.tab === activeTab) {
                t.classList.add('active');
            } else {
                t.classList.remove('active');
            }
        });

        if (!mod) {
            this.titleEl.innerText = 'No Mod Selected';
            this.subtitleEl.innerText = '';
            this.bodyEl.innerHTML = `
                <div class="drawer-empty-state">
                    <p>Select any mod or click 🔍 on a card to inspect pack files, dependencies, and conflicts.</p>
                </div>
            `;
            this.conflictsBadge.innerText = '0';
            this.conflictsBadge.style.display = 'none';
            return;
        }

        this.titleEl.innerText = mod.title || mod.name;
        
        const wsText = mod.id && mod.id.length > 5 ? `Workshop ID: ${mod.id}` : 'Local Mod';
        const dateText = mod.last_modified_str ? ` • Updated: ${mod.last_modified_str}` : '';
        this.subtitleEl.innerText = `${wsText}${dateText}`;

        // Fetch Conflict summary
        const conflictAnalysis = store.getConflictAnalysis();
        const summary: ModConflictSummary | undefined = conflictAnalysis?.summaries?.[mod.name] || 
            (mod.id ? conflictAnalysis?.summaries?.[mod.id] : undefined);

        const totalConflicts = summary ? summary.total_conflicts : 0;
        this.conflictsBadge.innerText = totalConflicts.toString();
        this.conflictsBadge.style.display = totalConflicts > 0 ? 'inline-block' : 'none';

        // Load Manifest if not cached
        let manifest = this.cachedManifests.get(mod.real_path);
        if (!manifest && mod.real_path && !this.isLoadingManifest) {
            this.isLoadingManifest = true;
            try {
                manifest = await getPackFileTree(mod.real_path);
                this.cachedManifests.set(mod.real_path, manifest);
            } catch (err) {
                console.warn('Failed to load pack manifest:', err);
            } finally {
                this.isLoadingManifest = false;
            }
        }

        if (activeTab === 'overview') {
            this.renderOverviewTab(mod, manifest, summary);
        } else if (activeTab === 'conflicts') {
            this.renderConflictsTab(mod, conflictAnalysis, summary);
        } else if (activeTab === 'dependencies') {
            this.renderDependenciesTab(mod, manifest, summary);
        }
    }

    private renderOverviewTab(mod: Mod, manifest?: PackedFileManifest, summary?: ModConflictSummary): void {
        const sizeMb = mod.file_size_bytes
            ? (mod.file_size_bytes / (1024 * 1024)).toFixed(1) + ' MB'
            : 'Unknown';

        let finalThumbSrc = '/static/gemini-svg.svg';
        if (mod.thumb) {
            try {
                finalThumbSrc = convertFileSrc(mod.thumb);
            } catch {
                finalThumbSrc = mod.thumb;
            }
        }

        const packType = manifest?.pack_type || (mod.is_movie_pack ? 'Movie' : 'Mod');
        const fileCount = manifest?.file_count || manifest?.files?.length || 0;

        // File category breakdown
        let dbCount = 0;
        let scriptCount = 0;
        let uiCount = 0;
        let startposCount = 0;
        let otherCount = 0;

        if (manifest?.files) {
            manifest.files.forEach(f => {
                if (f.startsWith('db/')) dbCount++;
                else if (f.startsWith('script/')) scriptCount++;
                else if (f.startsWith('ui/')) uiCount++;
                else if (f.includes('startpos.esf')) startposCount++;
                else otherCount++;
            });
        }

        const isWorkshop = (mod.source_type || 'Workshop').toLowerCase() === 'workshop' || Boolean(mod.id && mod.id.length > 5);
        const pfhRev = manifest?.pfh_version || 'PFH5';
        const bitmask = manifest?.header_bitmask_hex || '0x00000003';
        const hash = manifest?.sha256_hash || 'Calculating checksum...';

        this.bodyEl.innerHTML = `
            <div class="drawer-overview">
                <div class="drawer-mod-hero">
                    <img class="drawer-mod-thumb" src="${finalThumbSrc}" alt="${escapeHtml(mod.title || mod.name)}">
                    <div class="drawer-mod-details">
                        <span class="drawer-filename">${escapeHtml(mod.name)}</span>
                        <div class="drawer-badge-row">
                            <span class="drawer-pill ${isWorkshop ? 'pill-ws' : 'pill-local'}">${isWorkshop ? 'Steam Workshop' : 'Local /data'}</span>
                            <span class="drawer-pill pill-type">${typeof packType === 'string' ? packType : 'Mod'} Pack</span>
                            <span class="drawer-pill pill-size">${sizeMb}</span>
                        </div>
                    </div>
                </div>

                <div class="drawer-section">
                    <h4 class="drawer-section-title">Pack Contents Breakdown (${fileCount} total files)</h4>
                    <div class="drawer-stat-grid">
                        <div class="stat-card">
                            <span class="stat-val">${dbCount}</span>
                            <span class="stat-label">DB Tables</span>
                        </div>
                        <div class="stat-card">
                            <span class="stat-val">${scriptCount}</span>
                            <span class="stat-label">Lua Scripts</span>
                        </div>
                        <div class="stat-card">
                            <span class="stat-val">${uiCount}</span>
                            <span class="stat-label">UI Layouts</span>
                        </div>
                        <div class="stat-card ${startposCount > 0 ? 'stat-card-danger' : ''}">
                            <span class="stat-val">${startposCount}</span>
                            <span class="stat-label">Startpos</span>
                        </div>
                    </div>
                </div>

                ${summary && summary.total_conflicts > 0 ? `
                    <div class="drawer-section">
                        <h4 class="drawer-section-title">Active Conflict Impact</h4>
                        <div class="conflict-summary-box">
                            <div class="summary-stat-row">
                                <span class="summary-label">Script/UI Overrides Won:</span>
                                <span class="summary-val val-won">▲ ${summary.script_overrides_won + summary.ui_overrides_won} files</span>
                            </div>
                            <div class="summary-stat-row">
                                <span class="summary-label">Script/UI Overrides Lost:</span>
                                <span class="summary-val val-lost">▼ ${summary.script_overrides_lost + summary.ui_overrides_lost} files</span>
                            </div>
                            ${summary.fatal_startpos_count > 0 ? `
                                <div class="summary-stat-row summary-danger">
                                    <span class="summary-label">Fatal Startpos Collisions:</span>
                                    <span class="summary-val">❌ ${summary.fatal_startpos_count} file(s)</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                ` : ''}

                <!-- Tier 3: Collapsible Advanced Technical Specs -->
                <div class="drawer-section">
                    <details class="tech-specs-accordion" open>
                        <summary class="tech-specs-summary">
                            <span>⚙️ Advanced Technical Specifications</span>
                        </summary>
                        <div class="tech-specs-content">
                            <div class="tech-spec-row">
                                <span class="tech-spec-label">PFH Revision:</span>
                                <span class="tech-spec-value">${escapeHtml(pfhRev)} (Warhammer III Pack)</span>
                            </div>
                            <div class="tech-spec-row">
                                <span class="tech-spec-label">Header Bitmask:</span>
                                <span class="tech-spec-value font-mono">${escapeHtml(bitmask)}</span>
                            </div>
                            <div class="tech-spec-row">
                                <span class="tech-spec-label">Indexed Files:</span>
                                <span class="tech-spec-value font-mono">${fileCount.toLocaleString()} files</span>
                            </div>
                            <div class="tech-spec-row">
                                <span class="tech-spec-label">Multiplayer Checksum:</span>
                                <div class="tech-spec-copyable">
                                    <code class="hash-text" title="${escapeHtml(hash)}">${escapeHtml(hash)}</code>
                                    <button type="button" class="btn btn-secondary btn-sm btn-copy-hash" title="Copy Checksum for Co-Op Sync">📋 Copy</button>
                                </div>
                            </div>
                            <div class="tech-spec-row">
                                <span class="tech-spec-label">Normalized Path:</span>
                                <div class="tech-spec-copyable">
                                    <code class="path-text" title="${escapeHtml(mod.real_path)}">${escapeHtml(mod.real_path)}</code>
                                    <button type="button" class="btn btn-secondary btn-sm btn-copy-path" title="Copy Full File Path">📋 Copy</button>
                                </div>
                            </div>
                        </div>
                    </details>
                </div>
            </div>
        `;

        // Bind Copy Buttons
        const copyHashBtn = this.bodyEl.querySelector('.btn-copy-hash') as HTMLButtonElement;
        if (copyHashBtn) {
            copyHashBtn.onclick = () => {
                navigator.clipboard.writeText(hash);
                Toast.success('✓ Copied SHA-256 multiplayer checksum to clipboard!');
            };
        }

        const copyPathBtn = this.bodyEl.querySelector('.btn-copy-path') as HTMLButtonElement;
        if (copyPathBtn) {
            copyPathBtn.onclick = () => {
                navigator.clipboard.writeText(mod.real_path);
                Toast.success('✓ Copied pack file path to clipboard!');
            };
        }
    }

    private renderConflictsTab(mod: Mod, conflictAnalysis: any, summary?: ModConflictSummary): void {
        if (!conflictAnalysis || !summary || summary.total_conflicts === 0) {
            this.bodyEl.innerHTML = `
                <div class="drawer-empty-state">
                    <span class="empty-icon">✅</span>
                    <h4>No Load Order Conflicts</h4>
                    <p>This mod has zero overlapping files or collisions with other active mods in your current load order.</p>
                </div>
            `;
            return;
        }

        const relevantConflicts: FileConflictDetail[] = (conflictAnalysis.detailed_conflicts || []).filter(
            (c: FileConflictDetail) => c.winner_mod === mod.name || c.loser_mod === mod.name
        );

        let conflictsListHtml = '';
        relevantConflicts.forEach(c => {
            const isWinner = c.winner_mod === mod.name;
            const otherModName = isWinner ? c.loser_mod : c.winner_mod;
            const otherIndex = isWinner ? c.loser_index : c.winner_index;

            let badgeClass = 'diff-badge-won';
            let badgeText = '▲ OVERRIDING';
            let actionHtml = '';

            if (c.severity === 'FatalStartpos') {
                badgeClass = 'diff-badge-fatal';
                badgeText = '❌ FATAL STARTPOS';
            } else if (!isWinner) {
                badgeClass = 'diff-badge-lost';
                badgeText = '▼ OVERRIDDEN';
                actionHtml = `
                    <button type="button" class="btn btn-secondary btn-sm btn-resolve-above" 
                            data-other-mod="${escapeHtml(otherModName)}" 
                            data-other-index="${otherIndex}"
                            title="Move this mod above ${escapeHtml(otherModName)} to take priority">
                        ⤒ Move Above Winner
                    </button>
                `;
            } else {
                actionHtml = `
                    <button type="button" class="btn btn-secondary btn-sm btn-resolve-below" 
                            data-other-mod="${escapeHtml(otherModName)}" 
                            data-other-index="${otherIndex}"
                            title="Move this mod below ${escapeHtml(otherModName)} to let it take priority">
                        ⤓ Move Below Loser
                    </button>
                `;
            }

            conflictsListHtml += `
                <div class="conflict-card ${isWinner ? 'conflict-winner' : 'conflict-loser'}">
                    <div class="conflict-header-row">
                        <span class="diff-badge ${badgeClass}">${badgeText}</span>
                        <span class="conflict-partner">vs #${otherIndex} ${escapeHtml(otherModName)}</span>
                    </div>
                    <code class="conflict-filepath">${escapeHtml(c.internal_path)}</code>
                    ${actionHtml ? `<div class="conflict-card-actions">${actionHtml}</div>` : ''}
                </div>
            `;
        });

        this.bodyEl.innerHTML = `
            <div class="drawer-conflicts">
                <div class="conflicts-header-summary">
                    <span>Showing <strong>${relevantConflicts.length}</strong> file collisions for <strong>${escapeHtml(mod.name)}</strong></span>
                </div>
                <div class="conflicts-diff-list">
                    ${conflictsListHtml}
                </div>
            </div>
        `;

        // Bind quick resolution buttons
        this.bodyEl.querySelectorAll('.btn-resolve-above').forEach(btn => {
            const el = btn as HTMLElement;
            el.onclick = () => {
                const targetIndex = parseInt(el.dataset.otherIndex || '1', 10);
                this.moveInspectedModToPosition(mod, Math.max(1, targetIndex));
            };
        });

        this.bodyEl.querySelectorAll('.btn-resolve-below').forEach(btn => {
            const el = btn as HTMLElement;
            el.onclick = () => {
                const targetIndex = parseInt(el.dataset.otherIndex || '1', 10);
                this.moveInspectedModToPosition(mod, targetIndex + 1);
            };
        });
    }

    private renderDependenciesTab(mod: Mod, manifest?: PackedFileManifest, summary?: ModConflictSummary): void {
        const steamUrl = mod.url || `https://steamcommunity.com/sharedfiles/filedetails/?id=${mod.id}`;
        const deps = manifest?.dependencies || [];
        const missingDeps = summary?.missing_dependencies || [];

        let depsHtml = '';
        if (deps.length === 0) {
            depsHtml = `
                <div class="drawer-empty-state">
                    <p>No hard dependencies declared in this mod's pack header.</p>
                </div>
            `;
        } else {
            depsHtml = `
                <div class="dependency-list">
                    ${deps.map(d => {
                        const isMissing = missingDeps.includes(d);
                        return `
                            <div class="dependency-item ${isMissing ? 'dep-missing' : 'dep-satisfied'}">
                                <span class="dep-status-icon">${isMissing ? '⚠️' : '✓'}</span>
                                <span class="dep-name">${escapeHtml(d)}</span>
                                <span class="dep-status-label">${isMissing ? 'Missing from Active' : 'Satisfied'}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }

        this.bodyEl.innerHTML = `
            <div class="drawer-dependencies">
                <div class="drawer-section">
                    <h4 class="drawer-section-title">Declared Pack Dependencies (${deps.length})</h4>
                    ${depsHtml}
                </div>

                <div class="drawer-section">
                    <h4 class="drawer-section-title">Steam Workshop Links</h4>
                    <button type="button" class="btn btn-secondary" id="drawer-btn-steam" style="width: 100%;">
                        🌐 Open Workshop Page ↗
                    </button>
                </div>
            </div>
        `;

        const steamBtn = this.bodyEl.querySelector('#drawer-btn-steam') as HTMLButtonElement;
        if (steamBtn) {
            steamBtn.onclick = () => {
                tauriInvoke('open_url', { url: steamUrl });
            };
        }
    }

    private moveInspectedModToPosition(mod: Mod, targetPos: number): void {
        const active = [...store.getActiveMods()];
        const currentIndex = active.findIndex(m => m.name === mod.name || m.id === mod.id);
        if (currentIndex === -1) return;

        const [removed] = active.splice(currentIndex, 1);
        const clampedPos = Math.max(1, Math.min(targetPos, active.length + 1));
        active.splice(clampedPos - 1, 0, removed);

        store.setActiveMods(active);
        Toast.success(`Moved "${mod.title || mod.name}" to position #${clampedPos}`);
    }

    private async handleAutoSort(): Promise<void> {
        const active = store.getActiveMods();
        if (active.length <= 1) {
            Toast.info('Need at least 2 active mods to auto-sort dependencies.');
            return;
        }

        try {
            this.autoSortBtn.disabled = true;
            this.autoSortBtn.innerText = '⚡ Sorting...';
            const sorted = await autoSortDependencies(active);
            store.setActiveMods(sorted);
            Toast.success(`Auto-sorted ${sorted.length} active mods by dependency DAG!`);
        } catch (err: any) {
            Toast.error(`Auto-sort failed: ${err.message || err}`);
        } finally {
            this.autoSortBtn.disabled = false;
            this.autoSortBtn.innerText = '⚡ Auto-Sort Order';
        }
    }
}

function escapeHtml(str: string): string {
    const p = document.createElement('p');
    p.textContent = str;
    return p.innerHTML;
}
