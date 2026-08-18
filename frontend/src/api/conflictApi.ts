/**
 * API client for Conflict Engine, Pack Manifests, and Dependency DAG sorting.
 */
import { tauriInvoke } from './client';
import { Mod, ConflictAnalysisResult, PackedFileManifest } from '../types';

export async function analyzeLoadOrderConflicts(activeMods: Mod[]): Promise<ConflictAnalysisResult> {
    return tauriInvoke<ConflictAnalysisResult>('analyze_load_order_conflicts', { activeMods });
}

export async function getPackFileTree(packPath: string): Promise<PackedFileManifest> {
    return tauriInvoke<PackedFileManifest>('get_pack_file_tree', { packPath });
}

export async function autoSortDependencies(activeMods: Mod[]): Promise<Mod[]> {
    return tauriInvoke<Mod[]>('auto_sort_dependencies', { activeMods });
}
