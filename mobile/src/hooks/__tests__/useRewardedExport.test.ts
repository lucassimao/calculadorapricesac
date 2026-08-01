/* eslint-disable import/first */
import React, { useEffect } from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { REWARDED_EXPORT_TIMEOUT_MS } from '../rewarded-export-state';

const { alertMock, trackEventMock, adTestState, rewardedAdState } = vi.hoisted(() => ({
  alertMock: vi.fn(),
  trackEventMock: vi.fn(),
  adTestState: {
    loading: false,
    stubModeEnabled: false,
    showRewardedStub: vi.fn<() => Promise<'earned' | 'cancelled' | 'error' | false>>(),
  },
  rewardedAdState: {
    isLoaded: false,
    isOpened: false,
    isClosed: false,
    isEarnedReward: false,
    error: null as Error | null,
    load: vi.fn(),
    show: vi.fn(),
  },
}));

vi.mock('react-native', () => ({
  Alert: {
    alert: alertMock,
  },
}));

vi.mock('../../contexts/AdTestContext', () => ({
  useAdTest: () => adTestState,
}));

vi.mock('react-native-google-mobile-ads', () => ({
  useRewardedAd: () => rewardedAdState,
}));

vi.mock('../../lib/analytics', () => ({
  getNextRewardedChoiceCount: async () => 1,
  trackEvent: trackEventMock,
}));

vi.mock('../../lib/ads', () => ({
  getAdUnitId: () => 'ca-app-pub-111/222',
  isRewardedExportEnabled: () => true,
}));

import { useRewardedExport } from '../useRewardedExport';

function flushMicrotasks() {
  return Promise.resolve().then(() => Promise.resolve());
}

function HookHarness({
  isPremium,
  onChange,
}: {
  isPremium: boolean;
  onChange: (value: ReturnType<typeof useRewardedExport>) => void;
}) {
  const value = useRewardedExport(isPremium);

  useEffect(() => {
    onChange(value);
  }, [value, onChange]);

  return null;
}

describe('useRewardedExport', () => {
  let renderer: ReactTestRenderer | null = null;
  let latestValue: ReturnType<typeof useRewardedExport> | null = null;

  async function renderHook(isPremium = false) {
    await act(async () => {
      renderer = TestRenderer.create(
        React.createElement(HookHarness, {
          isPremium,
          onChange: (value) => {
            latestValue = value;
          },
        }),
      );
      await flushMicrotasks();
    });
  }

  async function rerenderHook(isPremium = false) {
    await act(async () => {
      renderer?.update(
        React.createElement(HookHarness, {
          isPremium,
          onChange: (value) => {
            latestValue = value;
          },
        }),
      );
      await flushMicrotasks();
    });
  }

  beforeEach(() => {
    vi.useFakeTimers();
    latestValue = null;
    adTestState.loading = false;
    adTestState.stubModeEnabled = false;
    adTestState.showRewardedStub.mockReset();
    rewardedAdState.isLoaded = false;
    rewardedAdState.isOpened = false;
    rewardedAdState.isClosed = false;
    rewardedAdState.isEarnedReward = false;
    rewardedAdState.error = null;
    rewardedAdState.load.mockReset();
    rewardedAdState.show.mockReset();
    alertMock.mockReset();
    trackEventMock.mockReset();
  });

  afterEach(async () => {
    await act(async () => {
      renderer?.unmount();
      await flushMicrotasks();
    });
    renderer = null;
    vi.useRealTimers();
  });

  it('unlocks the export through the stub flow and clears the pending format', async () => {
    adTestState.stubModeEnabled = true;
    adTestState.showRewardedStub.mockResolvedValue('earned');
    const onUnlocked = vi.fn(async () => {});

    await renderHook(false);

    await act(async () => {
      const started = await latestValue?.requestRewardedExport({
        format: 'pdf',
        source: 'tab_action',
        onUnlocked,
      });
      expect(started).toBe(true);
      await flushMicrotasks();
    });

    expect(adTestState.showRewardedStub).toHaveBeenCalledTimes(1);
    expect(onUnlocked).toHaveBeenCalledTimes(1);
    expect(rewardedAdState.load).not.toHaveBeenCalled();
    expect(rewardedAdState.show).not.toHaveBeenCalled();
    expect(latestValue?.rewardedExportFormat).toBeNull();
    expect(trackEventMock).toHaveBeenCalledWith(
      'rewarded_export_unlocked',
      expect.objectContaining({ format: 'pdf', source: 'tab_action', stub: true }),
    );
  });

  it('shows a loaded rewarded ad, clears the timeout once opened, and unlocks on close', async () => {
    const onUnlocked = vi.fn(async () => {});

    await renderHook(false);
    rewardedAdState.load.mockClear();

    await act(async () => {
      const started = await latestValue?.requestRewardedExport({
        format: 'xlsx',
        source: 'tab_action',
        onUnlocked,
      });
      expect(started).toBe(true);
      await flushMicrotasks();
    });

    expect(rewardedAdState.load).toHaveBeenCalled();

    rewardedAdState.isLoaded = true;
    await rerenderHook(false);
    expect(rewardedAdState.show).toHaveBeenCalledTimes(1);

    rewardedAdState.isOpened = true;
    await rerenderHook(false);

    await act(async () => {
      vi.advanceTimersByTime(REWARDED_EXPORT_TIMEOUT_MS + 1);
      await flushMicrotasks();
    });

    expect(alertMock).not.toHaveBeenCalled();

    rewardedAdState.isEarnedReward = true;
    await rerenderHook(false);

    rewardedAdState.isClosed = true;
    await rerenderHook(false);

    expect(onUnlocked).toHaveBeenCalledTimes(1);
    expect(latestValue?.rewardedExportFormat).toBeNull();
    expect(trackEventMock).toHaveBeenCalledWith(
      'rewarded_export_ad_opened',
      expect.objectContaining({ format: 'xlsx', source: 'tab_action' }),
    );
    expect(trackEventMock).toHaveBeenCalledWith(
      'rewarded_export_ad_reward_earned',
      expect.objectContaining({ format: 'xlsx', source: 'tab_action' }),
    );
    expect(trackEventMock).toHaveBeenCalledWith(
      'rewarded_export_unlocked',
      expect.objectContaining({ format: 'xlsx', source: 'tab_action' }),
    );
    expect(rewardedAdState.load).toHaveBeenCalled();
  });

  it('fails a pending rewarded export after the timeout and resets the request state', async () => {
    const onUnlocked = vi.fn(async () => {});

    await renderHook(false);
    rewardedAdState.load.mockClear();

    await act(async () => {
      const started = await latestValue?.requestRewardedExport({
        format: 'csv',
        source: 'tab_action',
        onUnlocked,
      });
      expect(started).toBe(true);
      await flushMicrotasks();
    });

    await act(async () => {
      vi.advanceTimersByTime(REWARDED_EXPORT_TIMEOUT_MS);
      await flushMicrotasks();
    });

    expect(onUnlocked).not.toHaveBeenCalled();
    expect(alertMock).toHaveBeenCalledWith(
      'Anúncio indisponível',
      'Não foi possível carregar o anúncio agora. Tente novamente em instantes ou assine o Premium.',
    );
    expect(trackEventMock).toHaveBeenCalledWith(
      'rewarded_export_ad_failed',
      expect.objectContaining({
        format: 'csv',
        source: 'tab_action',
        error_message: 'timeout',
      }),
    );
    expect(latestValue?.rewardedExportFormat).toBeNull();
    expect(rewardedAdState.load).toHaveBeenCalled();
  });
});
