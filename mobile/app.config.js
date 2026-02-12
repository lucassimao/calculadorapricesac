// AdMob Test IDs (used in development)
const ADMOB_TEST_ANDROID = 'ca-app-pub-3940256099942544~3347511713';
const ADMOB_TEST_IOS = 'ca-app-pub-3940256099942544~1458002511';

export default {
  expo: {
    name: 'calculadora-price-sac',
    slug: 'calculadora-price-sac',
    scheme: 'calculadora-price-sac',
    version: '1.0.1',
    platforms: ['ios', 'android'],
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    updates: {
      url: 'https://u.expo.dev/6d83845b-fcdd-4771-9479-8bbf3030c1a6',
    },
    runtimeVersion: {
      policy: 'appVersion',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.lsimaocosta.calculadorapricesac',
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      package: 'com.lsimaocosta.calculadorapricesac',
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [
      '@sentry/react-native/expo',
      'expo-router',
      [
        'react-native-google-mobile-ads',
        {
          // Use environment variables for production, fall back to test IDs
          androidAppId: process.env.ADMOB_ANDROID_APP_ID ?? ADMOB_TEST_ANDROID,
          iosAppId: process.env.ADMOB_IOS_APP_ID ?? ADMOB_TEST_IOS,
        },
      ],
      'expo-iap',
    ],
    extra: {
      router: {},
      adsDisabled: false,
      posthogApiKey: process.env.POSTHOG_API_KEY ?? '',
      posthogHost: process.env.POSTHOG_HOST ?? 'https://us.i.posthog.com',
      admobBannerUnitIdAndroid: process.env.ADMOB_BANNER_UNIT_ID_ANDROID ?? '',
      admobBannerUnitIdIos: process.env.ADMOB_BANNER_UNIT_ID_IOS ?? '',
      admobAppIdAndroid: process.env.ADMOB_ANDROID_APP_ID ?? '',
      admobAppIdIos: process.env.ADMOB_IOS_APP_ID ?? '',
      eas: {
        projectId: '6d83845b-fcdd-4771-9479-8bbf3030c1a6',
      },
    },
  },
};
