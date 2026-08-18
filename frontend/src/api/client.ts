/**
 * HTTP API client with central error handling and JSON parsing.
 */

export class ApiError extends Error {
    constructor(
        message: string,
        public statusCode: number = 500,
        public code: string = 'API_ERROR',
        public details?: any
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

export async function apiFetch<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
        'Accept': 'application/json',
        ...(options.headers as Record<string, string> || {})
    };

    if (options.body && typeof options.body === 'string' && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
    }

    try {
        const response = await fetch(endpoint, {
            ...options,
            headers
        });

        const data = await response.json().catch(() => null);

        if (!response.ok) {
            const message = data?.message || data?.error?.message || `HTTP ${response.status}: ${response.statusText}`;
            const code = data?.error?.code || 'HTTP_ERROR';
            const details = data?.error?.details || null;
            throw new ApiError(message, response.status, code, details);
        }

        return data as T;
    } catch (err: any) {
        if (err instanceof ApiError) {
            throw err;
        }
        throw new ApiError(err.message || 'Network request failed', 0, 'NETWORK_ERROR');
    }
}
