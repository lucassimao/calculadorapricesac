import { Platform, StyleSheet, View } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import Constants from 'expo-constants';

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
  const resolvedUnitId = adUnitId ?? envUnitId ?? fallbackUnitId;

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
