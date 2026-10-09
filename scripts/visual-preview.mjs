import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'artifacts/visual-preview');
const web = path.join(output, 'web');
const require = createRequire(import.meta.url);
if (!process.argv.includes('--reuse-export')) {
  const result = spawnSync(process.execPath, [require.resolve('expo/bin/cli'), 'export', '--platform', 'web', '--output-dir', web], {
    cwd: root, stdio: 'inherit', windowsHide: true,
    // SDK 57 vérifie la liste statique Android avant la configuration dynamique.
    env: { ...process.env, BILANGO_VISUAL_PREVIEW: '1', EXPO_NO_WEB_SETUP: '1' },
  });
  if (result.status !== 0) throw new Error('Échec de l’export Web');
}
await mkdir(output, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.ttf': 'font/ttf', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  try {
    const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const target = path.resolve(web, `.${name}`);
    if (!target.startsWith(web + path.sep) && target !== web) { res.writeHead(403).end(); return; }
    let file = target;
    try { await access(file); if (!path.extname(file)) file = path.join(web, 'index.html'); }
    catch { file = path.join(web, 'index.html'); }
    res.setHeader('Content-Type', mime[path.extname(file)] ?? 'application/octet-stream');
    res.end(await readFile(file));
  } catch { res.writeHead(500).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
const captures = [];
const errors = [];
try {
  const executablePath = process.env.BILANGO_CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  browser = await chromium.launch({ executablePath, headless: true });
  const base = `http://127.0.0.1:${server.address().port}`;
  async function pageFor() {
    const context = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 1, locale: 'fr-FR', timezoneId: 'Africa/Porto-Novo' });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    page.setDefaultTimeout(20000);
    await page.goto(base);
    return page;
  }
  async function capture(page, id, title, expected) {
    await page.getByText(expected, { exact: true }).first().waitFor({ state: 'visible' });
    await page.getByText('Chargement...', { exact: true }).first().waitFor({ state: 'hidden' });
    await page.evaluate(() => document.fonts.ready);
    // Deux frames après les polices et la navigation, puis fin des animations CSS.
    await page.evaluate(async () => {
      await Promise.all(document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished.catch(() => {})));
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    const file = `${id}.png`;
    await page.screenshot({ path: path.join(output, file) });
    const png = await readFile(path.join(output, file));
    if (png.readUInt32BE(16) !== 412 || png.readUInt32BE(20) !== 915) throw new Error(`Capture invalide : ${file}`);
    captures.push({ file, title, url: page.url(), width: 412, height: 915 });
    console.log(`Capture vérifiée : ${file}`);
  }
  async function login(page, phone, takeAuth = false) {
    await page.getByRole('button', { name: 'Commencer', exact: true }).click();
    await page.getByLabel('Numéro de téléphone', { exact: true }).fill(phone);
    if (takeAuth) await capture(page, '02-connexion', 'Connexion WhatsApp — compte fictif', 'Votre numéro WhatsApp');
    await page.getByRole('button', { name: 'Recevoir le code sur WhatsApp', exact: true }).click();
    await page.getByLabel('Code de vérification', { exact: true }).fill('123456');
    if (takeAuth) await capture(page, '03-otp', 'Vérification — aucun SMS réel', 'Entrez le code');
    await page.getByRole('button', { name: 'Valider', exact: true }).click();
    await page.getByText('Choisissez un code PIN', { exact: true }).waitFor();
    if (takeAuth) await capture(page, '04-pin', 'Création du PIN', 'Choisissez un code PIN');
    for (const digit of '2468') await page.getByRole('button', { name: digit, exact: true }).click();
    await page.getByText('Confirmez votre code PIN', { exact: true }).waitFor();
    for (const digit of '2468') await page.getByRole('button', { name: digit, exact: true }).click();
    await page.getByRole('button', { name: 'Ouvrir le menu', exact: true }).waitFor();
  }
  const owner = await pageFor();
  await capture(owner, '01-accueil', 'Accueil de connexion', 'BilanGo');
  await login(owner, '0197000001', true);
  await capture(owner, '05-dashboard', 'Dashboard propriétaire', 'Détail du jour');
  await owner.getByRole('tab', { name: '7 jours', exact: true }).click();
  await capture(owner, '12-dashboard-7jours', 'Propriétaire — période de 7 jours', 'Détail de la période');
  await owner.getByRole('tab', { name: '30 jours', exact: true }).click();
  await capture(owner, '13-dashboard-30jours', 'Propriétaire — période de 30 jours', 'Détail de la période');
  await owner.getByRole('tab', { name: 'Personnalisée', exact: true }).click();
  await capture(owner, '14-calendrier', 'Calendrier libre — dates inclusives', 'Période personnalisée');
  const today = new Date(Date.now() + 3600000).toISOString().slice(0, 10);
  const frenchToday = `${today.slice(8)}/${today.slice(5, 7)}/${today.slice(0, 4)}`;
  await owner.getByLabel('Date de début (JJ/MM/AAAA)', { exact: true }).fill('01/01/2020');
  await owner.getByLabel('Date de fin (JJ/MM/AAAA)', { exact: true }).fill(frenchToday);
  await owner.getByRole('button', { name: 'Appliquer la période', exact: true }).click();
  await capture(owner, '15-dashboard-personnalise', 'Propriétaire — plusieurs années', 'Détail de la période');
  await owner.getByRole('tab', { name: "Aujourd'hui", exact: true }).click();
  await owner.getByText('Détail du jour', { exact: true }).waitFor();
  await owner.getByRole('button', { name: 'Ouvrir le menu', exact: true }).click();
  await capture(owner, '06-menu', 'Menu latéral et business', 'MES BUSINESS');
  await owner.getByRole('button', { name: 'Fermer le menu', exact: true }).click();
  await owner.getByRole('tab', { name: /Bilans/ }).click();
  await capture(owner, '07-historique', 'Historique multi-contributeurs', 'Historique des bilans');
  await owner.getByRole('tab', { name: /Équipe/ }).click();
  await capture(owner, '08-equipe', 'Équipe et rôles', 'Koffi Adjovi (vous)');
  const manager = await pageFor();
  await login(manager, '0197000002');
  await capture(manager, '09-manager', 'Accueil manager — saisie seule', 'Caisse disponible');
  const edit = manager.getByRole('button', { name: 'Modifier mon bilan', exact: true });
  if (await edit.count()) await edit.click();
  else await manager.getByRole('button', { name: 'Faire le bilan du jour', exact: true }).click();
  await manager.getByLabel('Montant global, en francs CFA', { exact: true }).nth(0).fill('42000');
  await manager.getByLabel('Montant global, en francs CFA', { exact: true }).nth(1).fill('3500');
  await manager.getByLabel('Montant global, en francs CFA', { exact: true }).nth(2).fill('1000');
  await capture(manager, '10-bilan', 'Formulaire de bilan réel', "Chiffre d'affaires");
  await manager.getByLabel('Note du jour', { exact: true }).fill('Démonstration visuelle : journée calme, stock vérifié.');
  await manager.getByLabel('Note du jour', { exact: true }).scrollIntoViewIfNeeded();
  await capture(manager, '11-bilan-suite', 'Bilan — stock et note (suite défilée)', 'Note du jour');
  if (errors.length) throw new Error(`Erreurs navigateur : ${errors.join('\n')}`);
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true }).stdout.trim();
  const branch = spawnSync('git', ['branch', '--show-current'], { cwd: root, encoding: 'utf8', windowsHide: true }).stdout.trim();
  const dirty = Boolean(spawnSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8', windowsHide: true }).stdout.trim());
  await writeFile(path.join(output, 'manifest.json'), JSON.stringify({ generatedAt: new Date().toISOString(), head, branch, dirty, browser: browser.version(), captures, errors }, null, 2));
  const priority = ['05-dashboard.png', '09-manager.png', '14-calendrier.png', '15-dashboard-personnalise.png'];
  captures.sort((a, b) => (priority.includes(a.file) ? priority.indexOf(a.file) : 99) - (priority.includes(b.file) ? priority.indexOf(b.file) : 99));
  await writeFile(path.join(output, 'index.html'), `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>BilanGo — galerie locale</title><style>body{margin:0;padding:32px;background:#f3f7f5;color:#085041;font:16px system-ui}h1{margin-top:0}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:28px}figure{margin:0;background:white;padding:16px;border-radius:16px}img{width:100%;max-width:412px;display:block;margin:auto;border:1px solid #dce6e1}figcaption{margin-bottom:16px}a{color:#0f6e56}</style><h1>BilanGo — vrais écrans, rendu Web</h1><p>Données fictives. Captures Playwright dans Chrome, 412 × 915. Ce rendu ne constitue pas une recette Android.</p><p>Source : ${head} · ${new Date().toLocaleString('fr-FR')}</p><main>${captures.map(c => `<figure><figcaption>${c.title}</figcaption><a href="${c.file}"><img src="${c.file}" alt="${c.title}"></a></figure>`).join('')}</main></html>`);
  const gallery = await browser.newPage();
  await gallery.goto(new URL(`file:///${path.join(output, 'index.html').replaceAll('\\', '/')}`).href);
  const loaded = await gallery.locator('img').evaluateAll(images => images.filter(i => i.complete && i.naturalWidth === 412).length);
  if (loaded !== captures.length) throw new Error('Galerie locale incomplète');
  console.log(`Galerie vérifiée : ${loaded} images — ${path.join(output, 'index.html')}`);
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
