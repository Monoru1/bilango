/** Browser → real API → PostgreSQL. Only isolated local fixtures or approved hosted recette identities. */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(process.env.PLAYWRIGHT_MODULE_DIR ? `${process.env.PLAYWRIGHT_MODULE_DIR}/package.json` : import.meta.url);
const browserName = process.env.E2E_BROWSER || 'chromium';
if (!['chromium','firefox','webkit'].includes(browserName)) throw new Error('Invalid E2E browser');
const browserType = require('playwright')[browserName];
const { Client } = createRequire(import.meta.url)('pg');
const apiLog = process.env.API_LOG ?? '/tmp/gobilan-api.log';
const hosted = Boolean(process.env.E2E_RECETTE_URL);
const base = process.env.E2E_RECETTE_URL || 'http://localhost:5173';
const demoOtp = process.env.E2E_RECETTE_OTP;
const demoPhones = (process.env.E2E_RECETTE_PHONES ?? '').split(',').map(phone => phone.trim());
const pin = hosted ? process.env.E2E_RECETTE_PIN : '4827';
if (hosted) {
  if (base !== 'https://deploy-preview-12--gobilan-pwa.netlify.app') throw new Error('Origine de recette non autorisée.');
  if (!/^\d{4}$/.test(demoOtp ?? '') || !/^\d{4}$/.test(pin ?? '') || demoPhones.length !== 3 ||
      new Set(demoPhones).size !== 3 || demoPhones.some(phone => !/^01\d{8}$/.test(phone))) {
    throw new Error('Configurer trois numéros fictifs béninois distincts de la liste de recette, le code OTP et le PIN de test.');
  }
  const config = await fetch(`${base}/v1/auth/config`);
  if (!config.ok || !(await config.json()).demo?.whatsappSimulated) throw new Error('OTP simulé indisponible sur la preview de recette.');
}
const browser = await browserType.launch(browserName === 'chromium' ? { executablePath: process.env.CHROMIUM, args: ['--no-sandbox', '--disable-dev-shm-usage'] } : {});
const failures = [];
const contexts = [];
let lastPassed = 'aucune étape';
const check = (ok, text) => { if (!ok) throw new Error(text); lastPassed = text; console.log(`PASS ${text}`); };
const viewportWidth = Number(process.env.E2E_WIDTH || 390);
if (![320,390,768,1440].includes(viewportWidth)) throw new Error('Invalid E2E viewport');
const context = async () => {
  const ctx = await browser.newContext({ viewport: { width: viewportWidth, height: 844 }, ...(hosted ? { serviceWorkers: 'block' } : {}) });
  contexts.push(ctx);
  await ctx.addInitScript(() => { Object.defineProperty(navigator, 'standalone', { value: true }); });
  const page = await ctx.newPage(); page.on('pageerror', e => failures.push(e.message));
  return page;
};
const national = () => hosted ? demoPhones.shift() : `0197${String(Date.now()).slice(-6)}`;
const workspace = async (page, businessId) => {
  const response = await page.request.get(`${base}/v1/businesses/${businessId}/workspace`);
  if (!response.ok()) throw new Error('Impossible de lire les données de recette.');
  return response.json();
};
async function signup(page, phone, name) {
  await page.goto(`${base}/?demo=0`);
  await page.getByRole('button', { name: 'Créer mon compte / nouvel appareil' }).click();
  await page.getByRole('button', { name: /Bénin/ }).click();
  await page.getByLabel('Numéro WhatsApp', { exact: true }).fill(phone);
  await page.getByRole('button', { name: 'Recevoir le code', exact: true }).click();
  await page.getByLabel('Code à 4 chiffres').waitFor();
  let code = demoOtp;
  if (!hosted) {
    const codes = [...readFileSync(apiLog, 'utf8').matchAll(new RegExp(`\\[DEV WHATSAPP\\] \\+229${phone} code=(\\d{4})`, 'g'))];
    check(codes.length > 0, 'OTP from development provider, never returned in API response');
    code = codes.at(-1)[1];
  }
  await page.getByLabel('Code à 4 chiffres').fill(code);
  await page.getByRole('heading', { name: 'Créez votre code PIN' }).waitFor();
  for (const digit of pin) await page.getByRole('button', { name: digit, exact: true }).click();
  await page.getByRole('button', { name: 'Passer', exact: true }).click();
  await page.getByLabel('Votre nom').fill(name);
  await page.getByRole('button', { name: 'Continuer', exact: true }).click();
  await page.getByRole('button', { name: 'Ajouter un business', exact: true }).waitFor();
}
async function fillReport(page, revenue, opening, qty) {
  if (opening !== null) await page.getByLabel('Caisse de départ', { exact: false }).fill(String(opening));
  await page.locator('#f-revenue').fill(String(revenue));
  if (qty !== undefined) await page.getByLabel('Quantité vendue Riz').fill(String(qty));
  await page.getByRole('button', { name: /Envoyer le bilan/ }).click();
  await page.getByRole('heading', { name: 'Bilan du jour', exact: true }).waitFor({ state: 'hidden' });
}
const db = hosted ? null : new Client({ connectionString: process.env.DATABASE_URL });
try {
  await db?.connect();
  const owner = await context(); const ownerPhone = national();
  await signup(owner, ownerPhone, 'Patron Test');
  await owner.getByRole('button', { name: 'Ajouter un business', exact: true }).click();
  await owner.getByLabel('Nom du business').fill('GoBilan Test réel');
  await owner.getByRole('checkbox').check();
  await owner.getByLabel('Heure de fermeture', { exact: true }).selectOption('18:00');
  await owner.getByRole('button', { name: 'Créer', exact: true }).click();
  await owner.getByText('Ton manager n’a pas encore fait son premier bilan.', { exact: false }).waitFor();
  const businessId = new URL(owner.url()).pathname.split('/')[2];
  check(Boolean(businessId), 'signup → profile → business persisted');
  const closingTime = async () => hosted ? (await workspace(owner, businessId)).business.reminderTime : (await db.query('select reminder_time from businesses where id=$1', [businessId])).rows[0].reminder_time.slice(0, 5);
  check(await closingTime() === '18:00', 'v1.2 §2 closing time chosen at creation is stored (REC-01)');
  await owner.goto(`${base}/profil`);
  await owner.getByLabel('Heure de fermeture', { exact: true }).selectOption('21:30');
  await owner.getByRole('button', { name: 'Enregistrer l’heure', exact: true }).click();
  await owner.getByText('Heure de fermeture réglée à 21:30.', { exact: true }).waitFor();
  check(await closingTime() === '21:30', 'v1.2 §2 closing time changed from profile is stored server-side (REC-01)');
  await owner.goto(`${base}/b/${businessId}/stock`);
  await owner.getByLabel('Nom de l’article').fill('Riz');
  await owner.getByLabel('Quantité de départ').fill('10');
  await owner.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await owner.getByText('Riz', { exact: true }).waitFor();
  await owner.goto(`${base}/b/${businessId}/bilan`);
  await fillReport(owner, 1000, 500, 2);
  check((hosted ? (await workspace(owner, businessId)).reports.length
    : (await db.query('select count(*)::int n from reports where business_id=$1', [businessId])).rows[0].n) === 1,
  'first report is persisted');
  await owner.reload();
  await owner.getByText('Chiffre d’affaires', { exact: true }).waitFor();
  if (!hosted) await owner.screenshot({ path: '/tmp/gobilan-owner-mobile.png', fullPage: true });
  check(await owner.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `dashboard has no horizontal overflow at ${viewportWidth}px in ${browserName}`);
  check((await owner.locator('body').innerText()).includes('1\u202f000'), 'dashboard survives reload and shows server revenue');
  await owner.goto(`${base}/b/${businessId}/equipe`);
  await owner.getByLabel('Nom du rôle').fill('Caissier');
  await owner.getByRole('button', { name: 'Créer le rôle', exact: true }).click();
  await owner.getByText('Rôle créé.', { exact: true }).waitFor();
  await owner.getByRole('button', { name: 'Modifier le rôle Caissier', exact: true }).click();
  await owner.getByLabel('Nom du rôle modifié').fill('Caissier test');
  await owner.getByRole('button', { name: 'Enregistrer le rôle', exact: true }).click();
  await owner.getByText('Rôle modifié.', { exact: true }).waitFor();
  const guestPhone = national();
  await owner.getByLabel('Rôle', { exact: true }).selectOption({ label: 'Caissier test — Saisie seule' });
  await owner.getByLabel('Numéro WhatsApp de la personne').fill(guestPhone);
  await owner.getByRole('button', { name: 'Inviter', exact: true }).click();
  await owner.getByText('Invitation enregistrée', { exact: false }).waitFor();
  const guest = await context();
  await signup(guest, guestPhone, 'Employé Test');
  await guest.getByRole('button', { name: 'Rejoindre un business', exact: true }).click();
  await guest.getByRole('button', { name: 'Accepter', exact: true }).click();
  await guest.getByRole('heading', { name: /Bonjour, Employé/ }).waitFor();
  check(!(await guest.locator('body').innerText()).includes('MODE DEMO'), 'real employee session, demo controls absent');
  await guest.goto(`${base}/b/${businessId}/bilan`);
  await fillReport(guest, 400, null, 1);
  await guest.goto(`${base}/b/${businessId}/bilans`);
  await guest.locator(`a[href^="/b/${businessId}/bilans/"]`).first().click();
  await guest.getByRole('link', { name: 'Modifier (24 h maximum)' }).click();
  await guest.locator('#f-revenue').fill('600');
  await guest.getByRole('button', { name: 'Enregistrer la modification' }).click();
  await guest.getByRole('heading', { name: /Bonjour, Employé/ }).waitFor();
  const versions = hosted ? (await workspace(owner, businessId)).reports.reduce((sum, report) => sum + report.versions.length, 0)
    : (await db.query('select count(*)::int n from report_versions v join reports r on r.id=v.report_id where r.business_id=$1', [businessId])).rows[0].n;
  check(versions === 3, 'edit preserves original version');
  const stock = (await workspace(owner, businessId)).stockLevels.find(level => level.item.name === 'Riz');
  check(stock?.item.initialQuantity === 10 && stock.sold === 3 && stock.remaining === 7,
    'stock reflects both reports and counts only the current version');
  const leak = await workspace(guest, businessId);
  check(leak.reports.length === 1 && leak.users.length === 1 && leak.subscription.payments.length === 0, 'entry permission filters server payload');
  // Navigation complète unique (l'ancien reload suivi d'un goto immédiat interrompait les requêtes en cours).
  await owner.goto(`${base}/b/${businessId}`);
  await owner.getByText('Chiffre d’affaires', { exact: true }).waitFor();
  check((await owner.locator('body').innerText()).includes('1\u202f600'), 'dashboard aggregates owner and employee reports after edit');
  await owner.goto(`${base}/b/${businessId}/bilans`);
  await owner.locator(`a[href^="/b/${businessId}/bilans/"]`).first().click();
  const downloading = owner.waitForEvent('download');
  await owner.getByRole('button', { name: 'Télécharger le bilan' }).click();
  const download = await downloading;
  if (!hosted) await download.saveAs('/tmp/gobilan-export.pdf');
  check(readFileSync(await download.path()).subarray(0, 5).toString() === '%PDF-', 'text PDF generated in browser with updated jsPDF');
  await owner.route('**/v1/**', route => route.abort('failed'));
  await owner.reload(); await owner.getByRole('button', { name: 'Réessayer', exact: true }).waitFor();
  check(!(await owner.locator('body').innerText()).includes('1\u202f600'), 'network failure clears financial screen and offers retry');
  await owner.unroute('**/v1/**'); await owner.getByRole('button', { name: 'Réessayer', exact: true }).click();
  // Attendre la fin du rechargement avant de naviguer : une navigation pendant un fetch en cours l'interrompt, et
  // WebKit signale cette interruption comme erreur de page (« access control checks »), échec CI du run 42039128158.
  await owner.getByText('Chiffre d’affaires', { exact: true }).waitFor();
  check(!(await owner.getByRole('button', { name: 'Réessayer', exact: true }).count()), 'retry restores the dashboard after network recovery');
  await owner.goto(`${base}/b/${businessId}`);
  await owner.getByText('Chiffre d’affaires', { exact: true }).waitFor();
  const outsider = await context(); await signup(outsider, national(), 'Autre Test');
  const status = await outsider.evaluate(async bid => (await fetch(`/v1/businesses/${bid}/workspace`)).status, businessId);
  check(status === 404, 'another tenant receives 404');
  await owner.goto(`${base}/b/${businessId}/equipe`);
  await owner.getByRole('button', { name: 'Modifier le rôle Caissier test', exact: true }).click();
  await owner.getByLabel('Permission du rôle modifié').selectOption('readonly');
  await owner.getByRole('button', { name: 'Enregistrer le rôle', exact: true }).click();
  await owner.getByText('Rôle modifié.', { exact: true }).waitFor();
  const updatedAccess = await workspace(guest, businessId);
  const roleId = updatedAccess.members[0]?.roleId;
  check(updatedAccess.roles.some(role => role.id === roleId && role.level === 'readonly') &&
    updatedAccess.reports.length === 2, 'active employee session receives the new read-only role and both reports');
  await guest.goto(`${base}/b/${businessId}/bilan`);
  await guest.getByRole('alert').filter({ hasText: 'Bilan introuvable ou modification non autorisée.' }).waitFor();
  check(await guest.getByRole('button', { name: /Envoyer le bilan/ }).count() === 0,
    'read-only employee no longer has a report submission form');
  if (hosted) {
    await owner.goto(`${base}/b/${businessId}/abonnement`);
    await owner.getByRole('heading', { name: 'Mon abonnement' }).waitFor();
    check(await owner.getByText(/Essai gratuit jusqu/).isVisible(), 'hosted business has a trial subscription');
    await owner.goto(`${base}/profil`);
    await owner.getByRole('button', { name: 'Se déconnecter' }).click();
    const pinInput = owner.getByLabel('Code PIN', { exact: true });
    await pinInput.waitFor();
    check((await owner.request.get(`${base}/v1/me`)).status() === 401, 'logout revokes the hosted session');
    await owner.getByLabel(/Numéro WhatsApp/).fill(ownerPhone);
    await pinInput.fill(pin);
    await owner.getByText('Chiffre d’affaires', { exact: true }).waitFor();
    check((await owner.request.get(`${base}/v1/me`)).status() === 200, 'PIN login restores the hosted session');
  } else {
    await db.query("update businesses set trial_ends_at=now()-interval '4 days', paid_until=null where id=$1", [businessId]);
    await owner.reload(); await owner.getByRole('heading', { name: 'Votre abonnement a expiré' }).waitFor();
    await owner.getByRole('link', { name: 'Renouveler', exact: true }).click();
    await owner.getByRole('heading', { name: 'Mon abonnement' }).waitFor();
    check(true, 'blocked owner can still reach subscription; no simulated live payment');
    await guest.goto(`${base}/b/${businessId}`);
    await guest.getByText('Saisie momentanément indisponible.', { exact: false }).waitFor();
    check(!(await guest.locator('body').innerText()).includes('Renouveler'), 'blocked employee sees neutral message without payment controls');
  }
  const cookie = (await contexts[0].cookies()).find(c => c.name === 'gb_user');
  check(cookie?.httpOnly && cookie?.sameSite === 'Lax', 'browser holds httpOnly SameSite session');
  check(failures.length === 0, `no browser runtime errors (${failures.join(', ')})`);
  console.log('PWA E2E COMPLETE');
} catch (e) {
  if (hosted) {
    console.error('Recette PWA échouée. Dernière étape confirmée : ' + lastPassed);
  } else {
    console.error(e);
    for (const ctx of contexts) for (const p of ctx.pages()) console.error('PAGE', p.url(), (await p.locator('body').innerText()).slice(0, 2000));
  }
  process.exitCode = 1;
} finally { await db?.end(); await browser.close(); }
