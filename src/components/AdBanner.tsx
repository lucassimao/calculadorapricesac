import { StyleSheet, View } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';

interface AdBannerProps {
  enabled: boolean;
  adUnitId?: string;
}

export function AdBanner({ enabled, adUnitId }: AdBannerProps) {
  if (!enabled) return null;

  return (
    <View style={styles.container}>
      <BannerAd unitId={adUnitId ?? 'ca-app-pub-3940256099942544/6300978111'} size={BannerAdSize.BANNER} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 8,
  },
});
