import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { Sentry, sentryInitialized } from '../src/lib/sentry';
import { AdTestProvider } from '../src/contexts/AdTestContext';
import { ExportProvider } from '../src/contexts/ExportContext';
import { loadLastKnownPremiumStatus, PremiumProvider } from '../src/contexts/PremiumContext';
import {
  analyticsEnabled,
  flushAnalytics,
  markAppBackground,
  registerAnalyticsProperties,
  trackAppOpen,
  trackEvent,
  trackInstallIfNeeded,
} from '../src/lib/analytics';
import { AppOpenAdGate } from '../src/components/AppOpenAdGate';
import { loadBrandProfile } from '../src/lib/storage/brand-profile';
import { getBrandProfileAnalyticsProperties } from '../src/types/brand-profile';
import { loadScenarios } from '../src/lib/storage/scenarios';
import { reconcileStalePurchaseAttempt } from '../src/lib/purchase-attempt';

function RootLayout() {
  const [analyticsReady, setAnalyticsReady] = useState(() => !analyticsEnabled());

  useEffect(() => {
    if (!analyticsEnabled()) return;

    void Promise.all([loadLastKnownPremiumStatus(), loadScenarios()])
      .then(async ([isPremium, scenarios]) => {
        registerAnalyticsProperties({
          is_premium: isPremium,
          saved_scenario_count: scenarios.length,
        });
        await Promise.all([trackAppOpen(), trackInstallIfNeeded()]);
        const attempt = await reconcileStalePurchaseAttempt();
        if (!attempt) return;
        trackEvent('purchase_failed', {
          source: attempt.source,
          flow: 'purchase',
          connected: false,
          store_ready: false,
          product_loaded: false,
          is_premium: isPremium,
          attempt_id: attempt.id,
          error_code: attempt.errorCode,
        });
      })
      .catch(() => {})
      .finally(() => setAnalyticsReady(true));
  }, []);

  useEffect(() => {
    if (!analyticsEnabled()) return;

    loadBrandProfile()
      .then((profile) => {
        registerAnalyticsProperties({
          has_brand_profile:
            getBrandProfileAnalyticsProperties(profile).professional_profile_complete,
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!analyticsEnabled()) return;

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background') {
        void Promise.all([markAppBackground(), flushAnalytics()]).catch(() => {});
      } else if (nextState === 'active') {
        void trackAppOpen().catch(() => {});
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  if (!analyticsReady) return null;

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
