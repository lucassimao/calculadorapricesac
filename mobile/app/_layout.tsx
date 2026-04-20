import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { Sentry, sentryInitialized } from '../src/lib/sentry';
import { AdTestProvider } from '../src/contexts/AdTestContext';
import { ExportProvider } from '../src/contexts/ExportContext';
import { PremiumProvider } from '../src/contexts/PremiumContext';
import { analyticsEnabled, trackEvent } from '../src/lib/analytics';
import { AppOpenAdGate } from '../src/components/AppOpenAdGate';

function RootLayout() {
  useEffect(() => {
    if (!analyticsEnabled()) return;
    trackEvent('app_open');
  }, []);

  return (
    <AdTestProvider>
      <PremiumProvider>
        <ExportProvider>
          <AppOpenAdGate />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
          </Stack>
        </ExportProvider>
      </PremiumProvider>
    </AdTestProvider>
  );
}

export default sentryInitialized ? Sentry.wrap(RootLayout) : RootLayout;
