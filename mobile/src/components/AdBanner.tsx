import { Platform, StyleSheet, View } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import Constants from 'expo-constants';
import { Sentry, sentryInitialized } from '../lib/sentry';

let hasLoggedAdConfig = false;

function normalizeAdUnitId(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.toLowerCase() === 'untitled') return null;
  if (!trimmed.startsWith('ca-app-pub-')) return null;
  return trimmed;
}

interface AdBannerProps {
  enabled: boolean;
  adUnitId?: string;
}

export function AdBanner({ enabled, adUnitId }: AdBannerProps) {
  const extra = Constants.expoConfig?.extra ?? {};
  if (!enabled || extra.adsDisabled) return null;

  const fallbackUnitId =
    Platform.OS === 'ios'
      ? 'ca-app-pub-3940256099942544/2934735716'
      : 'ca-app-pub-3940256099942544/6300978111';
  const envUnitId =
    Platform.OS === 'ios' ? extra.admobBannerUnitIdIos : extra.admobBannerUnitIdAndroid;
  const resolvedUnitId =
    normalizeAdUnitId(adUnitId) ?? normalizeAdUnitId(envUnitId) ?? fallbackUnitId;

  if (!hasLoggedAdConfig && sentryInitialized && !__DEV__) {
    hasLoggedAdConfig = true;
    const envUnitIdPresent = typeof envUnitId === 'string' && envUnitId.trim().length > 0;
    const overridePresent = typeof adUnitId === 'string' && adUnitId.trim().length > 0;
    Sentry.captureMessage('AdMob banner config', {
      level: 'info',
      extra: {
        platform: Platform.OS,
        adsDisabled: Boolean(extra.adsDisabled),
        enabled,
        appIdFromExtra: Platform.OS === 'ios' ? extra.admobAppIdIos : extra.admobAppIdAndroid,
        envUnitIdPresent,
        envUnitId,
        overridePresent,
        overrideUnitId: adUnitId,
        resolvedUnitId,
        usingFallback: resolvedUnitId === fallbackUnitId,
      },
    });
  }

  return (
    <View style={styles.container}>
      <BannerAd unitId={resolvedUnitId} size={BannerAdSize.BANNER} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 8,
  },
});
