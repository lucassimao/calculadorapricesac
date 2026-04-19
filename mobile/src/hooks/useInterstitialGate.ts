import { useCallback, useEffect, useState } from 'react';
import { useInterstitialAd } from 'react-native-google-mobile-ads';
import { useAdTest } from '../contexts/AdTestContext';
import {
  getAdUnitId,
  getInterstitialCooldownMs,
  isInterstitialEnabled,
  shouldAttemptAdPlacement,
} from '../lib/ads';
import { trackEvent } from '../lib/analytics';
import {
  loadLastInterstitialShownAt,
  saveLastInterstitialShownAt,
} from '../lib/storage/ad-monetization';

export function useInterstitialGate(isPremium: boolean) {
  const {
    loading: adTestLoading,
    stubModeEnabled,
    interstitialStubEnabled,
    showInterstitialStub,
  } = useAdTest();
  const enabled = isInterstitialEnabled() || (stubModeEnabled && interstitialStubEnabled);
  const cooldownMs = getInterstitialCooldownMs();
  const interstitialUnitId = enabled && !stubModeEnabled ? getAdUnitId('interstitial') : null;
  const canUseRealInterstitial =
    enabled && !adTestLoading && !stubModeEnabled && !isPremium && interstitialUnitId !== null;
  const { isLoaded, isOpened, isClosed, error, load, show } = useInterstitialAd(interstitialUnitId);
  const [lastShownAt, setLastShownAt] = useState<number | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const [activeSource, setActiveSource] = useState<string | null>(null);
  const [openedSource, setOpenedSource] = useState<string | null>(null);

  useEffect(() => {
    loadLastInterstitialShownAt()
      .then((value) => setLastShownAt(value))
      .finally(() => setStorageReady(true));
  }, []);

  useEffect(() => {
    if (!canUseRealInterstitial || isLoaded || isOpened) return;
    load();
  }, [canUseRealInterstitial, isLoaded, isOpened, load]);

  useEffect(() => {
    if (!canUseRealInterstitial || (!isClosed && !error)) return;
    load();
  }, [canUseRealInterstitial, isClosed, error, load]);

  useEffect(() => {
    if (!activeSource || !isOpened) return;
    if (openedSource === activeSource) return;

    setOpenedSource(activeSource);
    trackEvent('interstitial_shown', { source: activeSource });
  }, [activeSource, isOpened, openedSource]);

  useEffect(() => {
    if (!activeSource || !isClosed) return;

    const shownAt = Date.now();
    void saveLastInterstitialShownAt(shownAt);
    setLastShownAt(shownAt);
    setActiveSource(null);
    setOpenedSource(null);
  }, [activeSource, isClosed]);

  useEffect(() => {
    if (!activeSource || !error) return;

    setActiveSource(null);
    setOpenedSource(null);
  }, [activeSource, error]);

  const maybeShowInterstitial = useCallback(
    async (source: string) => {
      if (activeSource) return false;

      const now = Date.now();
      const shouldShow = shouldAttemptAdPlacement({
        enabled:
          enabled && storageReady && (stubModeEnabled || (canUseRealInterstitial && isLoaded)),
        isPremium,
        lastShownAt,
        now,
        cooldownMs,
      });

      if (!shouldShow) return false;

      if (stubModeEnabled) {
        const shown = await showInterstitialStub();

        if (!shown) return false;

        const shownAt = Date.now();
        await saveLastInterstitialShownAt(shownAt);
        setLastShownAt(shownAt);
        trackEvent('interstitial_shown', { source, stub: true });
        return true;
      }

      setActiveSource(source);
      setOpenedSource(null);

      try {
        show();
      } catch (showError) {
        setActiveSource(null);
        setOpenedSource(null);
        throw showError;
      }

      return true;
    },
    [
      activeSource,
      enabled,
      storageReady,
      isLoaded,
      isPremium,
      lastShownAt,
      cooldownMs,
      stubModeEnabled,
      showInterstitialStub,
      show,
    ],
  );

  return {
    maybeShowInterstitial,
  };
}
