/**
 * Main application entry point for Warhammer 3 Mod Manager (Tauri v2).
 */
import './styles/main.css';
import { store } from './state/store';
import { fetchConfig } from './api/configApi';
import { fetchMods } from './api/modApi';
import { TitleBar } from './components/TitleBar';
import { ZoomController } from './controllers/ZoomController';
import { WindowResizer } from './controllers/WindowResizer';
import { SettingsModal } from './components/SettingsModal';
import { ModListManager } from './components/ModList';
import { HeaderControls } from './components/HeaderControls';
import { SearchController } from './components/SearchBar';
import { InspectorDrawer } from './components/InspectorDrawer';
import { Toast } from './components/Toast';

class App {
    private titleBar!: TitleBar;
    private zoomController!: ZoomController;
    private windowResizer!: WindowResizer;
    private settingsModal!: SettingsModal;
    private modListManager!: ModListManager;
    private headerControls!: HeaderControls;
    private searchController!: SearchController;
    private inspectorDrawer!: InspectorDrawer;

    public async init(): Promise<void> {
        // Initialize frameless window titlebar, resizer & zoom controller
        this.titleBar = new TitleBar();
        this.windowResizer = new WindowResizer();
        this.zoomController = new ZoomController();

        this.settingsModal = new SettingsModal();
        this.headerControls = new HeaderControls(this.settingsModal);
        this.modListManager = new ModListManager('inactive-mods', 'active-mods');
        this.searchController = new SearchController('search-inactive', 'search-active');
        this.inspectorDrawer = new InspectorDrawer();

        try {
            const config = await fetchConfig();
            store.setConfig(config);

            // Apply persisted zoom scale
            if (config.ui_scale) {
                this.zoomController.setScale(config.ui_scale, false);
            }

            const isConfigured = Boolean(
                (config.workshop_dir || config.WORKSHOP_DIR) &&
                (config.game_data_dir || config.GAME_DATA_DIR) &&
                (config.script_file || config.SCRIPT_FILE)
            );

            if (!isConfigured) {
                Toast.info('Welcome! Please configure your Warhammer 3 installation paths.');
                this.settingsModal.openAndLoad();
                return;
            }

            // Load workshop mods via Tauri IPC
            const mods = await fetchMods();
            store.setAllMods(mods);

            // Load presets list
            await this.headerControls.refreshPresets();

            // Auto-load last preset or default preset
            const presets = store.getPresets();
            const lastPreset = config.last_preset;

            if (lastPreset && presets.includes(lastPreset)) {
                await this.headerControls.loadPresetByName(lastPreset, true);
                Toast.info(`Restored preset: ${lastPreset}`);
            } else if (presets.includes('default')) {
                await this.headerControls.loadPresetByName('default', true);
            } else if (presets.length > 0) {
                await this.headerControls.loadPresetByName(presets[0], true);
            }

            // Initial conflict indexing
            this.modListManager.triggerConflictAnalysis();

            if (mods.length === 0) {
                Toast.warning('No mods found in the configured workshop directory. Check Settings.');
            }
        } catch (err: any) {
            console.error('Initialization error:', err);
            Toast.error(`Failed to initialize mod manager: ${err.message}`);
        }
    }
}

// Instantiate and start app on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();
    (window as any).__WH3_STORE__ = store;
});
