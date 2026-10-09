import { Alert } from 'react-native';
import { act, fireEvent, screen } from 'expo-router/testing-library';

import { secureStorage } from '@/state/storage';

/** Attend les mises à jour asynchrones déclenchées par le geste, sans masquer les diagnostics React. */
export async function press(element: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => { fireEvent.press(element); });
}

export const FIND = { timeout: 10_000 };

/** Repart d'un téléphone vierge (aucune session, aucun PIN). */
export function resetDevice() {
  (secureStorage as unknown as { clear(): void }).clear();
}

/** Confirme automatiquement les boîtes de dialogue natives (dernier bouton = action principale). */
export function autoConfirmAlerts() {
  return jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
    buttons?.[buttons.length - 1]?.onPress?.();
  });
}

/** Parcours d'ouverture : accueil -> numéro -> code OTP de démo. S'arrête à l'écran suivant la validation. */
export async function enterPhoneAndOtp(phone: string) {
  await press(await screen.findByText('Commencer', {}, FIND));
  fireEvent.changeText(await screen.findByLabelText('Numéro de téléphone', {}, FIND), phone);
  await press(screen.getByLabelText('Recevoir le code sur WhatsApp'));
  fireEvent.changeText(await screen.findByLabelText('Code de vérification', {}, FIND), '123456');
  await press(screen.getByLabelText('Valider'));
}

/** Saisit un PIN sur le pavé numérique. */
export async function typePin(pin: string) {
  for (const digit of pin) await press(await screen.findByLabelText(digit, {}, FIND));
}

/** Création du PIN à la première connexion (saisie + confirmation). */
export async function createPin(pin = '1234') {
  await typePin(pin);
  await typePin(pin);
}

/** Connexion complète d'un compte existant déjà nommé. */
export async function loginExisting(phone: string, pin = '1234') {
  await enterPhoneAndOtp(phone);
  await createPin(pin);
}
