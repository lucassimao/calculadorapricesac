import { describe, expect, it } from 'vitest';
import {
  canUseRewardedExportPlacement,
  classifyRewardedFailure,
  createDismissSafeExportAlertOptions,
  isAnyExportFlowBusy,
  isTabActionExportBusy,
  REWARDED_EXPORT_TIMEOUT_MS,
  shouldLoadPendingRewardedRequest,
  shouldResetTabActionExportPhase,
  shouldStartRewardedTimeout,
} from '../rewarded-export-state';

describe('rewarded export state helpers', () => {
  it('prevents Android export prompts from being dismissed without settling the click lock', () => {
    const onDismiss = () => {};

    expect(createDismissSafeExportAlertOptions(onDismiss)).toEqual({
      cancelable: false,
      onDismiss,
    });
  });

  it('normalizes namespaced native codes while preserving the exact SDK code', () => {
    expect(
      classifyRewardedFailure(
        Object.assign(new Error('No inventory'), {
          code: 'googleMobileAds/error-code-no-fill',
        }),
      ),
    ).toEqual({
      errorKind: 'no_fill',
      errorCode: 'googleMobileAds/error-code-no-fill',
    });
    expect(
      classifyRewardedFailure(
        Object.assign(new Error('Timed out'), { code: 'googleMobileAds/timeout' }),
      ),
    ).toEqual({ errorKind: 'load_timeout', errorCode: 'googleMobileAds/timeout' });
    expect(classifyRewardedFailure(new Error('Network unavailable'))).toEqual({
      errorKind: 'network',
    });
  });

  it('allows rewarded export in stub mode even without a configured unit id', () => {
    expect(
      canUseRewardedExportPlacement({
        enabled: false,
        adTestLoading: false,
        isPremium: false,
        stubModeEnabled: true,
        rewardedUnitId: null,
      }),
    ).toBe(true);
  });

  it('requires a real unit id for live rewarded export', () => {
    expect(
      canUseRewardedExportPlacement({
        enabled: true,
        adTestLoading: false,
        isPremium: false,
        stubModeEnabled: false,
        rewardedUnitId: null,
      }),
    ).toBe(false);

    expect(
      canUseRewardedExportPlacement({
        enabled: true,
        adTestLoading: false,
        isPremium: false,
        stubModeEnabled: false,
        rewardedUnitId: 'ca-app-pub-111/222',
      }),
    ).toBe(true);
  });

  it('blocks rewarded export while loading ad test config or for premium users', () => {
    expect(
      canUseRewardedExportPlacement({
        enabled: true,
        adTestLoading: true,
        isPremium: false,
        stubModeEnabled: false,
        rewardedUnitId: 'ca-app-pub-111/222',
      }),
    ).toBe(false);

    expect(
      canUseRewardedExportPlacement({
        enabled: true,
        adTestLoading: false,
        isPremium: true,
        stubModeEnabled: false,
        rewardedUnitId: 'ca-app-pub-111/222',
      }),
    ).toBe(false);
  });

  it('only loads a pending rewarded request when a real ad is still needed', () => {
    expect(
      shouldLoadPendingRewardedRequest({
        pendingFormat: 'pdf',
        canUseRealRewarded: true,
        isLoaded: false,
        isOpened: false,
      }),
    ).toBe(true);

    expect(
      shouldLoadPendingRewardedRequest({
        pendingFormat: 'pdf',
        canUseRealRewarded: true,
        isLoaded: true,
        isOpened: false,
      }),
    ).toBe(false);

    expect(
      shouldLoadPendingRewardedRequest({
        pendingFormat: null,
        canUseRealRewarded: true,
        isLoaded: false,
        isOpened: false,
      }),
    ).toBe(false);
  });

  it('starts the rewarded timeout only while a real ad is pending and not yet opened', () => {
    expect(
      shouldStartRewardedTimeout({
        pendingFormat: 'xlsx',
        canUseRealRewarded: true,
        isOpened: false,
      }),
    ).toBe(true);

    expect(
      shouldStartRewardedTimeout({
        pendingFormat: 'xlsx',
        canUseRealRewarded: true,
        isOpened: true,
      }),
    ).toBe(false);

    expect(REWARDED_EXPORT_TIMEOUT_MS).toBe(15_000);
  });

  it('tracks tab export busy/reset phases deterministically', () => {
    expect(isTabActionExportBusy('idle')).toBe(false);
    expect(isTabActionExportBusy('rewarded')).toBe(true);
    expect(isTabActionExportBusy('exporting')).toBe(true);

    expect(
      shouldResetTabActionExportPhase({
        phase: 'rewarded',
        rewardedExportFormat: null,
        exporting: false,
      }),
    ).toBe(true);

    expect(
      shouldResetTabActionExportPhase({
        phase: 'exporting',
        rewardedExportFormat: null,
        exporting: false,
      }),
    ).toBe(false);
  });

  it('keeps the global export interaction busy for rewarded flows started outside the tab', () => {
    expect(
      isAnyExportFlowBusy({
        tabActionPhase: 'idle',
        rewardedExportFormat: 'pdf',
        exporting: false,
      }),
    ).toBe(true);
    expect(
      isAnyExportFlowBusy({
        tabActionPhase: 'idle',
        rewardedExportFormat: null,
        exporting: true,
      }),
    ).toBe(true);
    expect(
      isAnyExportFlowBusy({
        tabActionPhase: 'idle',
        rewardedExportFormat: null,
        exporting: false,
      }),
    ).toBe(false);
  });
});
