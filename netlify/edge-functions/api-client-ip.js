// Netlify supplies the connection address separately from browser-controlled headers.
export function createApiProxy(env, forward = fetch, now = Date.now) {
  return async (request, context) => {
    const secret = env.get('GOBILAN_PROXY_KEY_HEX');
    const origin = env.get('GOBILAN_EDGE_API_ORIGIN');
    // Existing previews and local builds can keep using the generated rewrite.
    if (!secret && !origin) return;
    if (!/^[a-f0-9]{64}$/.test(secret ?? '') || !origin || !URL.canParse(origin) || !context.ip) {
      return Response.json({ error: { code: 'unavailable', message: 'API indisponible.' } },
        { status: 503, headers: { 'cache-control': 'no-store' } });
    }

    const target = new URL(origin);
    if (target.protocol !== 'https:' || target.origin !== origin) {
      return Response.json({ error: { code: 'unavailable', message: 'API indisponible.' } },
        { status: 503, headers: { 'cache-control': 'no-store' } });
    }
    const url = new URL(request.url);
    target.pathname = url.pathname;
    target.search = url.search;

    const issuedAt = Math.floor(now() / 1000);
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const payload = ['v1', issuedAt, request.method, target.pathname + target.search, context.ip].join('\n');
    const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    const signature = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');

    const headers = new Headers();
    for (const name of ['accept', 'content-type', 'cookie', 'origin', 'user-agent', 'x-gobilan-csrf', 'x-fedapay-signature', 'sec-fetch-site', 'x-gobilan-admin-origin']) {
      const value = request.headers.get(name);
      if (value !== null) headers.set(name, value);
    }
    for (const name of ['sec-gpc', 'dnt']) {
      if (request.headers.get(name) === '1') headers.set(name, '1');
    }
    headers.set('x-gobilan-proxy', `v1;${issuedAt};${context.ip};${signature}`);

    return forward(target, { method: request.method, headers, body: request.body, redirect: 'manual' });
  };
}

/* global Netlify */
export default (request, context) => createApiProxy(Netlify.env)(request, context);
