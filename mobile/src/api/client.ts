export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export function createApiClient(baseUrl: string, getAccessToken: () => Promise<string | null>, fetcher: typeof fetch = fetch) {
  const root = baseUrl.replace(/\/+$/, '');
  return async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await getAccessToken();
    if (!token) throw new ApiError('Sesión no disponible.', 401);
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`);
    if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    const response = await fetcher(`${root}${path}`, { ...init, headers });
    let payload: unknown;
    try { payload = await response.json(); } catch { payload = null; }
    if (!response.ok) {
      const message = typeof payload === 'object' && payload !== null && 'error' in payload && typeof payload.error === 'string'
        ? payload.error : `Error de API (${response.status}).`;
      throw new ApiError(message, response.status);
    }
    if (payload === null) throw new ApiError('Respuesta inválida del servidor.', response.status);
    return payload as T;
  };
}
