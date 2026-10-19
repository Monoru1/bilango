/**
 * Client HTTP partagé par le portail partenaires et l'administration. Cookies httpOnly (jamais lus
 * par le JavaScript), en-tête anti-CSRF personnalisé, erreurs typées. Aucun jeton en localStorage.
 */
export class ApiError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number, public readonly retryAfterSeconds?: number) {
    super(message);
  }
}

export function createClient(baseUrl = '') {
  return async function api<T>(path: string, opts: { method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; body?: unknown } = {}): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${baseUrl}${path}`, {
        method: opts.method ?? 'GET',
        credentials: 'include',
        headers: { 'content-type': 'application/json', 'x-gobilan-csrf': '1' },
        ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
      });
    } catch {
      throw new ApiError('network', 'Connexion impossible. Vérifiez votre réseau et réessayez.', 0);
    }
    const data = (await res.json().catch(() => null)) as { error?: { code: string; message: string; retryAfterSeconds?: number } } | null;
    if (!res.ok) throw new ApiError(data?.error?.code ?? 'internal', data?.error?.message ?? 'Une erreur est survenue.', res.status, data?.error?.retryAfterSeconds);
    return data as T;
  };
}
