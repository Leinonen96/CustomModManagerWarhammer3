/**
 * Main application entry point for Warhammer 3 Mod Manager.
 */
import { store } from './state/store';
import { fetchConfig } from './api/configApi';
import { fetchMods } from './api/modApi';
import { SettingsModal } from './components/SettingsModal';
import { ModListManager } from './components/ModList';
import { HeaderControls } from './components/HeaderControls';
import { SearchController } from './components/SearchBar';
import { Toast } from './components/Toast';

class App {
    private settingsModal!: SettingsModal;
    private modListManager!: ModListManager;
    private headerControls!: HeaderControls;
    private searchController!: SearchController;

    public async init(): Promise<void> {
        this.settingsModal = new SettingsModal();
        this.headerControls = new HeaderControls(this.settingsModal);
        this.modListManager = new ModListManager('inactive-mods', 'active-mods');
        this.searchController = new SearchController('search-inactive', 'search-active');

        this.startHeartbeat();

        try {
            const config = await fetchConfig();
            store.setConfig(config);

            const isConfigured = Boolean(config.WORKSHOP_DIR && config.GAME_DATA_DIR && config.SCRIPT_FILE);

            if (!isConfigured) {
                Toast.info('Welcome! Please configure your Warhammer 3 installation paths.');
                this.settingsModal.openAndLoad();
                return;
            }

            // Load workshop mods
            const mods = await fetchMods();
            store.setAllMods(mods);

            // Load presets
            await this.headerControls.refreshPresets();

            if (mods.length === 0) {
                Toast.warning('No mods found in the configured workshop directory. Check Settings.');
            }
        } catch (err: any) {
            console.error('Initialization error:', err);
            Toast.error(`Failed to initialize mod manager: ${err.message}`);
        }
    }

    private startHeartbeat(): void {
        // Immediate ping on start
        fetch('/api/heartbeat', { method: 'POST' }).catch(() => {});

        // Ping backend every 2.5 seconds to maintain active lifecycle
        setInterval(() => {
            fetch('/api/heartbeat', { method: 'POST' }).catch(() => {});
        }, 2500);
    }
}

// Instantiate and start app on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();
    (window as any).__WH3_STORE__ = store;
});
