import { check, Update, DownloadEvent } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { store } from '../state/store';
import { Toast } from '../components/Toast';

export interface UpdateProgress {
    downloadedBytes: number;
    totalBytes: number;
    percent: number;
    status: 'idle' | 'downloading' | 'installing' | 'ready' | 'error';
}

export type UpdateListener = (update: Update | null, progress: UpdateProgress) => void;

class UpdateController {
    private currentUpdate: Update | null = null;
    private isChecking: boolean = false;
    private isDownloading: boolean = false;
    private listeners: Set<UpdateListener> = new Set();
    private progress: UpdateProgress = {
        downloadedBytes: 0,
        totalBytes: 0,
        percent: 0,
        status: 'idle'
    };

    /**
     * Initialize background updater check.
     */
    public init(): void {
        // Run silent check 4 seconds after startup if enabled in user configuration
        setTimeout(() => {
            const config = store.getConfig();
            const shouldAutoCheck = config?.auto_check_updates !== false; // defaults to true
            if (shouldAutoCheck) {
                this.checkForUpdates(true).catch(err => {
                    console.warn('[UpdateController] Silent background check failed:', err);
                });
            }
        }, 4000);
    }

    public subscribe(listener: UpdateListener): () => void {
        this.listeners.add(listener);
        listener(this.currentUpdate, this.progress);
        return () => this.listeners.delete(listener);
    }

    private notify(): void {
        for (const listener of this.listeners) {
            listener(this.currentUpdate, this.progress);
        }
    }

    public getAvailableUpdate(): Update | null {
        return this.currentUpdate;
    }

    public getProgress(): UpdateProgress {
        return this.progress;
    }

    public async checkForUpdates(silent: boolean = false): Promise<Update | null> {
        if (this.isChecking) return this.currentUpdate;
        this.isChecking = true;

        try {
            const update = await check({ timeout: 10000 });
            this.currentUpdate = update;
            this.isChecking = false;

            if (update) {
                this.progress.status = 'idle';
                this.notify();
                document.dispatchEvent(new CustomEvent('wh3:update-available', { detail: update }));
            } else {
                this.notify();
                if (!silent) {
                    Toast.success('You are using the latest version of WH3 Mod Manager!');
                }
            }
            return update;
        } catch (err: any) {
            this.isChecking = false;
            console.error('[UpdateController] Check error:', err);
            if (!silent) {
                Toast.error(`Failed to check for updates: ${err.message || err}`);
            }
            return null;
        }
    }

    public async downloadAndInstall(onProgress?: (progress: UpdateProgress) => void): Promise<void> {
        if (!this.currentUpdate || this.isDownloading) return;
        this.isDownloading = true;

        let total = 0;
        let downloaded = 0;

        this.progress = {
            downloadedBytes: 0,
            totalBytes: 0,
            percent: 0,
            status: 'downloading'
        };
        this.notify();

        try {
            await this.currentUpdate.downloadAndInstall((event: DownloadEvent) => {
                switch (event.event) {
                    case 'Started':
                        total = event.data.contentLength || 0;
                        this.progress.totalBytes = total;
                        this.progress.status = 'downloading';
                        break;
                    case 'Progress':
                        downloaded += event.data.chunkLength;
                        this.progress.downloadedBytes = downloaded;
                        if (total > 0) {
                            this.progress.percent = Math.min(100, Math.round((downloaded / total) * 100));
                        }
                        break;
                    case 'Finished':
                        this.progress.status = 'ready';
                        this.progress.percent = 100;
                        break;
                }
                this.notify();
                if (onProgress) onProgress(this.progress);
            });

            this.isDownloading = false;
            this.progress.status = 'ready';
            this.notify();
            Toast.success('Update downloaded and verified! Ready to restart.');
        } catch (err: any) {
            this.isDownloading = false;
            this.progress.status = 'error';
            this.notify();
            Toast.error(`Update installation failed: ${err.message || err}`);
            throw err;
        }
    }

    public async restartApp(): Promise<void> {
        try {
            await relaunch();
        } catch (err: any) {
            Toast.error(`Restart failed: ${err.message || err}. Please close and relaunch the application.`);
        }
    }
}

export const updateController = new UpdateController();
