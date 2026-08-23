import { Update } from '@tauri-apps/plugin-updater';
import { updateController, UpdateProgress } from '../controllers/UpdateController';
import { Toast } from './Toast';
import { tauriInvoke } from '../api/client';

export class UpdateModal {
    private overlay: HTMLElement;
    private modalBox: HTMLElement;
    private currentUpdate: Update | null = null;
    private isOpen: boolean = false;
    private unsubscribe: (() => void) | null = null;

    constructor() {
        this.overlay = document.createElement('div');
        this.overlay.className = 'modal-overlay update-modal-overlay';
        this.overlay.style.display = 'none';

        this.modalBox = document.createElement('div');
        this.modalBox.className = 'modal-box update-modal-box';
        this.overlay.appendChild(this.modalBox);
        document.body.appendChild(this.overlay);

        this.bindGlobalEvents();
    }

    private bindGlobalEvents(): void {
        // Listen for global custom event when an update is found
        document.addEventListener('wh3:update-available', (e: Event) => {
            const customEvent = e as CustomEvent<Update>;
            if (customEvent.detail) {
                this.show(customEvent.detail);
            }
        });

        // Close on escape if not actively downloading
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                const progress = updateController.getProgress();
                if (progress.status !== 'downloading') {
                    this.hide();
                }
            }
        });
    }

    public show(update?: Update): void {
        this.currentUpdate = update || updateController.getAvailableUpdate();
        if (!this.currentUpdate) return;

        this.isOpen = true;
        this.overlay.style.display = 'flex';
        this.render();

        // Subscribe to real-time download progress
        if (!this.unsubscribe) {
            this.unsubscribe = updateController.subscribe((_up, progress) => {
                if (this.isOpen) {
                    this.updateProgressUI(progress);
                }
            });
        }
    }

    public hide(): void {
        this.isOpen = false;
        this.overlay.style.display = 'none';
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
    }

    private render(): void {
        if (!this.currentUpdate) return;

        const currentVer = this.currentUpdate.currentVersion || (typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '2.1.0');
        const newVer = this.currentUpdate.version;
        const releaseDate = this.currentUpdate.date
            ? new Date(this.currentUpdate.date).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric'
              })
            : '';
        const bodyNotes = this.currentUpdate.body || '';
        const notesHtml = formatReleaseNotesHtml(bodyNotes, newVer);

        this.modalBox.innerHTML = `
            <div class="modal-header">
                <div class="update-header-title">
                    <svg class="update-header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    <h2>New Version Available</h2>
                </div>
                <button class="btn-close" id="btn-update-close" title="Close">
                    <svg class="close-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>

            <div class="update-version-banner">
                <div class="version-tag-group">
                    <span class="version-tag tag-current">v${escapeHtml(currentVer)}</span>
                    <span class="version-arrow">➔</span>
                    <span class="version-tag tag-new">v${escapeHtml(newVer)}</span>
                </div>
                ${releaseDate ? `<span class="release-date">${escapeHtml(releaseDate)}</span>` : ''}
            </div>

            <div class="update-notes-container">
                <h4 class="update-notes-title">Release Notes & Changelog:</h4>
                <div class="update-notes-content">${notesHtml}</div>
            </div>

            <div class="update-progress-container" id="update-progress-container" style="display: none;">
                <div class="progress-info-row">
                    <span id="progress-status-text" class="progress-status-text">Downloading update...</span>
                    <span id="progress-percent-text" class="progress-percent-text">0%</span>
                </div>
                <div class="progress-track">
                    <div class="progress-bar" id="update-progress-bar" style="width: 0%;"></div>
                </div>
                <div class="progress-size-row">
                    <span id="progress-bytes-text" class="progress-bytes-text">0 MB / 0 MB</span>
                </div>
            </div>

            <div class="modal-buttons update-modal-actions">
                <button type="button" class="btn btn-secondary" id="btn-update-later">Remind Me Later</button>
                <div style="flex-grow: 1;"></div>
                <button type="button" class="btn btn-primary" id="btn-update-action">
                    <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg> Download & Install
                </button>
            </div>
        `;

        this.bindModalButtons();
    }

    private bindModalButtons(): void {
        const closeBtn = this.modalBox.querySelector('#btn-update-close') as HTMLElement;
        const laterBtn = this.modalBox.querySelector('#btn-update-later') as HTMLButtonElement;
        const actionBtn = this.modalBox.querySelector('#btn-update-action') as HTMLButtonElement;

        const handleDismiss = () => {
            const progress = updateController.getProgress();
            if (progress.status === 'downloading') {
                Toast.info('Download continuing in background.');
            }
            this.hide();
        };

        const releaseBtn = this.modalBox.querySelector('[data-action="open-github-release"]') as HTMLElement | null;
        if (releaseBtn) {
            releaseBtn.onclick = () => {
                const releaseUrl = releaseBtn.dataset.url || `https://github.com/Leinonen96/CustomModManagerWarhammer3/releases/tag/v${this.currentUpdate?.version}`;
                tauriInvoke('open_url', { url: releaseUrl }).catch(err => {
                    console.warn('Failed to open release URL:', err);
                });
            };
        }

        if (closeBtn) closeBtn.onclick = handleDismiss;
        if (laterBtn) laterBtn.onclick = handleDismiss;

        if (actionBtn) {
            actionBtn.onclick = async () => {
                const progress = updateController.getProgress();
                if (progress.status === 'ready') {
                    // Trigger instant restart into updated binary
                    actionBtn.disabled = true;
                    actionBtn.innerHTML = 'Restarting app...';
                    await updateController.restartApp();
                } else if (progress.status === 'idle' || progress.status === 'error') {
                    actionBtn.disabled = true;
                    actionBtn.innerHTML = '<svg class="btn-icon spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a10 10 0 0 1 10 10"></path></svg> Downloading...';
                    try {
                        await updateController.downloadAndInstall();
                    } catch {
                        actionBtn.disabled = false;
                        actionBtn.innerHTML = 'Retry Download';
                    }
                }
            };
        }
    }

    private updateProgressUI(progress: UpdateProgress): void {
        const progressContainer = this.modalBox.querySelector('#update-progress-container') as HTMLElement;
        const progressBar = this.modalBox.querySelector('#update-progress-bar') as HTMLElement;
        const statusText = this.modalBox.querySelector('#progress-status-text') as HTMLElement;
        const percentText = this.modalBox.querySelector('#progress-percent-text') as HTMLElement;
        const bytesText = this.modalBox.querySelector('#progress-bytes-text') as HTMLElement;
        const actionBtn = this.modalBox.querySelector('#btn-update-action') as HTMLButtonElement;

        if (!progressContainer || !progressBar || !actionBtn) return;

        if (progress.status === 'idle') {
            progressContainer.style.display = 'none';
            return;
        }

        progressContainer.style.display = 'block';

        const downloadedMb = (progress.downloadedBytes / (1024 * 1024)).toFixed(1);
        const totalMb = progress.totalBytes > 0 ? (progress.totalBytes / (1024 * 1024)).toFixed(1) : '?';

        progressBar.style.width = `${progress.percent}%`;
        percentText.innerText = `${progress.percent}%`;
        bytesText.innerText = `${downloadedMb} MB / ${totalMb} MB`;

        if (progress.status === 'downloading') {
            statusText.innerText = 'Downloading & verifying update...';
            actionBtn.disabled = true;
            actionBtn.innerHTML = '<svg class="btn-icon spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a10 10 0 0 1 10 10"></path></svg> Downloading...';
        } else if (progress.status === 'ready') {
            statusText.innerText = '✓ Download verified & ready!';
            progressBar.style.width = '100%';
            percentText.innerText = '100%';
            actionBtn.disabled = false;
            actionBtn.className = 'btn btn-primary btn-glowing';
            actionBtn.innerHTML = '<svg class="btn-icon" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg> Restart & Apply Update';
        } else if (progress.status === 'error') {
            statusText.innerText = 'Download failed.';
            actionBtn.disabled = false;
            actionBtn.innerHTML = 'Retry Download';
        }
    }
}

function formatReleaseNotesHtml(body: string, version: string): string {
    const trimmed = (body || '').trim();
    const isLegacyPlaceholder = !trimmed || trimmed.toLowerCase().includes('see automated changelog');
    const releaseUrl = `https://github.com/Leinonen96/CustomModManagerWarhammer3/releases/tag/v${version}`;

    if (isLegacyPlaceholder) {
        return `
            <div class="update-notes-placeholder">
                <p>New update <strong>v${escapeHtml(version)}</strong> is ready to install.</p>
                <button type="button" class="btn-link-external" data-action="open-github-release" data-url="${releaseUrl}">
                    <span>View full changelog on GitHub</span>
                    <svg class="external-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                </button>
            </div>
        `;
    }

    const lines = trimmed.split('\n');
    let html = '';
    let inList = false;

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        if (line.startsWith('###') || line.startsWith('##') || line.startsWith('#')) {
            const headingText = line.replace(/^#+\s*/, '');
            if (inList) {
                html += '</ul>';
                inList = false;
            }
            html += `<h5 class="update-notes-section-heading">${escapeHtml(headingText)}</h5><ul class="update-notes-list">`;
            inList = true;
            continue;
        }

        if (line.startsWith('•') || line.startsWith('* ') || line.startsWith('- ')) {
            const itemText = line.replace(/^[•\*\-]\s*/, '');
            if (!inList) {
                html += '<ul class="update-notes-list">';
                inList = true;
            }
            html += `<li>${escapeHtml(itemText)}</li>`;
        } else {
            if (inList) {
                html += '</ul>';
                inList = false;
            }
            html += `<p class="update-notes-para">${escapeHtml(line)}</p>`;
        }
    }

    if (inList) {
        html += '</ul>';
    }

    html += `
        <div class="update-notes-footer">
            <button type="button" class="btn-link-external" data-action="open-github-release" data-url="${releaseUrl}">
                <span>View on GitHub</span>
                <svg class="external-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
            </button>
        </div>
    `;

    return html;
}

function escapeHtml(str: string): string {
    const p = document.createElement('p');
    p.textContent = str;
    return p.innerHTML;
}

export const updateModal = new UpdateModal();
