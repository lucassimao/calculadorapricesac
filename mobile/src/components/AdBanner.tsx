import { Platform, StyleSheet, Text, View } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import Constants from 'expo-constants';
import { useAdTest } from '../contexts/AdTestContext';
import { Sentry, sentryInitialized } from '../lib/sentry';
import { areAdsDisabled, getAdUnitId } from '../lib/ads';

let hasLoggedAdConfig = false;

interface AdBannerProps {
  enabled: boolean;
  adUnitId?: string;
}

export function AdBanner({ enabled, adUnitId }: AdBannerProps) {
  const { stubModeEnabled } = useAdTest();
  const extra = Constants.expoConfig?.extra ?? {};
  if (!enabled || areAdsDisabled(extra)) return null;

  const resolvedUnitId = getAdUnitId('banner', adUnitId);
  if (!resolvedUnitId) return null;

  if (stubModeEnabled) {
    return (
      <View style={styles.stubContainer} testID="ad-banner-stub-container">
        <View style={styles.stubBanner} testID="ad-banner-stub">
          <View style={styles.stubDot} />
          <View>
            <Text style={styles.stubTitle} testID="ad-banner-stub-title">
              Banner de teste ativo
            </Text>
            <Text style={styles.stubSubtitle}>Stub visual para Maestro e validação local.</Text>
          </View>
        </View>
      </View>
    );
  }

  if (!hasLoggedAdConfig && sentryInitialized && !__DEV__) {
    hasLoggedAdConfig = true;
    const envUnitId =
      Platform.OS === 'ios' ? extra.admobBannerUnitIdIos : extra.admobBannerUnitIdAndroid;
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
        usingFallback: !envUnitIdPresent && !overridePresent,
      },
    });
  }

  return (
    <View style={styles.container}>
      <BannerAd unitId={resolvedUnitId} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: 8,
  },
  stubContainer: {
    width: '100%',
    alignSelf: 'stretch',
    paddingVertical: 8,
  },
  stubBanner: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stubDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: '#2563EB',
  },
  stubTitle: {
    color: '#1D4ED8',
    fontSize: 13,
    fontWeight: '700',
  },
  stubSubtitle: {
    color: '#1E40AF',
    fontSize: 12,
  },
});
