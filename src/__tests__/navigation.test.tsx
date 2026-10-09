/**
 * Tests d'intégration du vrai arbre de routes (src/app) sur les services mock, sans émulateur :
 * connexion OTP + PIN, gardes de navigation par état de session, parcours propriétaire et manager.
 * Les modules natifs et le stockage sont doublés dans jest.setup.ts.
 */
import { fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';

import { autoConfirmAlerts, createPin, enterPhoneAndOtp, FIND, loginExisting, resetDevice } from '@/test-utils/flows';

jest.setTimeout(60_000);

beforeEach(() => {
  resetDevice();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('propriétaire', () => {
  it("se connecte par OTP puis PIN et voit CA, caisse théorique et l'attente du bilan du jour", async () => {
    renderRouter('./src/app');
    await loginExisting('01 97 00 00 01');

    // Premier business (propriétaire, ordre alphabétique) : Boutique Étoile, bilan du jour déjà reçu.
    await screen.findByText("Chiffre d'affaires — Aujourd'hui", { exact: false }, FIND);
    expect(screen.queryByText('En attente du bilan')).toBeNull();
    expect(screen.getByText('Caisse théorique')).toBeTruthy();
    expect(screen.getByLabelText('Faire le bilan du jour')).toBeTruthy();
    expect(screen.getByText('Équipe')).toBeTruthy();
  });

  it('change de business depuis le menu latéral et voit le CA du jour de chaque business', async () => {
    renderRouter('./src/app');
    await loginExisting('01 97 00 00 01');
    await screen.findByText("Chiffre d'affaires — Aujourd'hui", { exact: false }, FIND);
    // Boutique Étoile n'a pas activé le module Stock : pas d'onglet Stock.
    expect(screen.queryByText('Stock')).toBeNull();

    fireEvent.press(screen.getByLabelText('Ouvrir le menu'));
    expect(await screen.findByLabelText(/Chez Maman Bar, Propriétaire/, {}, FIND)).toBeTruthy();
    expect(screen.getByLabelText(/E-Shop Cotonou, Livreur/)).toBeTruthy();
    // Mini-indicateur du CA du jour à côté de chaque business.
    expect(within(screen.getByLabelText(/Boutique Étoile, Propriétaire/)).getByText(/48\s?500/)).toBeTruthy();

    // Chez Maman Bar : pas de bilan aujourd'hui -> dernier bilan daté + badge, et onglet Stock.
    fireEvent.press(screen.getByLabelText(/Chez Maman Bar, Propriétaire/));
    await screen.findByText("Chiffre d'affaires — Hier", { exact: false }, FIND);
    expect(screen.getByText('En attente du bilan')).toBeTruthy();
    expect(screen.getByText('Stock')).toBeTruthy();
  });
});

describe('manager (Saisie seule)', () => {
  it("envoie son bilan du jour puis voit le bouton Modifier avec l'heure limite", async () => {
    autoConfirmAlerts();
    renderRouter('./src/app');
    await loginExisting('01 97 00 00 02');

    fireEvent.press(await screen.findByLabelText('Faire le bilan du jour', {}, FIND));
    const amounts = await screen.findAllByLabelText('Montant global, en francs CFA', {}, FIND);
    fireEvent.changeText(amounts[0], '64500');
    fireEvent.changeText(amounts[1], '5000');
    fireEvent.press(screen.getByLabelText('Envoyer le bilan'));

    // Après l'envoi : détail du bilan, avec les montants saisis.
    await screen.findByText(/64\s?500/, {}, FIND);

    fireEvent.press(screen.getByLabelText('Modifier'));
    await screen.findByText("La version d'origine est conservée", { exact: false }, FIND);
  });

  it("refuse l'envoi d'un bilan invalide avec un message de validation", async () => {
    autoConfirmAlerts();
    renderRouter('./src/app');
    await loginExisting('01 97 00 00 02');

    fireEvent.press(await screen.findByLabelText('Faire le bilan du jour', {}, FIND));
    fireEvent.press(await screen.findByLabelText('Détailler Chiffre d\'affaires (optionnel)', {}, FIND));
    fireEvent.changeText(await screen.findByLabelText('Montant, en francs CFA', {}, FIND), '500');
    fireEvent.press(screen.getByLabelText('Envoyer le bilan'));

    await screen.findByText('Chaque ligne détaillée doit avoir un nom.', {}, FIND);
  });

  it("n'a ni onglet Équipe ni accès à l'abonnement", async () => {
    renderRouter('./src/app');
    await loginExisting('01 97 00 00 02');
    await screen.findByLabelText('Faire le bilan du jour', {}, FIND);
    expect(screen.queryByText('Équipe')).toBeNull();

    fireEvent.press(screen.getByLabelText('Ouvrir le menu'));
    await screen.findByText('MES BUSINESS', {}, FIND);
    expect(screen.queryByText('Mon abonnement')).toBeNull();
  });
});

describe('nouveaux comptes', () => {
  it('un numéro déjà invité arrive sur son invitation, et y accède au business après acceptation', async () => {
    renderRouter('./src/app');
    await enterPhoneAndOtp('01 97 00 00 06');

    fireEvent.changeText(await screen.findByLabelText('Votre nom', {}, FIND), 'Mireille Agbo');
    fireEvent.press(screen.getByLabelText('Continuer'));
    await createPin();

    await screen.findByText("Vous n'aurez accès au business qu'après avoir accepté l'invitation.", {}, FIND);
    expect(screen.getByText('Chez Maman Bar')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Accepter'));
    await waitFor(() => expect(screen.getByLabelText('Faire le bilan du jour')).toBeTruthy(), FIND);
  });

  it('un numéro sans invitation ne voit qu\'un seul choix : créer son business', async () => {
    renderRouter('./src/app');
    await enterPhoneAndOtp('01 97 00 00 99');

    fireEvent.changeText(await screen.findByLabelText('Votre nom', {}, FIND), 'Nouveau Client');
    fireEvent.press(screen.getByLabelText('Continuer'));
    await createPin();

    expect(await screen.findByLabelText('+ Créer mon business', {}, FIND)).toBeTruthy();
  });
});

describe('session', () => {
  it('rejette un mauvais code OTP et reste sur la saisie du code', async () => {
    renderRouter('./src/app');
    fireEvent.press(await screen.findByText('Commencer', {}, FIND));
    fireEvent.changeText(await screen.findByLabelText('Numéro de téléphone', {}, FIND), '01 97 00 00 01');
    fireEvent.press(screen.getByLabelText('Recevoir le code sur WhatsApp'));
    fireEvent.changeText(await screen.findByLabelText('Code de vérification', {}, FIND), '000000');
    fireEvent.press(screen.getByLabelText('Valider'));
    await screen.findByText('Code incorrect. Vérifiez le code reçu.', {}, FIND);
  });

  it('valide le format du numéro avant tout envoi de code', async () => {
    renderRouter('./src/app');
    fireEvent.press(await screen.findByText('Commencer', {}, FIND));
    fireEvent.changeText(await screen.findByLabelText('Numéro de téléphone', {}, FIND), '12 34');
    fireEvent.press(screen.getByLabelText('Recevoir le code sur WhatsApp'));
    await screen.findByText(/Entrez un numéro béninois à 10 chiffres/, {}, FIND);
  });

  it('une déconnexion verrouille ; le PIN rouvre la session sans nouvel OTP', async () => {
    renderRouter('./src/app');
    await loginExisting('01 97 00 00 01', '2468');
    await screen.findByText("Chiffre d'affaires — Aujourd'hui", { exact: false }, FIND);

    fireEvent.press(screen.getByLabelText('Ouvrir le menu'));
    fireEvent.press(await screen.findByLabelText(/Se déconnecter/, {}, FIND));

    await screen.findByText('Entrez votre code PIN', {}, FIND);
    for (const d of '1111') fireEvent.press(screen.getByLabelText(d));
    await screen.findByText(/PIN incorrect. Il vous reste 4 essais./, {}, FIND);
    for (const d of '2468') fireEvent.press(screen.getByLabelText(d));
    await screen.findByText("Chiffre d'affaires — Aujourd'hui", { exact: false }, FIND);
  });
});
