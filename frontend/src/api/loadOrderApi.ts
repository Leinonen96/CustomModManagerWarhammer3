/**
 * Load order application via Tauri v2.
 */
import { tauriInvoke } from './client';
import { Mod, ApiResponse } from '../types';

export interface LoadOrderResult {
    success: boolean;
    applied_count: number;
    cleaned_count: number;
    script_path: string;
    backup_path?: string;
    message: string;
}

export async function applyLoadOrder(mods: Mod[]): Promise<ApiResponse<LoadOrderResult>> {
    const data = await tauriInvoke<LoadOrderResult>('apply_load_order', { mods });
    return {
        status: 'success',
        success: true,
        message: data.message,
        data
    };
}

export async function launchGame(): Promise<void> {
    await tauriInvoke('launch_game');
}
