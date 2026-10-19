/**
 * Smoke test manuel de bout en bout : portail partenaires + administration contre l'API de DEV (PGlite).
 * Prérequis : API (8787), partners (5174), admin (5175) démarrés ; Playwright et Chromium disponibles ;
 * variable API_LOG = fichier où l'API écrit sa sortie (les « e-mails » simulés y sont lus).
 * NE FAIT AUCUN ENVOI RÉEL. Voir docs/TEST_REPORT.md pour le dernier résultat réellement exécuté.
 */
import { readFileSync } from 'node:fs';
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
check(errors.length === 0, 'aucune erreur JavaScript dans les pages (' + errors.length + ')');
await browser.close();
console.log('\nSMOKE E2E : tout est OK');
