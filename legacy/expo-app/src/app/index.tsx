import { Redirect } from 'expo-router';

import { useSessionState } from '@/state/session';

/** Point d'entrée : aiguille vers le parcours correspondant à l'état de la session. */
export default function Index() {
  const session = useSessionState();
  switch (session.status) {
    case 'ready':
      return <Redirect href="/home" />;
    case 'locked':
      return <Redirect href="/unlock" />;
    case 'onboarding':
      return <Redirect href="/onboarding" />;
    default:
      return <Redirect href="/welcome" />;
  }
}
