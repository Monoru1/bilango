/** Chromium device emulation is not proof of a physical Android/iOS installation. */
import { chromium } from 'playwright';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM });
const check = (value, text) => { if (!value) throw new Error(text); console.log(`PASS ${text}`); };
try {
  const desktop = await browser.newPage();
  await desktop.goto('http://localhost:5173/?demo=0');
  await desktop.getByRole('button', { name: 'Installer l’application' }).waitFor();
  check(await desktop.getByRole('button', { name: 'Créer mon compte / nouvel appareil' }).count() === 0, 'navigateur : inscription masquée avant installation');
  await desktop.getByRole('link', { name: /Mentions légales/ }).click();
  await desktop.getByText('Conditions générales', { exact: false }).first().waitFor();
  check(true, 'page légale publique depuis installation');

  const android = await browser.newPage({ userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36', viewport: { width: 390, height: 844 } });
  await android.goto('http://localhost:5173/');
  await android.getByRole('button', { name: 'Installer l’application' }).waitFor();
  await android.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    event.prompt = async () => { document.documentElement.dataset.promptCalled = 'true'; };
    event.userChoice = Promise.resolve({ outcome: 'dismissed' });
    window.dispatchEvent(event);
  });
  await android.getByRole('button', { name: 'Installer l’application' }).click();
  check(await android.locator('html').getAttribute('data-prompt-called') === 'true', 'Android émulé : événement d’installation relancé (signal simulé)');

  const iphone = await browser.newPage({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1', viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await iphone.goto('http://localhost:5173/');
  const install = iphone.getByRole('button', { name: 'Installer l’application' });
  await install.click();
  const guide = iphone.getByRole('dialog', { name: 'Installer GoBilan sur iPhone' });
  await guide.waitFor();
  check(await guide.getByRole('listitem').count() === 4, 'iPhone émulé : quatre étapes et guide affiché');
  check(await iphone.locator('.bob').evaluate(node => getComputedStyle(node).animationName) === 'none', 'préférence de mouvement réduit respectée');
  check(await guide.getByRole('button', { name: 'Fermer' }).evaluate(node => node === document.activeElement), 'guide iPhone : focus placé sur Fermer');
  await iphone.keyboard.press('Tab');
  check(await guide.getByRole('button', { name: 'Fermer' }).evaluate(node => node === document.activeElement), 'guide iPhone : focus contenu dans la modale');
  await iphone.keyboard.press('Escape');
  await guide.waitFor({ state: 'hidden' });
  check(await install.evaluate(node => node === document.activeElement), 'guide iPhone : Échap ferme et restitue le focus');
  await install.click(); await guide.waitFor();
  await iphone.screenshot({ path: join(process.env.E2E_ARTIFACTS ?? tmpdir(), 'gobilan-ios-guide.png'), fullPage: true });
  check(true, 'guide iPhone réaffiché après fermeture');

  const embedded = await browser.newPage({ userAgent: 'Mozilla/5.0 (iPhone) Instagram', viewport: { width: 390, height: 844 } });
  await embedded.goto('http://localhost:5173/');
  await embedded.getByText('Ouvre ce lien dans Chrome / Safari', { exact: true }).waitFor();
  check(await embedded.getByRole('button', { name: 'Installer l’application' }).count() === 0, 'navigateur intégré : Chrome/Safari proposé sans fausse installation');
} finally { await browser.close(); }
