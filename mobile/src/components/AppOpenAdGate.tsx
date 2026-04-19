import { useEffect, useRef, useState } from 'react';
import { useAppOpenAd } from 'react-native-google-mobile-ads';
import { useAdTest } from '../contexts/AdTestContext';
import {
  getAdUnitId,
  getAppOpenCooldownMs,
  isAppOpenEnabled,
  shouldAttemptAdPlacement,
} from '../lib/ads';
import { trackEvent } from '../lib/analytics';
import { usePremium } from '../hooks/usePremium';
import { loadLastAppOpenShownAt, saveLastAppOpenShownAt } from '../lib/storage/ad-monetization';

export function AppOpenAdGate() {
  const { isPremium, loading } = usePremium();
  const {
    loading: adTestLoading,
    stubModeEnabled,
    appOpenStubEnabled,
    showAppOpenStub,
  } = useAdTest();
  const enabled = isAppOpenEnabled() || (stubModeEnabled && appOpenStubEnabled);
  const cooldownMs = getAppOpenCooldownMs();
  const appOpenUnitId = enabled && !stubModeEnabled && !__DEV__ ? getAdUnitId('appOpen') : null;
  const shouldUseRealAppOpen = appOpenUnitId !== null;
  const { isLoaded, isOpened, isClosed, error, load, show } = useAppOpenAd(appOpenUnitId);
  const [lastShownAt, setLastShownAt] = useState<number | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const [activeAttempt, setActiveAttempt] = useState(false);
  const hasTriedShowRef = useRef(false);
  const initialColdStartEnabledRef = useRef<boolean | null>(null);
  const openedTrackedRef = useRef(false);

  useEffect(() => {
    loadLastAppOpenShownAt()
      .then((value) => setLastShownAt(value))
      .finally(() => setStorageReady(true));
  }, []);

  useEffect(() => {
    if (loading || adTestLoading || !storageReady) return;
    if (initialColdStartEnabledRef.current !== null) return;
    initialColdStartEnabledRef.current = __DEV__ ? stubModeEnabled && appOpenStubEnabled : enabled;
  }, [enabled, loading, adTestLoading, storageReady, stubModeEnabled, appOpenStubEnabled]);

  useEffect(() => {
    if (!shouldUseRealAppOpen || loading || adTestLoading || isPremium) return;
    if (isLoaded || isOpened) return;
    load();
  }, [shouldUseRealAppOpen, loading, adTestLoading, isPremium, isLoaded, isOpened, load]);

  // This gate is intentionally cold-start only for now. We are not listening to AppState
  // transitions yet, because the first rollout only needs a conservative app-open placement.
  useEffect(() => {
    if (!enabled || loading || adTestLoading || !storageReady || hasTriedShowRef.current) return;
    if (initialColdStartEnabledRef.current !== true) return;
    if (!stubModeEnabled && (!shouldUseRealAppOpen || !isLoaded || isOpened || activeAttempt))
      return;

    const now = Date.now();
    const shouldShow = shouldAttemptAdPlacement({
      enabled: true,
      isPremium,
      lastShownAt,
      now,
      cooldownMs,
    });

    if (!shouldShow) return;

    hasTriedShowRef.current = true;
    if (stubModeEnabled) {
      void (async () => {
        const shown = await showAppOpenStub();
        if (!shown) return;

        const shownAt = Date.now();
        await saveLastAppOpenShownAt(shownAt);
        setLastShownAt(shownAt);
        trackEvent('app_open_ad_shown', { stub: true });
      })();
      return;
    }

    setActiveAttempt(true);
    openedTrackedRef.current = false;

    try {
      show();
    } catch {
      setActiveAttempt(false);
      openedTrackedRef.current = false;
    }
  }, [
    enabled,
    loading,
    adTestLoading,
    storageReady,
    stubModeEnabled,
    shouldUseRealAppOpen,
    isLoaded,
    isOpened,
    activeAttempt,
    isPremium,
    lastShownAt,
    cooldownMs,
    showAppOpenStub,
    show,
  ]);

  useEffect(() => {
    if (!activeAttempt || !isOpened || openedTrackedRef.current) return;

    openedTrackedRef.current = true;
    trackEvent('app_open_ad_shown');
  }, [activeAttempt, isOpened]);

  useEffect(() => {
    if (!activeAttempt || !isClosed) return;

    const shownAt = Date.now();
    void saveLastAppOpenShownAt(shownAt);
    setLastShownAt(shownAt);
    setActiveAttempt(false);
    openedTrackedRef.current = false;
  }, [activeAttempt, isClosed]);

  useEffect(() => {
    if (!activeAttempt || !error) return;

    setActiveAttempt(false);
    openedTrackedRef.current = false;
  }, [activeAttempt, error]);

  return null;
}
