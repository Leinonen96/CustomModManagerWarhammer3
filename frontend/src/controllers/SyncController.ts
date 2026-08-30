/**
 * Real-time Mod Synchronization Controller.
 * Manages 3-tier sync:
 * 1. Tauri native filesystem watcher events ('workshop-mods-updated')
 * 2. Window focus / Alt-Tab sync (debounced/throttled)
 * 3. Global hotkeys (F5, Ctrl+R) and manual refresh triggers
 */
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { fetchMods } from '../api/modApi';
import { store } from '../state/store';
import { Mod } from '../types';
import { Toast } from '../components/Toast';

export class SyncController {
    private unlistenWatcher: UnlistenFn | null = null;
    private lastFocusSyncTime: number = 0;
    private isSyncing: boolean = false;
    private readonly FOCUS_THROTTLE_MS = 4000; // Throttle focus re-scans to once every 4 seconds

    public async init(): Promise<void> {
        await this.bindWatcherEvents();
        this.bindWindowFocus();
        this.bindKeyboardShortcuts();
    }

    private async bindWatcherEvents(): Promise<void> {
        try {
            this.unlistenWatcher = await listen<Mod[]>('workshop-mods-updated', (event) => {
                const newMods = event.payload;
                if (!Array.isArray(newMods)) return;

                const result = store.updateAllModsPreservingState(newMods);
                if (result.added > 0) {
                    Toast.success(`Live sync: Discovered ${result.added} new mod${result.added > 1 ? 's' : ''}!`);
                } else if (result.removed > 0) {
                    Toast.info(`Live sync: Removed ${result.removed} deleted mod${result.removed > 1 ? 's' : ''}.`);
                }
            });
        } catch (err) {
            console.warn('[SyncController] Could not bind Tauri watcher listener:', err);
        }
    }

    private bindWindowFocus(): void {
        window.addEventListener('focus', () => {
            const now = Date.now();
            if (now - this.lastFocusSyncTime < this.FOCUS_THROTTLE_MS) {
                return;
            }
            this.lastFocusSyncTime = now;
            this.syncFromDisk(false);
        });
    }

    private bindKeyboardShortcuts(): void {
        window.addEventListener('keydown', (e: KeyboardEvent) => {
            // F5 or Ctrl+R / Cmd+R to refresh mods
            if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r')) {
                e.preventDefault();
                this.refreshNow(true);
            }
        });
    }

    /**
     * Triggers a manual or automatic refresh from disk.
     */
    public async refreshNow(notifyUser: boolean = true): Promise<{ added: number; removed: number; total: number }> {
        return this.syncFromDisk(notifyUser);
    }

    private async syncFromDisk(notifyUser: boolean): Promise<{ added: number; removed: number; total: number }> {
        if (this.isSyncing) {
            return { added: 0, removed: 0, total: store.getAllMods().length };
        }

        this.isSyncing = true;
        const refreshBtn = document.getElementById('btn-refresh-mods');
        if (refreshBtn) {
            refreshBtn.classList.add('loading');
        }

        try {
            const mods = await fetchMods();
            const result = store.updateAllModsPreservingState(mods);

            if (notifyUser) {
                if (result.added > 0) {
                    Toast.success(`Refreshed: Added ${result.added} new mod${result.added > 1 ? 's' : ''} (${mods.length} total)`);
                } else if (result.removed > 0) {
                    Toast.info(`Refreshed: Removed ${result.removed} missing mod${result.removed > 1 ? 's' : ''} (${mods.length} total)`);
                } else {
                    Toast.info(`Mod catalog is up to date (${mods.length} mods available)`);
                }
            } else if (result.added > 0) {
                Toast.success(`Discovered ${result.added} new mod${result.added > 1 ? 's' : ''}!`);
            }

            return { added: result.added, removed: result.removed, total: mods.length };
        } catch (err: any) {
            console.error('[SyncController] Refresh failed:', err);
            if (notifyUser) {
                Toast.error(`Failed to refresh mods: ${err.message || err}`);
            }
            return { added: 0, removed: 0, total: store.getAllMods().length };
        } finally {
            this.isSyncing = false;
            if (refreshBtn) {
                refreshBtn.classList.remove('loading');
            }
        }
    }

    public destroy(): void {
        if (this.unlistenWatcher) {
            this.unlistenWatcher();
            this.unlistenWatcher = null;
        }
    }
}

export const syncController = new SyncController();
