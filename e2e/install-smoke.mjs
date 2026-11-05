/** Public build, mobile browsers. Emulation does not certify a physical installation. */
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import * as playwright from 'playwright';
const name = process.env.E2E_BROWSER ?? 'chromium';
const browser = await playwright[name].launch({ ...(process.env.CHROMIUM && name === 'chromium' ? { executablePath: process.env.CHROMIUM } : {}), args: name === 'chromium' ? ['--no-sandbox', '--disable-dev-shm-usage'] : [] });
const base = process.env.INSTALL_BASE_URL ?? 'http://localhost:5183';
const evidence = process.env.E2E_EVIDENCE_DIR ?? '/tmp/gobilan-install-evidence';
await mkdir(evidence, { recursive: true });
const check = (value, label) => { if (!value) throw new Error(label); console.log(`PASS ${label}`); };
const safari = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
try {
  for (const [platform, userAgent] of [['android', 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/124.0.0.0 Mobile Safari/537.36'], ['iphone', safari], ['whatsapp', safari + ' WhatsApp/2.24']]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent });
    const page = await ctx.newPage(); const errors = []; const api = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => { if (new URL(r.url()).pathname.startsWith('/v1/')) api.push(r.url()); });
    await page.goto(`${base}/b/private/bilan?demo=1`);
    if (platform === 'whatsapp') await page.getByText('Ouvre ce lien dans Chrome / Safari', { exact: true }).waitFor();
    else await page.getByRole('button', { name: 'Installer l’application' }).waitFor();
    if (platform === 'iphone') {
      check(await page.getByRole('dialog').getByRole('listitem').count() === 3, 'iPhone guide has three steps');
      await page.getByRole('button', { name: 'Fermer', exact: true }).click();
      await page.reload(); await page.getByRole('button', { name: 'Comment installer ?' }).waitFor();
      check(await page.getByRole('dialog').count() === 0, 'closed guide stays closed after reload');
      await page.getByRole('button', { name: 'Comment installer ?' }).click();
      await page.getByRole('dialog').waitFor();
      await page.keyboard.press('Escape');
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
    }
    if (platform === 'android') {
      await page.evaluate(() => {
        const e = new Event('beforeinstallprompt', { cancelable: true });
        e.prompt = async () => { window.installPromptCalled = true; };
        e.userChoice = Promise.resolve({ outcome: 'accepted' });
        window.dispatchEvent(e);
      });
      await page.getByRole('button', { name: 'Installer l’application' }).click();
      await page.getByText(/Installation demandée/).waitFor();
      check(await page.evaluate(() => window.installPromptCalled), 'Android button invokes captured prompt (synthetic event)');
    }
    await page.screenshot({ path: join(evidence, `${name}-${platform}.png`), fullPage: true });
    await page.getByRole('link', { name: /Mentions légales/ }).click();
    await page.getByRole('heading', { name: 'Mentions légales & Politiques de confidentialité', exact: true }).waitFor();
    check(api.length === 0, `${platform}: no API/session request on public or legal screen`);
    check(errors.length === 0, `${platform}: no runtime error`);
    await ctx.close();
  }
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => Object.defineProperty(navigator, 'standalone', { value: true }));
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.route('**/v1/me', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<html>Wrong SPA response</html>' }));
  await page.goto(base);
  await page.getByRole('button', { name: 'Réessayer', exact: true }).waitFor();
  check(!(await page.locator('body').innerText()).includes('demo=1'), 'malformed API gives controlled error without demo bypass');
  await page.screenshot({ path: join(evidence, `${name}-api-error.png`), fullPage: true });
  await page.unroute('**/v1/me');
  await page.route('**/v1/me', route => route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: { code: 'unauthenticated', message: 'Connexion requise' } }) }));
  await page.getByRole('button', { name: 'Réessayer', exact: true }).click();
  await page.getByRole('button', { name: 'Créer mon compte / nouvel appareil' }).waitFor();
  check(errors.length === 0, 'installed session recovers after malformed API');
  await ctx.close();
  const manifest = await fetch(`${base}/manifest.webmanifest`).then(r => r.json());
  check(manifest.display === 'standalone' && manifest.icons.length >= 4, 'public manifest and installation icons');
} finally { await browser.close(); }
