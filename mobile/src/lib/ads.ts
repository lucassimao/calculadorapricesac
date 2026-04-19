export type AdPlacement = 'banner' | 'interstitial' | 'rewarded' | 'appOpen';

type SupportedPlatform = 'ios' | 'android';
type ExtraConfig = Record<string, unknown>;

const UNIT_ID_KEYS: Record<SupportedPlatform, Record<AdPlacement, string>> = {
  ios: {
    banner: 'admobBannerUnitIdIos',
    interstitial: 'admobInterstitialUnitIdIos',
    rewarded: 'admobRewardedUnitIdIos',
    appOpen: 'admobAppOpenUnitIdIos',
  },
  android: {
    banner: 'admobBannerUnitIdAndroid',
    interstitial: 'admobInterstitialUnitIdAndroid',
    rewarded: 'admobRewardedUnitIdAndroid',
    appOpen: 'admobAppOpenUnitIdAndroid',
  },
};

export function normalizeAdUnitId(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.toLowerCase() === 'untitled') return null;
  if (!trimmed.startsWith('ca-app-pub-')) return null;
  return trimmed;
}

function normalizeBooleanFlag(value: unknown, fallback: boolean) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase();
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
  }
  return fallback;
}

function normalizeNumber(value: unknown, fallback: number) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function resolveAdUnitId(
  placement: AdPlacement,
  extra: ExtraConfig,
  platform: SupportedPlatform = getPlatform(),
  overrideUnitId?: string,
) {
  const extraUnitId = extra[UNIT_ID_KEYS[platform][placement]];
  const configuredUnitId = normalizeAdUnitId(overrideUnitId) ?? normalizeAdUnitId(extraUnitId);

  if (configuredUnitId) return configuredUnitId;
  if (!shouldUseTestAdUnitIds()) return null;

  return normalizeAdUnitId(getTestUnitId(placement));
}

function getExtra() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Constants = require('expo-constants').default as typeof import('expo-constants').default;
  return (Constants.expoConfig?.extra ?? {}) as ExtraConfig;
}

function getPlatform(): SupportedPlatform {
  // Lazily load react-native so pure unit tests can import this module without parsing RN's Flow entrypoint.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Platform } = require('react-native') as typeof import('react-native');
  return Platform.OS === 'ios' ? 'ios' : 'android';
}

function getTestUnitId(placement: AdPlacement) {
  const fallbackUnitIds: Record<AdPlacement, string> = {
    banner: 'ca-app-pub-3940256099942544/9214589741',
    interstitial: 'ca-app-pub-3940256099942544/1033173712',
    rewarded: 'ca-app-pub-3940256099942544/5224354917',
    appOpen: 'ca-app-pub-3940256099942544/9257395921',
  };

  try {
    const { TestIds } =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('react-native-google-mobile-ads') as typeof import('react-native-google-mobile-ads');
    const testUnitIds: Record<AdPlacement, string> = {
      banner: TestIds.ADAPTIVE_BANNER,
      interstitial: TestIds.INTERSTITIAL,
      rewarded: TestIds.REWARDED,
      appOpen: TestIds.APP_OPEN,
    };
    return testUnitIds[placement];
  } catch {
    return fallbackUnitIds[placement];
  }
}

function shouldUseTestAdUnitIds() {
  return globalThis.__DEV__ === true;
}

export function getAdUnitId(placement: AdPlacement, overrideUnitId?: string) {
  return resolveAdUnitId(placement, getExtra(), undefined, overrideUnitId);
}

export function areAdsDisabled(extra: ExtraConfig = getExtra()) {
  return normalizeBooleanFlag(extra.adsDisabled, false);
}

export function isRewardedExportEnabled(extra: ExtraConfig = getExtra()) {
  return !areAdsDisabled(extra) && normalizeBooleanFlag(extra.admobRewardedExportEnabled, true);
}

export function isInterstitialEnabled(extra: ExtraConfig = getExtra()) {
  return !areAdsDisabled(extra) && normalizeBooleanFlag(extra.admobInterstitialEnabled, true);
}

export function isAppOpenEnabled(extra: ExtraConfig = getExtra()) {
  return !areAdsDisabled(extra) && normalizeBooleanFlag(extra.admobAppOpenEnabled, true);
}

export function getInterstitialCooldownMs(extra: ExtraConfig = getExtra()) {
  const minutes = normalizeNumber(extra.admobInterstitialCooldownMinutes, 20);
  return Math.max(minutes, 0) * 60 * 1000;
}

export function getAppOpenCooldownMs(extra: ExtraConfig = getExtra()) {
  const minutes = normalizeNumber(extra.admobAppOpenCooldownMinutes, 720);
  return Math.max(minutes, 0) * 60 * 1000;
}

export function canOfferRewardedExport(isPremium: boolean, extra: ExtraConfig = getExtra()) {
  return !isPremium && isRewardedExportEnabled(extra);
}

export function shouldAttemptAdPlacement({
  enabled,
  isPremium,
  lastShownAt,
  now,
  cooldownMs,
}: {
  enabled: boolean;
  isPremium: boolean;
  lastShownAt: number | null;
  now: number;
  cooldownMs: number;
}) {
  if (!enabled || isPremium) return false;
  if (lastShownAt === null) return true;
  return now - lastShownAt >= cooldownMs;
}
