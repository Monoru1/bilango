import { useNavigation } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';

/**
 * Demande confirmation avant de quitter un formulaire modifié (bouton retour Android, geste, en-tête).
 * Évite de perdre un bilan saisi par un retour involontaire. Appeler `allowLeave()` juste avant une
 * navigation volontaire (envoi réussi) pour ne pas redemander.
 */
export function useConfirmLeave(dirty: boolean) {
  const navigation = useNavigation();
  const allowed = useRef(false);

  useEffect(() => {
    return navigation.addListener('beforeRemove', (event) => {
      if (!dirty || allowed.current) return;
      event.preventDefault();
      Alert.alert('Abandonner la saisie ?', 'Les informations saisies ne seront pas enregistrées.', [
        { text: 'Continuer la saisie', style: 'cancel' },
        { text: 'Abandonner', style: 'destructive', onPress: () => navigation.dispatch(event.data.action) },
      ]);
    });
  }, [navigation, dirty]);

  return {
    allowLeave: () => {
      allowed.current = true;
    },
  };
}
