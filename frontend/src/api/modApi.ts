/**
 * Mod discovery via Tauri v2.
 */
import { tauriInvoke } from './client';
import { Mod } from '../types';

export async function fetchMods(): Promise<Mod[]> {
    return tauriInvoke<Mod[]>('get_mods');
}
