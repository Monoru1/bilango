/**
 * Parcours de consolidation (mission 02) sur le vrai arbre de routes : création de business,
 * caisse théorique, historique + modification, abonnement en lecture seule, permissions par rôle.
 */
import { fireEvent, renderRouter, screen, testRouter, waitFor } from 'expo-router/testing-library';

import { autoConfirmAlerts, createPin, enterPhoneAndOtp, FIND, loginExisting, resetDevice } from '@/test-utils/flows';

jest.setTimeout(60_000);

beforeEach(() => {
  resetDevice();
  autoConfirmAlerts();
});

afterEach(() => {
  jest.restoreAllMocks();
});

async function openMenu() {
  fireEvent.press(await screen.findByLabelText('Ouvrir le menu', {}, FIND));
  await screen.findByText('MES BUSINESS', {}, FIND);
}

describe('création de business et caisse théorique', () => {
  it('crée un business, déclare la caisse de départ au premier bilan et calcule la caisse', async () => {
    renderRouter('./src/app');
    await enterPhoneAndOtp('01 97 00 00 99');
    fireEvent.changeText(await screen.findByLabelText('Votre nom', {}, FIND), 'Nouveau Client');
    fireEvent.press(screen.getByLabelText('Continuer'));
    await createPin();

    fireEvent.press(await screen.findByLabelText('+ Créer mon business', {}, FIND));
    fireEvent.changeText(await screen.findByLabelText('Nom du business', {}, FIND), 'Kiosque du Port');
    // Validation : le secteur est obligatoire.
    fireEvent.press(screen.getByLabelText('Créer le business'));
    await screen.findByText("Choisissez un secteur d'activité.", {}, FIND);
    fireEvent.press(screen.getByText('Boutique'));
    fireEvent.press(screen.getByLabelText('Créer le business'));

    // État vide rassurant avant le premier bilan (§6.3).
    await screen.findByText('Pas encore de bilan', {}, FIND);

    fireEvent.press(screen.getByLabelText('Faire le bilan du jour'));
    // Premier bilan : la caisse de départ est exigée.
    fireEvent.press(await screen.findByLabelText('Envoyer le bilan', {}, FIND));
    await screen.findByText('Indiquez le montant compté dans la caisse.', {}, FIND);

    fireEvent.changeText(screen.getByLabelText('Montant compté en caisse, en francs CFA'), '20000');
    const amounts = screen.getAllByLabelText('Montant global, en francs CFA');
    fireEvent.changeText(amounts[0], '10000'); // CA
    fireEvent.changeText(amounts[1], '2500'); // dépenses
    fireEvent.changeText(amounts[2], '5000'); // ajout à la caisse
    fireEvent.press(screen.getByLabelText('Envoyer le bilan'));

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

    fireEvent.press(screen.getByText('Bilans'));
    const rows = await screen.findAllByLabelText(/Koffi Adjovi/, {}, FIND);
    fireEvent.press(rows[0]); // bilan du jour, envoyé il y a 45 min : le plus récent
    expect(await screen.findByText(/Modifiable jusqu'/, {}, FIND)).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Modifier'));
    const revenue = (await screen.findAllByLabelText(/Montant/, {}, FIND))[0];
    fireEvent.changeText(revenue, '58500');
    fireEvent.press(screen.getByLabelText('Enregistrer la modification'));

    // Détail : badge Modifié et accès aux deux versions.
    fireEvent.press(await screen.findByText("Version d'origine", {}, FIND));
    await waitFor(() => expect(screen.getAllByText(/48\s?500/).length).toBeGreaterThan(0), FIND);
    expect(screen.getAllByText('Modifié').length).toBeGreaterThan(0);
  });

  it("n'affiche à un profil Saisie seule que ses propres bilans", async () => {
    renderRouter('./src/app');
    await loginExisting('01 97 00 00 02');
    fireEvent.press(await screen.findByLabelText('Voir mes bilans précédents', {}, FIND));
    await waitFor(() => expect(screen.getAllByText('Mes bilans').length).toBeGreaterThan(0), FIND);
    expect(screen.queryByText('Fatou Dossou')).toBeNull();
  });
});

describe('abonnement en lecture seule', () => {
  it("montre l'état et l'historique, sans aucun parcours de paiement", async () => {
    renderRouter('./src/app');
    await loginExisting('01 97 00 00 01');
    await openMenu();
    fireEvent.press(screen.getByLabelText(/Mon abonnement/));

    await screen.findByText(/Essai gratuit jusqu'au/, {}, FIND); // Boutique Étoile : essai de 4 jours
    expect(screen.getByText('Historique des paiements')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /payer|renouveler|acheter/i })).toBeNull();
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
    fireEvent.press(await screen.findByText('Équipe', {}, FIND));
    fireEvent.press(await screen.findByLabelText("Inviter quelqu'un", {}, FIND));
    await screen.findByText('Caissier', {}, FIND);
    expect(screen.queryByText('Gérant')).toBeNull();
  });
});
