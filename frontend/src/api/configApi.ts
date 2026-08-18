/**
 * Configuration and path validation API endpoints.
 */
import { apiFetch } from './client';
import { AppConfig, ConfigValidationResult, PathDetectionResult, ApiResponse } from '../types';

export async function fetchConfig(): Promise<AppConfig> {
    return apiFetch<AppConfig>('/api/config');
}

export async function saveConfig(config: AppConfig): Promise<ApiResponse> {
    return apiFetch<ApiResponse>('/api/config', {
        method: 'POST',
        body: JSON.stringify(config)
    });
}

export async function validateConfigPaths(): Promise<ApiResponse<ConfigValidationResult>> {
    return apiFetch<ApiResponse<ConfigValidationResult>>('/api/config/validate');
}

export async function autoDetectPaths(): Promise<ApiResponse<PathDetectionResult>> {
    return apiFetch<ApiResponse<PathDetectionResult>>('/api/config/detect', {
        method: 'POST'
    });
}
