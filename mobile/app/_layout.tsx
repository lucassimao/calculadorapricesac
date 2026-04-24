import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { Sentry, sentryInitialized } from '../src/lib/sentry';
import { AdTestProvider } from '../src/contexts/AdTestContext';
import { ExportProvider } from '../src/contexts/ExportContext';
import { PremiumProvider } from '../src/contexts/PremiumContext';
import { analyticsEnabled, registerAnalyticsProperties, trackEvent } from '../src/lib/analytics';
import { AppOpenAdGate } from '../src/components/AppOpenAdGate';
import { loadBrandProfile } from '../src/lib/storage/brand-profile';
import {
  getBrandProfileAnalyticsProperties,
  isBrandProfileComplete,
} from '../src/types/brand-profile';

function RootLayout() {
  useEffect(() => {
    if (!analyticsEnabled()) return;

    loadBrandProfile()
      .then((profile) => {
        if (isBrandProfileComplete(profile)) {
          registerAnalyticsProperties(getBrandProfileAnalyticsProperties(profile));
        }
        trackEvent('app_open');
      })
      .catch(() => {
        trackEvent('app_open');
      });
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
