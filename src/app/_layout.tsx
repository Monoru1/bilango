import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ServicesProvider } from '@/state/services';
import { SessionProvider, useSessionState } from '@/state/session';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function RootNavigator() {
  const session = useSessionState();

  useEffect(() => {
    if (session.status !== 'booting') SplashScreen.hideAsync().catch(() => undefined);
  }, [session.status]);

  if (session.status === 'booting') return null;

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Protected guard={session.status === 'signedOut'}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={session.status === 'locked'}>
        <Stack.Screen name="unlock" />
      </Stack.Protected>
      <Stack.Protected guard={session.status === 'onboarding'}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={session.status === 'ready'}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <ServicesProvider>
        <SessionProvider>
          <RootNavigator />
        </SessionProvider>
      </ServicesProvider>
    </SafeAreaProvider>
  );
}
