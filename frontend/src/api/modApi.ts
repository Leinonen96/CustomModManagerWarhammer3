/**
 * Mod discovery and asset API endpoints.
 */
import { apiFetch } from './client';
import { Mod } from '../types';

export async function fetchMods(): Promise<Mod[]> {
    return apiFetch<Mod[]>('/api/mods');
}
