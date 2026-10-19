/**
 * Smoke test manuel de bout en bout : portail partenaires + administration contre l'API de DEV (PGlite).
 * Prérequis : API (8787), partners (5174), admin (5175) démarrés ; Playwright et Chromium disponibles ;
 * variable API_LOG = fichier où l'API écrit sa sortie (les « e-mails » simulés y sont lus).
 * NE FAIT AUCUN ENVOI RÉEL. Voir docs/TEST_REPORT.md pour le dernier résultat réellement exécuté.
 */
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
const require = createRequire(process.env.PLAYWRIGHT_MODULE_DIR ? `${process.env.PLAYWRIGHT_MODULE_DIR}/package.json` : import.meta.url);
const { chromium } = require('playwright');
const LOG = process.env.API_LOG ?? '/tmp/api.log';
const TAG = Date.now().toString(36).toUpperCase().replace(/[^A-Z]/g, 'X').slice(-5);
const MGR = `marie-${TAG.toLowerCase()}@partner.test`;
const AGT = `koffi-${TAG.toLowerCase()}@partner.test`;
const CODE = `KOFFI${TAG}225`.slice(0, 20);
const log = () => readFileSync(LOG, 'utf8');
const lastMatch = (re) => { const m = [...log().matchAll(re)]; return m.length ? m[m.length - 1] : null; };
const check = (cond, msg) => { if (!cond) throw new Error('ÉCHEC : ' + msg); console.log('OK   ' + msg); };

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
const errors = [];
// Contextes séparés : en production admin et partenaires sont sur des hôtes distincts (cookies « host-only »).
// Sur localhost les cookies ignorent le port : on isole donc les deux jars, comme le feront deux hôtes.
const ctxP = await browser.newContext({ viewport: { width: 1100, height: 900 } });
const adm = await ctx.newPage(); const par = await ctxP.newPage();
for (const p of [adm, par]) { p.on('pageerror', (e) => errors.push(String(e))); }

// --- Admin : connexion en 2 étapes, création d'un manager ---------------------------------
await adm.goto('http://localhost:5175/');
await adm.getByLabel('E-mail').fill('admin@novadis.test');
await adm.getByLabel('Mot de passe').fill('dev-admin-password-123');
await adm.getByRole('button', { name: 'Continuer' }).click();
await adm.getByLabel('Code à 6 chiffres').waitFor();
await adm.waitForTimeout(300);
const code = lastMatch(/\[DEV EMAIL\] to=admin@novadis\.test[\s\S]*?\b(\d{6})\b/g)?.[1];
check(!!code, 'code admin 6 chiffres reçu par e-mail (simulé)');
await adm.getByLabel('Code à 6 chiffres').fill(code);
await adm.getByRole('button', { name: 'Se connecter' }).click();
await adm.getByText('Statistiques').first().waitFor();
check(true, 'connexion admin réussie (cookie httpOnly via proxy, CSRF + Origin acceptés)');
await adm.getByRole('tab', { name: 'Partenaires' }).click();
await adm.getByLabel('Nom').fill('Marie Manager');
await adm.getByLabel('E-mail').fill(MGR);
await adm.getByRole('button', { name: 'Créer', exact: true }).click();
await adm.getByText('Partenaire créé').waitFor();
check(true, 'manager créé par l’admin');

// --- Partenaire : activation, accord, tableau de bord ------------------------------------
const link = lastMatch(/Activez votre accès : (http:\/\/[^\s]+\/activer\?token=([\w-]+))/g);
check(!!link, 'lien d’activation reçu (à usage unique, sans mot de passe dans le message)');
check(!/mot de passe\s*:/i.test(log().split(`[DEV EMAIL] to=${MGR}`)[1]?.split('[/DEV EMAIL]')[0] ?? ''), 'aucun mot de passe dans l’e-mail');
await par.goto(`http://localhost:5174/activer?token=${link[2]}`);
await par.getByText('Bienvenue, Marie Manager').waitFor();
await par.getByLabel('Mot de passe').fill('motdepasse-solide-1');
await par.getByRole('checkbox').check();
await par.getByRole('button', { name: 'Activer mon accès' }).click();
await par.getByText('Bonjour, Marie').waitFor();
check(true, 'activation + accord accepté + tableau de bord manager affiché');
check(!(await par.content()).match(/\+\d{8,}/), 'aucun numéro de téléphone dans le tableau de bord');
// Rejeu du lien : refusé
const par2 = await ctxP.newPage(); await par2.goto(`http://localhost:5174/activer?token=${link[2]}`);
await par2.getByText('Lien indisponible').waitFor(); check(true, 'lien d’activation déjà utilisé : refusé');

// --- Manager enregistre un agent ----------------------------------------------------------
await par.getByRole('button', { name: '+ Enregistrer un agent' }).click();
await par.getByLabel('Nom de l’agent').fill('Koffi Agent');
await par.getByLabel('E-mail de l’agent').fill(AGT);
await par.getByLabel('Code promo').fill(CODE);
await par.getByRole('button', { name: 'Enregistrer', exact: true }).first().click();
await par.getByText('Agent enregistré').waitFor();
check(true, 'agent enregistré par son manager (code ' + CODE + ')');

// --- Séparation des sessions : le cookie partenaire n'ouvre pas l'admin ---------------------
const res = await par.evaluate(async () => (await fetch('/v1/admin/stats', { credentials: 'include' })).status);
check(res === 401, 'session partenaire refusée sur l’API admin (401)');
await adm.getByRole('tab', { name: 'Administrateurs', exact: true }).click();
await adm.getByLabel('Adresse administrateur').fill('backup@novadis.test');
await adm.getByLabel('Mot de passe initial').fill('backup-test-password-123');
await adm.getByRole('button', { name: 'Demander la modification' }).click();
await adm.getByLabel('Code de confirmation').waitFor();
const confirmation = lastMatch(/Code de confirmation : (\d{6})/g)?.[1];
check(!!confirmation, 'confirmation allowlist reçue par e-mail simulé');
await adm.getByLabel('Code de confirmation').fill(confirmation);
await adm.getByRole('button', { name: 'Confirmer la modification' }).click();
await adm.getByText('Modification confirmée.', { exact: true }).waitFor();
check(true, 'administrateur de secours ajouté après confirmation');
await adm.getByRole('tab', { name: 'Audit', exact: true }).click();
await adm.getByText('admin.allowlist.add', { exact: true }).waitFor();
check(true, 'action allowlist visible dans le journal admin');
await adm.getByRole('tab', { name: 'Partenaires', exact: true }).click();
await adm.getByLabel('Nom', { exact: true }).fill('Libre Test');
await adm.getByLabel('E-mail', { exact: true }).fill('libre@partner.test');
await adm.getByRole('button', { name: 'Créer', exact: true }).click();
await adm.getByText('Partenaire créé', { exact: false }).waitFor();
await adm.getByRole('tab', { name: 'Statistiques', exact: true }).click();
await adm.getByRole('tab', { name: 'Partenaires', exact: true }).click();
await adm.getByLabel('Partenaire à modifier').selectOption({ label: 'Libre Test — manager' });
await adm.getByLabel('Nouveau rôle', { exact: true }).selectOption('influencer');
await adm.getByLabel('Nouveau code promo').fill('LIBRE225');
await adm.getByRole('button', { name: 'Changer et journaliser le rôle' }).click();
await adm.getByText('Rôle modifié et sessions révoquées. Nouvel accord requis.', { exact: true }).waitFor();
await adm.getByRole('tab', { name: 'Audit', exact: true }).click();
await adm.getByText('partner.role.change', { exact: true }).waitFor();
check(true, 'changement de rôle partenaire autorisé et journalisé');

// --- Agent et influenceur : accords, code, reconnexion, coordonnées, formats ----------------
const activationToken = email => log().split(`[DEV EMAIL] to=${email} `).at(-1)?.split('[/DEV EMAIL]')[0].match(/activer\?token=([\w-]+)/)?.[1];
async function activateProfile(email, firstName) {
  const profile = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await profile.newPage(); page.on('pageerror', error => errors.push(String(error)));
  const password = randomBytes(18).toString('base64url');
  const token = activationToken(email); check(!!token, `activation Dev de ${firstName}`);
  await page.goto(`http://localhost:5174/activer?token=${token}`);
  await page.getByLabel('Mot de passe').fill(password);
  check(!(await page.getByRole('button', { name: 'Activer mon accès' }).isEnabled()), 'accord obligatoire avant activation');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Activer mon accès' }).click();
  await page.getByRole('heading', { name: `Bonjour, ${firstName}` }).waitFor();
  await page.getByRole('button', { name: 'Se déconnecter' }).click();
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await page.getByRole('heading', { name: `Bonjour, ${firstName}` }).waitFor();
  check(true, `connexion ${firstName} sans second facteur`);
  return { page, profile };
}
const agent = await activateProfile(AGT, 'Koffi');
await agent.page.getByText(CODE, { exact: true }).waitFor();
await agent.page.getByRole('heading', { name: 'Mes parrainages' }).waitFor();
await agent.page.getByRole('heading', { name: 'Mes versements' }).waitFor();
await agent.page.getByLabel('Numéro de paiement').fill('+2250700000000');
await agent.page.getByLabel('Réseau', { exact: true }).selectOption('Orange');
await agent.page.getByLabel('Nom affiché').fill('Koffi Fictif');
await agent.page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
await agent.page.getByText('Coordonnées enregistrées.', { exact: true }).waitFor();
await agent.page.reload(); await agent.page.getByRole('heading', { name: 'Bonjour, Koffi' }).waitFor();
await agent.page.getByLabel('Numéro de paiement').waitFor();
await agent.page.waitForFunction(() => document.querySelector('[aria-label="Numéro de paiement"]')?.value === '+2250700000000');
check(true, 'bloc Paiement agent enregistré puis relu, sans OTP');

await adm.getByRole('tab', { name: 'Partenaires', exact: true }).click();
const influencerEmail = `influenceur-${TAG.toLowerCase()}@partner.test`;
await adm.getByLabel('Nom', { exact: true }).fill('Lina Influenceur');
await adm.getByLabel('E-mail', { exact: true }).fill(influencerEmail);
await adm.getByLabel('Rôle', { exact: true }).selectOption('influencer');
await adm.getByLabel('Code promo', { exact: true }).fill(`LINA${TAG}225`);
await adm.getByRole('button', { name: 'Créer', exact: true }).click();
await adm.getByText('Partenaire créé', { exact: false }).waitFor();
const influencer = await activateProfile(influencerEmail, 'Lina');
await influencer.page.getByRole('heading', { name: 'Mes abonnés' }).waitFor();
await influencer.page.getByText(`LINA${TAG}225`, { exact: true }).waitFor();
check(!(await influencer.page.locator('body').innerText()).includes('Enregistrer un agent'), 'influenceur sans gestion des agents');
check(await influencer.page.locator('a[href*="5175"]').count() === 0, 'aucun lien vers administration dans le portail partenaires');
await adm.getByRole('tab', { name: 'Abonnements', exact: true }).click();
await adm.getByRole('heading', { name: 'Abonnements par business' }).waitFor();
await adm.getByText('GoBilan Test réel', { exact: true }).waitFor();
await adm.getByRole('tab', { name: 'Versements', exact: true }).click();
await adm.getByRole('heading', { name: 'Calendrier des versements' }).waitFor();
check(true, 'administration : abonnements persistants et calendrier des versements consultables');
await par.reload(); await par.getByRole('heading', { name: 'Bonjour, Marie' }).waitFor();

for (const [page, name] of [[agent.page, 'agent'], [influencer.page, 'influenceur'], [par, 'manager'], [adm, 'admin']]) {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    check(fits, `${name} : aucun débordement horizontal à ${width}px`);
    check(await page.locator('.topbar strong').evaluate(node => node.getBoundingClientRect().height <= 80), `${name} : titre d’en-tête lisible à ${width}px`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: join(process.env.E2E_ARTIFACTS ?? tmpdir(), `gobilan-${name}-mobile.png`), fullPage: true });
}
check(errors.length === 0, 'aucune erreur JavaScript dans les pages (' + errors.length + ')');
await browser.close();
console.log('\nSMOKE E2E : tout est OK');
