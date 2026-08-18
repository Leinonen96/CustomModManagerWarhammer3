/**
 * Configuration and path validation via Tauri v2 commands.
 */
import { tauriInvoke } from './client';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { AppConfig, ConfigValidationResult, PathDetectionResult, ApiResponse } from '../types';

export async function fetchConfig(): Promise<AppConfig> {
    return tauriInvoke<AppConfig>('get_config');
}

export async function saveConfig(config: AppConfig): Promise<ApiResponse> {
    await tauriInvoke('save_config', { config });
    return { status: 'success', success: true, message: 'Settings saved successfully!' };
}

export async function validateConfigPaths(): Promise<ApiResponse<ConfigValidationResult>> {
    const data = await tauriInvoke<ConfigValidationResult>('validate_paths');
    return { status: 'success', success: true, data };
}

export async function autoDetectPaths(): Promise<ApiResponse<PathDetectionResult>> {
    const data = await tauriInvoke<PathDetectionResult>('detect_paths');
    return { status: 'success', success: true, data };
}

export async function pickFolder(title = 'Select Directory'): Promise<string | null> {
    const selected = await openDialog({
        directory: true,
        multiple: false,
        title,
    });
    return (selected as string) || null;
}
