/**
 * Shared Type Definitions for Warhammer 3 Mod Manager Frontend (Tauri v2).
 */

export interface Mod {
    id: string;
    name: string;
    title: string;
    real_path: string;
    thumb: string;
    url: string;
    file_size_bytes?: number;
    is_movie_pack?: boolean;
    last_modified?: number;
}

export interface AppConfig {
    workshop_dir?: string;
    game_data_dir?: string;
    script_file?: string;
    WORKSHOP_DIR?: string;
    GAME_DATA_DIR?: string;
    SCRIPT_FILE?: string;
    auto_backup?: boolean;
    theme?: string;
    last_preset?: string;
    ui_scale?: number;
}

export interface PathValidationStatus {
    path: string;
    exists: boolean;
    is_dir?: boolean;
    parent_exists?: boolean;
    readable?: boolean;
    writable?: boolean;
}

export interface ConfigValidationResult {
    workshop_dir: PathValidationStatus;
    game_data_dir: PathValidationStatus;
    script_file: PathValidationStatus;
}

export interface PathDetectionResult {
    WORKSHOP_DIR?: string;
    GAME_DATA_DIR?: string;
    SCRIPT_FILE?: string;
    workshop_dir?: string;
    game_data_dir?: string;
    script_file?: string;
    detected: boolean;
}

export interface PresetDetails {
    name: string;
    description?: string;
    mods: Mod[];
    missing_mods: string[];
}

export interface ApiResponse<T = any> {
    status: 'success' | 'error';
    success: boolean;
    message?: string;
    data?: T;
    error?: {
        code: string;
        message: string;
        details?: any;
    };
}
