/**
 * Tauri v2 IPC Client.
 */
import { invoke } from '@tauri-apps/api/core';

export async function tauriInvoke<T = any>(command: string, args?: Record<string, any>): Promise<T> {
    try {
        return await invoke<T>(command, args);
    } catch (err: any) {
        const message = typeof err === 'string' ? err : (err?.message || JSON.stringify(err));
        throw new Error(message);
    }
}
