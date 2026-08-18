/**
 * Preset management API endpoints.
 */
import { apiFetch } from './client';
import { Mod, PresetDetails, ApiResponse } from '../types';

export async function fetchPresetsList(): Promise<string[]> {
    return apiFetch<string[]>('/api/presets');
}

export async function fetchPresetMods(name: string): Promise<Mod[]> {
    return apiFetch<Mod[]>(`/api/preset/${encodeURIComponent(name)}`);
}

export async function fetchPresetDetails(name: string): Promise<ApiResponse<PresetDetails>> {
    return apiFetch<ApiResponse<PresetDetails>>(`/api/preset/${encodeURIComponent(name)}/details`);
}

export async function savePreset(name: string, mods: Mod[]): Promise<ApiResponse> {
    return apiFetch<ApiResponse>(`/api/preset/${encodeURIComponent(name)}`, {
        method: 'POST',
        body: JSON.stringify(mods)
    });
}

export async function deletePreset(name: string): Promise<ApiResponse> {
    return apiFetch<ApiResponse>(`/api/preset/${encodeURIComponent(name)}`, {
        method: 'DELETE'
    });
}
