import { constants, closeSync, fstatSync, openSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const origins = {
  admin: 'https://gobilan-admin-recette.netlify.app',
  partner: 'https://gobilan-partenaires-recette.netlify.app',
  pwa: 'https://deploy-preview-12--gobilan-pwa.netlify.app',
};
const sessionRoutes = { admin: '/v1/admin/me', partner: '/v1/partner/me', pwa: '/v1/me' };

export function portalSessionState(file, audience) {
  if (!file) throw new Error('Fichier de session requis');
  const fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const status = fstatSync(fd);
    if (!status.isFile() || (status.mode & 0o077) || status.size > 64 * 1024) {
      throw new Error('Fichier de session privé requis');
    }
    const state = JSON.parse(readFileSync(fd, 'utf8'));
    const host = new URL(origins[audience]).hostname;
    const cookies = state.cookies.filter(cookie =>
      cookie.name === 'gb_' + audience && cookie.domain === host &&
      cookie.path === '/' && cookie.httpOnly && cookie.secure &&
      typeof cookie.value === 'string' && cookie.value.length > 0 &&
      (cookie.expires === -1 || cookie.expires > Date.now() / 1000),
    );
    if (cookies.length !== 1) throw new Error('Session de recette valide requise');
    return { cookies, origins: [] };
  } finally { closeSync(fd); }
}

async function run(env) {
  const sha = env.RECETTE_API_SHA;
  if (!/^[a-f0-9]{40}$/.test(sha ?? '')) throw new Error('SHA Render vérifié requis');
  const states = {
    admin: portalSessionState(env.RECETTE_ADMIN_STATE, 'admin'),
    partner: portalSessionState(env.RECETTE_PARTNER_STATE, 'partner'),
  };
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  try {
    for (const [audience, storageState] of Object.entries(states)) {
      const ctx = await browser.newContext({ storageState, acceptDownloads: true });
      try {
        const page = await ctx.newPage();
        const ownOrigin = origins[audience];
        const ownRoute = sessionRoutes[audience];
        const entry = await page.goto(ownOrigin, { waitUntil: 'domcontentloaded' });
        if (entry?.status() !== 200 || new URL(page.url()).origin !== ownOrigin) throw new Error('Accueil indisponible');
        const session = await ctx.request.get(ownOrigin + ownRoute, { maxRedirects: 0 });
        if (session.status() !== 200) throw new Error('Session expirée ou indisponible');
        console.log(JSON.stringify({ shaApiVerifie: sha, url: ownOrigin + ownRoute, status: 200, preuve: 'session authentifiée' }));

        for (const [other, otherRoute] of Object.entries(sessionRoutes)) {
          if (other === audience) continue;
          const url = origins[other] + otherRoute;
          const response = await ctx.request.get(url, { maxRedirects: 0, headers: { origin: ownOrigin } });
          if (response.status() !== 401 || response.headers()['access-control-allow-credentials'] === 'true') {
            throw new Error('Isolation des sessions non confirmée');
          }
          console.log(JSON.stringify({ shaApiVerifie: sha, url, status: 401, preuve: 'session de l’autre portail refusée' }));
        }

        if (audience === 'partner') {
          await page.getByRole('heading', { name: /^Bonjour,/ }).waitFor({ timeout: 15_000 });
          console.log(JSON.stringify({ shaApiVerifie: sha, url: ownOrigin, preuve: 'tableau de bord partenaire visible' }));
        } else {
          await page.getByRole('heading', { name: 'Indicateurs administrateur' }).waitFor({ timeout: 15_000 });
          await page.getByRole('cell', { name: 'Comptes créés', exact: true }).waitFor({ timeout: 15_000 });
          const [csv] = await Promise.all([
            page.waitForEvent('download', { timeout: 15_000 }),
            page.getByRole('button', { name: 'Exporter en CSV', exact: true }).click({ timeout: 15_000 }),
          ]);
          if (csv.suggestedFilename() !== 'statistiques-gobilan.csv' || await csv.failure()) throw new Error('Téléchargement non confirmé');
          await csv.delete();
          console.log(JSON.stringify({ shaApiVerifie: sha, url: ownOrigin, preuve: 'métriques §13 et téléchargement CSV' }));
        }
      } finally { await ctx.close(); }
    }
  } finally { await browser.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run(process.env).catch(() => {
    console.error('Contrôle hébergé interrompu. Vérifier le SHA, les fichiers privés de session et la disponibilité des portails.');
    process.exitCode = 1;
  });
}
