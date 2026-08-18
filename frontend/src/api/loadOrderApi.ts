/**
 * Load order application API endpoint.
 */
import { apiFetch } from './client';
import { Mod, ApiResponse } from '../types';

export async function applyLoadOrder(mods: Mod[]): Promise<ApiResponse> {
    return apiFetch<ApiResponse>('/api/apply', {
        method: 'POST',
        body: JSON.stringify(mods)
    });
}
