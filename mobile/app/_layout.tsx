import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { Sentry, sentryInitialized } from '../src/lib/sentry';
import { AdTestProvider } from '../src/contexts/AdTestContext';
import { ExportProvider } from '../src/contexts/ExportContext';
import { PremiumProvider } from '../src/contexts/PremiumContext';
import {
  analyticsEnabled,
  flushAnalytics,
  registerAnalyticsProperties,
  trackInstallIfNeeded,
  trackEvent,
} from '../src/lib/analytics';
import { AppOpenAdGate } from '../src/components/AppOpenAdGate';
import { loadBrandProfile } from '../src/lib/storage/brand-profile';
import { getBrandProfileAnalyticsProperties } from '../src/types/brand-profile';

function RootLayout() {
  useEffect(() => {
    if (!analyticsEnabled()) return;

    trackEvent('$app_opened');
    void trackInstallIfNeeded().catch(() => {});
  }, []);

  useEffect(() => {
    if (!analyticsEnabled()) return;

    loadBrandProfile()
      .then((profile) => {
        registerAnalyticsProperties(getBrandProfileAnalyticsProperties(profile));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!analyticsEnabled()) return;

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background') {
        void flushAnalytics().catch(() => {});
      }
    });

    return () => {
      subscription.remove();
    };
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
