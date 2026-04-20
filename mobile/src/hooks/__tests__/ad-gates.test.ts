import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  trackEventMock,
  adTestState,
  premiumState,
  interstitialAdState,
  appOpenAdState,
  storageState,
  saveLastInterstitialShownAtMock,
  saveLastAppOpenShownAtMock,
  shouldAttemptAdPlacementMock,
} = vi.hoisted(() => ({
  trackEventMock: vi.fn(),
  adTestState: {
    loading: false,
    stubModeEnabled: false,
    interstitialStubEnabled: false,
    appOpenStubEnabled: false,
    showInterstitialStub: vi.fn<() => Promise<boolean>>(),
    showAppOpenStub: vi.fn<() => Promise<boolean>>(),
  },
  premiumState: {
    isPremium: false,
    loading: false,
  },
  interstitialAdState: {
    isLoaded: false,
    isOpened: false,
    isClosed: false,
    error: null as Error | null,
    load: vi.fn(),
    show: vi.fn(),
  },
  appOpenAdState: {
    isLoaded: false,
    isOpened: false,
    isClosed: false,
    error: null as Error | null,
    load: vi.fn(),
    show: vi.fn(),
  },
  storageState: {
    interstitial: null as number | null,
    appOpen: null as number | null,
  },
  saveLastInterstitialShownAtMock: vi.fn(async (value: number) => {
    storageState.interstitial = value;
  }),
  saveLastAppOpenShownAtMock: vi.fn(async (value: number) => {
    storageState.appOpen = value;
  }),
  shouldAttemptAdPlacementMock: vi.fn(() => true),
}));

vi.mock('../../contexts/AdTestContext', () => ({
  useAdTest: () => adTestState,
}));

vi.mock('../../contexts/PremiumContext', () => ({
  usePremiumContext: () => premiumState,
}));

vi.mock('react-native-google-mobile-ads', () => ({
  useInterstitialAd: () => interstitialAdState,
  useAppOpenAd: () => appOpenAdState,
}));

vi.mock('../../lib/analytics', () => ({
  trackEvent: trackEventMock,
}));

vi.mock('../../lib/storage/ad-monetization', () => ({
  loadLastInterstitialShownAt: vi.fn(async () => storageState.interstitial),
  saveLastInterstitialShownAt: saveLastInterstitialShownAtMock,
  loadLastAppOpenShownAt: vi.fn(async () => storageState.appOpen),
  saveLastAppOpenShownAt: saveLastAppOpenShownAtMock,
}));

vi.mock('../../lib/ads', () => ({
  getAdUnitId: (_placement: string) => 'ca-app-pub-111/222',
  getInterstitialCooldownMs: () => 20 * 60 * 1000,
  getAppOpenCooldownMs: () => 12 * 60 * 60 * 1000,
  isInterstitialEnabled: () => true,
  isAppOpenEnabled: () => true,
  shouldAttemptAdPlacement: shouldAttemptAdPlacementMock,
}));

import { useInterstitialGate } from '../useInterstitialGate';
import { AppOpenAdGate } from '../../components/AppOpenAdGate';

function flushMicrotasks() {
  return Promise.resolve().then(() => Promise.resolve());
}

function InterstitialHarness({
  isPremium,
  onChange,
}: {
  isPremium: boolean;
  onChange: (value: ReturnType<typeof useInterstitialGate>) => void;
}) {
  const value = useInterstitialGate(isPremium);
  React.useEffect(() => {
    onChange(value);
  }, [value, onChange]);
  return null;
}

describe('ad gate integrations', () => {
  let renderer: TestRenderer.ReactTestRenderer | null = null;
  let latestInterstitial: ReturnType<typeof useInterstitialGate> | null = null;
  const originalDev = globalThis.__DEV__;

  async function renderInterstitialHook(isPremium = false) {
    await act(async () => {
      renderer = TestRenderer.create(
        React.createElement(InterstitialHarness, {
          isPremium,
          onChange: (value) => {
            latestInterstitial = value;
          },
        }),
      );
      await flushMicrotasks();
    });
  }

  async function rerenderInterstitialHook(isPremium = false) {
    await act(async () => {
      renderer?.update(
        React.createElement(InterstitialHarness, {
          isPremium,
          onChange: (value) => {
            latestInterstitial = value;
          },
        }),
      );
      await flushMicrotasks();
    });
  }

  async function renderAppOpenGate() {
    await act(async () => {
      renderer = TestRenderer.create(React.createElement(AppOpenAdGate));
      await flushMicrotasks();
    });
  }

  async function rerenderAppOpenGate() {
    await act(async () => {
      renderer?.update(React.createElement(AppOpenAdGate));
      await flushMicrotasks();
    });
  }

  beforeEach(() => {
    globalThis.__DEV__ = false;
    latestInterstitial = null;
    adTestState.loading = false;
    adTestState.stubModeEnabled = false;
    adTestState.interstitialStubEnabled = false;
    adTestState.appOpenStubEnabled = false;
    adTestState.showInterstitialStub.mockReset();
    adTestState.showAppOpenStub.mockReset();
    premiumState.isPremium = false;
    premiumState.loading = false;
    interstitialAdState.isLoaded = false;
    interstitialAdState.isOpened = false;
    interstitialAdState.isClosed = false;
    interstitialAdState.error = null;
    interstitialAdState.load.mockReset();
    interstitialAdState.show.mockReset();
    appOpenAdState.isLoaded = false;
    appOpenAdState.isOpened = false;
    appOpenAdState.isClosed = false;
    appOpenAdState.error = null;
    appOpenAdState.load.mockReset();
    appOpenAdState.show.mockReset();
    storageState.interstitial = null;
    storageState.appOpen = null;
    saveLastInterstitialShownAtMock.mockClear();
    saveLastAppOpenShownAtMock.mockClear();
    shouldAttemptAdPlacementMock.mockReset();
    shouldAttemptAdPlacementMock.mockReturnValue(true);
    trackEventMock.mockReset();
  });

  afterEach(async () => {
    await act(async () => {
      renderer?.unmount();
      await flushMicrotasks();
    });
    renderer = null;
    globalThis.__DEV__ = originalDev;
  });

  it('shows a real interstitial and only persists the cooldown when the ad closes', async () => {
    interstitialAdState.isLoaded = true;

    await renderInterstitialHook(false);
    expect(interstitialAdState.load).not.toHaveBeenCalled();

    await act(async () => {
      const shown = await latestInterstitial?.maybeShowInterstitial('save_scenario');
      expect(shown).toBe(true);
      await flushMicrotasks();
    });

    expect(interstitialAdState.show).toHaveBeenCalledTimes(1);
    expect(saveLastInterstitialShownAtMock).not.toHaveBeenCalled();

    interstitialAdState.isOpened = true;
    await rerenderInterstitialHook(false);
    expect(trackEventMock).toHaveBeenCalledWith('interstitial_shown', { source: 'save_scenario' });
    expect(saveLastInterstitialShownAtMock).not.toHaveBeenCalled();

    interstitialAdState.isClosed = true;
    await rerenderInterstitialHook(false);

    expect(saveLastInterstitialShownAtMock).toHaveBeenCalledTimes(1);
    expect(storageState.interstitial).not.toBeNull();
  });

  it('uses the interstitial stub path and persists the cooldown after the stub closes', async () => {
    adTestState.stubModeEnabled = true;
    adTestState.interstitialStubEnabled = true;
    adTestState.showInterstitialStub.mockResolvedValue(true);

    await renderInterstitialHook(false);

    await act(async () => {
      const shown = await latestInterstitial?.maybeShowInterstitial('save_scenario');
      expect(shown).toBe(true);
      await flushMicrotasks();
    });

    expect(adTestState.showInterstitialStub).toHaveBeenCalledTimes(1);
    expect(interstitialAdState.show).not.toHaveBeenCalled();
    expect(saveLastInterstitialShownAtMock).toHaveBeenCalledTimes(1);
    expect(trackEventMock).toHaveBeenCalledWith('interstitial_shown', {
      source: 'save_scenario',
      stub: true,
    });
  });

  it('loads, shows, and persists a real app-open ad only after it closes', async () => {
    await renderAppOpenGate();
    expect(appOpenAdState.load).toHaveBeenCalledTimes(1);

    appOpenAdState.isLoaded = true;
    await rerenderAppOpenGate();

    expect(appOpenAdState.show).toHaveBeenCalledTimes(1);
    expect(saveLastAppOpenShownAtMock).not.toHaveBeenCalled();

    appOpenAdState.isOpened = true;
    await rerenderAppOpenGate();
    expect(trackEventMock).toHaveBeenCalledWith('app_open_ad_shown');

    appOpenAdState.isClosed = true;
    await rerenderAppOpenGate();

    expect(saveLastAppOpenShownAtMock).toHaveBeenCalledTimes(1);
    expect(storageState.appOpen).not.toBeNull();
  });

  it('uses the app-open stub path on cold start and persists the cooldown after the stub closes', async () => {
    adTestState.stubModeEnabled = true;
    adTestState.appOpenStubEnabled = true;
    adTestState.showAppOpenStub.mockResolvedValue(true);

    await renderAppOpenGate();

    expect(adTestState.showAppOpenStub).toHaveBeenCalledTimes(1);
    expect(saveLastAppOpenShownAtMock).toHaveBeenCalledTimes(1);
    expect(trackEventMock).toHaveBeenCalledWith('app_open_ad_shown', { stub: true });
  });
});
