/**
 * Parcours de consolidation (mission 02) sur le vrai arbre de routes : création de business,
 * caisse théorique, historique + modification, abonnement en lecture seule, permissions par rôle.
 */
import { act, fireEvent, renderRouter, screen, testRouter, waitFor, within } from 'expo-router/testing-library';

import { press, autoConfirmAlerts, createPin, enterPhoneAndOtp, FIND, loginExisting, resetDevice } from '@/test-utils/flows';

import { Card } from '@/ui/primitives';
import { router, type Href } from 'expo-router';

jest.setTimeout(60_000);

beforeEach(() => {
  resetDevice();
  autoConfirmAlerts();
});

afterEach(() => {
  jest.restoreAllMocks();
});

async function openMenu() {
  await press(await screen.findByLabelText('Ouvrir le menu', {}, FIND));
  await screen.findByText('MES BUSINESS', {}, FIND);
}

describe('création de business et caisse théorique', () => {
  it('crée un business, déclare la caisse de départ au premier bilan et calcule la caisse', async () => {
    renderRouter('./src/app');
    await enterPhoneAndOtp('01 97 00 00 99');
    fireEvent.changeText(await screen.findByLabelText('Votre nom', {}, FIND), 'Nouveau Client');
    await press(screen.getByLabelText('Continuer'));
    await createPin();

    await press(await screen.findByLabelText('+ Créer mon business', {}, FIND));
    fireEvent.changeText(await screen.findByLabelText('Nom du business', {}, FIND), 'Kiosque du Port');
    // Validation : le secteur est obligatoire.
    await press(screen.getByLabelText('Créer le business'));
    await screen.findByText("Choisissez un secteur d'activité.", {}, FIND);
    await press(screen.getByText('Boutique'));
    await press(screen.getByLabelText('Créer le business'));

    // État vide rassurant avant le premier bilan (§6.3).
    await screen.findByText('Pas encore de bilan', {}, FIND);

    await press(screen.getByLabelText('Faire le bilan du jour'));
    // Premier bilan : la caisse de départ est exigée.
    await press(await screen.findByLabelText('Envoyer le bilan', {}, FIND));
    await screen.findByText('Indiquez le montant compté dans la caisse.', {}, FIND);

    fireEvent.changeText(screen.getByLabelText('Montant compté en caisse, en francs CFA'), '20000');
    const amounts = screen.getAllByLabelText('Montant global, en francs CFA');
    fireEvent.changeText(amounts[0], '10000'); // CA
    fireEvent.changeText(amounts[1], '2500'); // dépenses
    fireEvent.changeText(amounts[2], '5000'); // ajout à la caisse
    await press(screen.getByLabelText('Envoyer le bilan'));

    // 20 000 + 10 000 + 5 000 − 2 500 = 32 500
    await screen.findByText(/Chiffre d'affaires/, {}, FIND);
    testRouter.navigate('/home');
    await waitFor(() => expect(screen.getAllByText(/32\s?500/).length).toBeGreaterThan(0), FIND);
    expect(screen.getByText('Caisse théorique')).toBeTruthy();
  });
});

describe('historique et modification', () => {
  it('modifie un bilan dans les 24 h et conserve la version originale consultable', async () => {
    renderRouter('./src/app');
    await loginExisting('01 97 00 00 01');
    await screen.findByText("Chiffre d'affaires — Aujourd'hui", { exact: false }, FIND);

    await press(screen.getByText('Bilans'));
    const rows = await screen.findAllByLabelText(/Koffi Adjovi/, {}, FIND);
    await press(rows[0]); // bilan du jour, envoyé il y a 45 min : le plus récent
    expect(await screen.findByText(/Modifiable jusqu'/, {}, FIND)).toBeTruthy();

    await press(screen.getByLabelText('Modifier'));
    const revenue = (await screen.findAllByLabelText(/Montant/, {}, FIND))[0];
    fireEvent.changeText(revenue, '58500');
    await press(screen.getByLabelText('Enregistrer la modification'));

    // Détail : badge Modifié et accès aux deux versions.
    await press(await screen.findByText("Version d'origine", {}, FIND));
    await waitFor(() => expect(screen.getAllByText(/48\s?500/).length).toBeGreaterThan(0), FIND);
    expect(screen.getAllByText('Modifié').length).toBeGreaterThan(0);
  });

  it("n'affiche à un profil Saisie seule que ses propres bilans", async () => {
    renderRouter('./src/app');
    await loginExisting('01 97 00 00 02');
    await press(await screen.findByLabelText('Voir mes bilans précédents', {}, FIND));
    await waitFor(() => expect(screen.getAllByText('Mes bilans').length).toBeGreaterThan(0), FIND);
    expect(screen.queryByText('Fatou Dossou')).toBeNull();
  });
});

describe('abonnement en lecture seule', () => {
  it("montre l'état et l'historique, sans aucun parcours de paiement", async () => {
    renderRouter('./src/app');
    await loginExisting('01 97 00 00 01');
    await openMenu();
    await press(screen.getByLabelText(/Mon abonnement/));

    await screen.findByText(/Essai gratuit jusqu'au/, {}, FIND); // Boutique Étoile : essai de 4 jours
    expect(screen.getByText('Historique des paiements')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /payer|renouveler|acheter/i })).toBeNull();
    expect(screen.queryByText(/lien de paiement|Mobile Money|envoyé sur WhatsApp/i)).toBeNull();
    testRouter.navigate('/help');
    await press(await screen.findByLabelText("Gérer l'abonnement", {}, FIND));
    expect(screen.queryByText(/lien de paiement|Mobile Money|envoyé sur WhatsApp/i)).toBeNull();
  });
});

describe('permissions par rôle', () => {
  it('Lecture seule : consulte le dashboard sans pouvoir saisir ni gérer', async () => {
    renderRouter('./src/app');
    await loginExisting('01 97 00 00 04');
    await screen.findByText("Chiffre d'affaires — Hier", { exact: false }, FIND);
    expect(screen.queryByLabelText('Faire le bilan du jour')).toBeNull();
    expect(screen.queryByText('Équipe')).toBeNull();
    expect(screen.getByText('Stock')).toBeTruthy();
  });

  it("Gestion complète : gère l'équipe mais n'accède pas à l'abonnement", async () => {
    renderRouter('./src/app');
    await loginExisting('01 97 00 00 03');
    await screen.findByText("Chiffre d'affaires — Hier", { exact: false }, FIND);
    expect(screen.getByText('Équipe')).toBeTruthy();

    await openMenu();
    expect(screen.queryByLabelText(/^Mon abonnement/)).toBeNull();
  });

  it("Gestion complète : n'invite que des niveaux inférieurs (pas de rôle Gérant proposé)", async () => {
    renderRouter('./src/app');
    await loginExisting('01 97 00 00 03');
    await press(await screen.findByText('Équipe', {}, FIND));
    await press(await screen.findByLabelText("Inviter quelqu'un", {}, FIND));
    await screen.findByText('Caissier', {}, FIND);
    expect(screen.queryByText('Gérant')).toBeNull();
  });
});


describe('démonstration complète avec une base de services conservée', () => {
  it('crée, invite, accepte, saisit puis consulte la caisse depuis le compte propriétaire', async () => {
    renderRouter('./src/app');
    await enterPhoneAndOtp('01 97 00 00 99');
    fireEvent.changeText(await screen.findByLabelText('Votre nom', {}, FIND), 'Propriétaire Démo');
    await press(screen.getByLabelText('Continuer'));
    await createPin();
    await press(await screen.findByLabelText('+ Créer mon business', {}, FIND));
    fireEvent.changeText(await screen.findByLabelText('Nom du business', {}, FIND), 'Kiosque du Port');
    await press(screen.getByText('Boutique'));
    await press(screen.getByLabelText('Créer le business'));
    await screen.findByText('Pas encore de bilan', {}, FIND);
    await press(screen.getByText('Équipe'));
    await press(await screen.findByLabelText("Inviter quelqu'un", {}, FIND));
    fireEvent.changeText(await screen.findByLabelText('Numéro de téléphone', {}, FIND), '01 97 00 00 06');
    await press(await screen.findByText('Vendeur', {}, FIND));
    await press(screen.getByLabelText("Envoyer l'invitation"));
    await screen.findByText('01 97 00 00 06', { exact: false }, FIND);

    await changeAccount();
    await enterPhoneAndOtp('01 97 00 00 06');
    fireEvent.changeText(await screen.findByLabelText('Votre nom', {}, FIND), 'Mireille Démo');
    await press(screen.getByLabelText('Continuer'));
    await createPin();
    await screen.findByText('Kiosque du Port', {}, FIND);
    // Cibler la carte du business, même si une invitation de la seed existe aussi.
    const card = screen.UNSAFE_getAllByType(Card).find((candidate) => within(candidate).queryByText('Kiosque du Port'))!;
    await press(within(card).getByLabelText('Accepter'));
    await press(await screen.findByLabelText('Faire le bilan du jour', {}, FIND));
    fireEvent.changeText(await screen.findByLabelText('Montant compté en caisse, en francs CFA', {}, FIND), '15000');
    const amounts = screen.getAllByLabelText('Montant global, en francs CFA');
    fireEvent.changeText(amounts[0], '40000');
    fireEvent.changeText(amounts[1], '5000');
    await press(screen.getByLabelText('Envoyer le bilan'));
    await screen.findByText(/40\s?000/, {}, FIND);
    testRouter.navigate('/home');
    await screen.findByLabelText('Voir mon bilan', {}, FIND);
    await changeAccount();
    await act(async () => { jest.advanceTimersByTime(31_000); }); // Délai de renvoi OTP.
    await loginExisting('01 97 00 00 99');
    await screen.findByText("Chiffre d'affaires — Aujourd'hui", { exact: false }, FIND);
    expect(screen.getAllByText(/40\s?000/).length).toBeGreaterThan(0);
    expect(screen.getByText(/50\s?000/)).toBeTruthy();
    await press(screen.getByText('Bilans'));
    expect(await screen.findByLabelText(/Mireille Démo.*40\s?000/, {}, FIND)).toBeTruthy();
  });
});

async function changeAccount() {
  await openMenu();
  await press(screen.getByLabelText(/Se déconnecter/));
  await press(await screen.findByLabelText('PIN oublié ou autre numéro', {}, FIND));
  await screen.findByText('Commencer', {}, FIND);
}


describe('expiration automatique des droits de modification', () => {
  it('retire le bouton du détail à 24 h sans interaction', async () => {
    renderRouter('./src/app');
    await loginExisting('01 97 00 00 01');
    await press(await screen.findByText('Bilans', {}, FIND));
    const rows = await screen.findAllByLabelText(/Koffi Adjovi/, {}, FIND);
    await press(rows[0]);
    await screen.findByLabelText('Modifier', {}, FIND);
    await act(async () => { jest.advanceTimersByTime(24 * 3600_000); });
    expect(screen.queryByLabelText('Modifier')).toBeNull();
    expect(screen.queryByText(/Modifiable jusqu'/)).toBeNull();
  });
  it('retire aussi le badge de l’historique sans interaction', async () => {
    renderRouter('./src/app');
    await loginExisting('01 97 00 00 01');
    await press(await screen.findByText('Bilans', {}, FIND));
    await screen.findAllByText('Modifiable', {}, FIND);
    await act(async () => { jest.advanceTimersByTime(24 * 3600_000); });
    expect(screen.queryAllByText('Modifiable')).toHaveLength(0);
  });
});


describe('gardes des routes directes', () => {
  it('refuse les formulaires de gestion et de saisie à un compte Lecture seule', async () => {
    const routes = renderRouter('./src/app');
    await loginExisting('01 97 00 00 04');
    await screen.findByText("Chiffre d'affaires — Hier", { exact: false }, FIND);
    for (const path of ['/report/new', '/team/role-new', '/team/invite', '/stock/new', '/subscription']) {
      await act(async () => { router.push(path as Href); });
      await waitFor(() => expect(routes.getPathname()).toBe('/home'), FIND);
    }
    expect(screen.queryByLabelText('Envoyer le bilan')).toBeNull();
    expect(screen.queryByLabelText('Créer le rôle')).toBeNull();
  });
  it('ne monte pas de formulaire dépendant d’un business pour un compte sans business', async () => {
    renderRouter('./src/app');
    await enterPhoneAndOtp('01 97 00 00 99');
    fireEvent.changeText(await screen.findByLabelText('Votre nom', {}, FIND), 'Client Test');
    await press(screen.getByLabelText('Continuer'));
    await createPin();
    await screen.findByLabelText('+ Créer mon business', {}, FIND);
    await act(async () => { router.push('/report/new'); });
    await screen.findByLabelText('+ Créer mon business', {}, FIND);
    expect(screen.queryByLabelText('Envoyer le bilan')).toBeNull();
  });
});


it('réactualise automatiquement le dashboard au changement de jour métier', async () => {
  renderRouter('./src/app');
  await loginExisting('01 97 00 00 01');
  await screen.findByText("Chiffre d'affaires — Aujourd'hui", { exact: false }, FIND);
  await act(async () => { jest.advanceTimersByTime(24 * 3600_000); });
  await screen.findByText("Chiffre d'affaires — Hier", { exact: false }, FIND);
  expect(screen.getByText('En attente du bilan')).toBeTruthy();
});
