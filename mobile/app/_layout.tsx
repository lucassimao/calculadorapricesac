import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { Sentry, sentryInitialized } from '../src/lib/sentry';
import { ExportProvider } from '../src/contexts/ExportContext';
import { analyticsEnabled, trackEvent } from '../src/lib/analytics';

function RootLayout() {
  useEffect(() => {
    if (!analyticsEnabled()) return;
    trackEvent('app_open');
  }, []);

  return (
    <ExportProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </ExportProvider>
  );
}

export default sentryInitialized ? Sentry.wrap(RootLayout) : RootLayout;
