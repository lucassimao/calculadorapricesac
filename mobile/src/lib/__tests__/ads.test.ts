import { afterEach, describe, expect, it } from 'vitest';
import {
  getAppOpenCooldownMs,
  getInterstitialCooldownMs,
  canOfferRewardedExport,
  isAppOpenEnabled,
  isInterstitialEnabled,
  normalizeAdUnitId,
  resolveAdUnitId,
  shouldAttemptAdPlacement,
} from '../ads';

describe('ads helpers', () => {
  const originalDev = globalThis.__DEV__;

  afterEach(() => {
    globalThis.__DEV__ = originalDev;
  });

  it('normalizes only valid AdMob unit ids', () => {
    expect(normalizeAdUnitId('ca-app-pub-123456789/123456789')).toBe(
      'ca-app-pub-123456789/123456789',
    );
    expect(normalizeAdUnitId(' untitled ')).toBeNull();
    expect(normalizeAdUnitId('')).toBeNull();
    expect(normalizeAdUnitId('abc')).toBeNull();
  });

  it('resolves the platform-specific unit id before falling back to test ids', () => {
    globalThis.__DEV__ = false;
    expect(
      resolveAdUnitId(
        'rewarded',
        {
          admobRewardedUnitIdAndroid: 'ca-app-pub-111/222',
          admobRewardedUnitIdIos: 'ca-app-pub-333/444',
        },
        'android',
      ),
    ).toBe('ca-app-pub-111/222');
  });

  it('uses test ids only in dev when no configured unit id exists', () => {
    globalThis.__DEV__ = true;
    expect(resolveAdUnitId('rewarded', {}, 'android')).toBe(
      'ca-app-pub-3940256099942544/5224354917',
    );
  });

  it('returns null in non-dev builds when no configured unit id exists', () => {
    globalThis.__DEV__ = false;
    expect(resolveAdUnitId('rewarded', {}, 'android')).toBeNull();
  });

  it('offers rewarded export only for non-premium users when ads are enabled', () => {
    expect(canOfferRewardedExport(false, { admobRewardedExportEnabled: true })).toBe(true);
    expect(canOfferRewardedExport(true, { admobRewardedExportEnabled: true })).toBe(false);
    expect(canOfferRewardedExport(false, { adsDisabled: true })).toBe(false);
    expect(canOfferRewardedExport(false, { admobRewardedExportEnabled: false })).toBe(false);
  });

  it('enables app-open by default but allows explicit opt-out', () => {
    expect(isAppOpenEnabled({})).toBe(true);
    expect(isAppOpenEnabled({ admobAppOpenEnabled: true })).toBe(true);
    expect(isAppOpenEnabled({ admobAppOpenEnabled: false })).toBe(false);
    expect(isAppOpenEnabled({ adsDisabled: true })).toBe(false);
  });

  it('uses a 12-hour app-open cooldown by default and respects overrides', () => {
    expect(getAppOpenCooldownMs({})).toBe(720 * 60 * 1000);
    expect(getAppOpenCooldownMs({ admobAppOpenCooldownMinutes: '30' })).toBe(30 * 60 * 1000);
    expect(getAppOpenCooldownMs({ admobAppOpenCooldownMinutes: 0 })).toBe(0);
  });

  it('enables interstitials by default but allows explicit opt-out', () => {
    expect(isInterstitialEnabled({})).toBe(true);
    expect(isInterstitialEnabled({ admobInterstitialEnabled: true })).toBe(true);
    expect(isInterstitialEnabled({ admobInterstitialEnabled: false })).toBe(false);
    expect(isInterstitialEnabled({ adsDisabled: true })).toBe(false);
  });

  it('uses a 20-minute interstitial cooldown by default and respects overrides', () => {
    expect(getInterstitialCooldownMs({})).toBe(20 * 60 * 1000);
    expect(getInterstitialCooldownMs({ admobInterstitialCooldownMinutes: '5' })).toBe(
      5 * 60 * 1000,
    );
    expect(getInterstitialCooldownMs({ admobInterstitialCooldownMinutes: 0 })).toBe(0);
  });

  it('respects cooldown when deciding whether to show an interstitial', () => {
    expect(
      shouldAttemptAdPlacement({
        enabled: true,
        isPremium: false,
        lastShownAt: null,
        now: 1_000,
        cooldownMs: 20_000,
      }),
    ).toBe(true);

    expect(
      shouldAttemptAdPlacement({
        enabled: true,
        isPremium: false,
        lastShownAt: 1_000,
        now: 10_000,
        cooldownMs: 20_000,
      }),
    ).toBe(false);

    expect(
      shouldAttemptAdPlacement({
        enabled: true,
        isPremium: false,
        lastShownAt: 1_000,
        now: 25_000,
        cooldownMs: 20_000,
      }),
    ).toBe(true);

    expect(
      shouldAttemptAdPlacement({
        enabled: true,
        isPremium: true,
        lastShownAt: null,
        now: 1_000,
        cooldownMs: 20_000,
      }),
    ).toBe(false);
  });

  it('respects cooldown when deciding whether to show an app-open ad', () => {
    expect(
      shouldAttemptAdPlacement({
        enabled: true,
        isPremium: false,
        lastShownAt: null,
        now: 1_000,
        cooldownMs: 12 * 60 * 60 * 1000,
      }),
    ).toBe(true);

    expect(
      shouldAttemptAdPlacement({
        enabled: true,
        isPremium: false,
        lastShownAt: 1_000,
        now: 11 * 60 * 60 * 1000,
        cooldownMs: 12 * 60 * 60 * 1000,
      }),
    ).toBe(false);

    expect(
      shouldAttemptAdPlacement({
        enabled: true,
        isPremium: false,
        lastShownAt: 1_000,
        now: 13 * 60 * 60 * 1000,
        cooldownMs: 12 * 60 * 60 * 1000,
      }),
    ).toBe(true);
  });
});
