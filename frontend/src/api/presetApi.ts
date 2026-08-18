/**
 * Preset management via Tauri v2.
 */
import { tauriInvoke } from './client';
import { Mod, PresetDetails, ApiResponse } from '../types';

export async function fetchPresetsList(): Promise<string[]> {
    return tauriInvoke<string[]>('list_presets');
}

export async function fetchPresetDetails(name: string): Promise<ApiResponse<PresetDetails>> {
    const data = await tauriInvoke<PresetDetails>('load_preset', { name });
    return { status: 'success', success: true, data };
}

export async function savePreset(name: string, mods: Mod[]): Promise<ApiResponse> {
    await tauriInvoke('save_preset', { name, mods });
    return { status: 'success', success: true, message: `Preset '${name}' saved successfully!` };
}

export async function deletePreset(name: string): Promise<ApiResponse> {
    const deleted = await tauriInvoke<boolean>('delete_preset', { name });
    if (deleted) {
        return { status: 'success', success: true, message: `Preset '${name}' deleted successfully!` };
    }
    throw new Error(`Preset '${name}' could not be deleted.`);
}
