// AdMob Test IDs (used in development)
const ADMOB_TEST_ANDROID = 'ca-app-pub-3940256099942544~3347511713';
const ADMOB_TEST_IOS = 'ca-app-pub-3940256099942544~1458002511';

const ADMOB_APP_IDS = {
  android: {
    production: 'ca-app-pub-8179032047859054~2261283868',
    test: ADMOB_TEST_ANDROID,
  },
  ios: {
    production: 'ca-app-pub-8179032047859054~8976217094',
    test: ADMOB_TEST_IOS,
  },
};

const ADMOB_UNIT_IDS = {
  android: {
    banner: 'ca-app-pub-8179032047859054/3281037280',
    interstitial: 'ca-app-pub-8179032047859054/4596397342',
    rewarded: 'ca-app-pub-8179032047859054/2036623123',
    appOpen: 'ca-app-pub-8179032047859054/6007657721',
  },
  ios: {
    banner: 'ca-app-pub-8179032047859054/9407461937',
    interstitial: 'ca-app-pub-8179032047859054/4694576052',
    rewarded: 'ca-app-pub-8179032047859054/1852790296',
    appOpen: 'ca-app-pub-8179032047859054/3283315676',
  },
};

function getReleaseTarget() {
  if (process.env.EAS_BUILD_PROFILE) return process.env.EAS_BUILD_PROFILE;
  if (process.env.npm_lifecycle_event === 'ota:production') return 'production';
  if (process.env.npm_lifecycle_event === 'ota:preview') return 'preview';
  return 'development';
}

function getAdMobConfig() {
  const isProductionTarget = getReleaseTarget() === 'production';

  return {
    androidAppId: isProductionTarget
      ? ADMOB_APP_IDS.android.production
      : ADMOB_APP_IDS.android.test,
    iosAppId: isProductionTarget ? ADMOB_APP_IDS.ios.production : ADMOB_APP_IDS.ios.test,
    admobBannerUnitIdAndroid: isProductionTarget ? ADMOB_UNIT_IDS.android.banner : '',
    admobBannerUnitIdIos: isProductionTarget ? ADMOB_UNIT_IDS.ios.banner : '',
    admobInterstitialUnitIdAndroid: isProductionTarget ? ADMOB_UNIT_IDS.android.interstitial : '',
    admobInterstitialUnitIdIos: isProductionTarget ? ADMOB_UNIT_IDS.ios.interstitial : '',
    admobRewardedUnitIdAndroid: isProductionTarget ? ADMOB_UNIT_IDS.android.rewarded : '',
    admobRewardedUnitIdIos: isProductionTarget ? ADMOB_UNIT_IDS.ios.rewarded : '',
    admobAppOpenUnitIdAndroid: isProductionTarget ? ADMOB_UNIT_IDS.android.appOpen : '',
    admobAppOpenUnitIdIos: isProductionTarget ? ADMOB_UNIT_IDS.ios.appOpen : '',
    admobAppIdAndroid: isProductionTarget ? ADMOB_APP_IDS.android.production : '',
    admobAppIdIos: isProductionTarget ? ADMOB_APP_IDS.ios.production : '',
  };
}

const adMobConfig = getAdMobConfig();

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
          androidAppId: adMobConfig.androidAppId,
          iosAppId: adMobConfig.iosAppId,
        },
      ],
      'expo-iap',
    ],
    extra: {
      router: {},
      adsDisabled: false,
      posthogApiKey: process.env.POSTHOG_API_KEY ?? '',
      posthogHost: process.env.POSTHOG_HOST ?? 'https://us.i.posthog.com',
      admobBannerUnitIdAndroid: adMobConfig.admobBannerUnitIdAndroid,
      admobBannerUnitIdIos: adMobConfig.admobBannerUnitIdIos,
      admobInterstitialUnitIdAndroid: adMobConfig.admobInterstitialUnitIdAndroid,
      admobInterstitialUnitIdIos: adMobConfig.admobInterstitialUnitIdIos,
      admobRewardedUnitIdAndroid: adMobConfig.admobRewardedUnitIdAndroid,
      admobRewardedUnitIdIos: adMobConfig.admobRewardedUnitIdIos,
      admobAppOpenUnitIdAndroid: adMobConfig.admobAppOpenUnitIdAndroid,
      admobAppOpenUnitIdIos: adMobConfig.admobAppOpenUnitIdIos,
      admobRewardedExportEnabled: process.env.ADMOB_REWARDED_EXPORT_ENABLED ?? 'true',
      admobInterstitialEnabled: process.env.ADMOB_INTERSTITIAL_ENABLED ?? 'true',
      admobAppOpenEnabled: process.env.ADMOB_APP_OPEN_ENABLED ?? 'true',
      admobInterstitialCooldownMinutes: process.env.ADMOB_INTERSTITIAL_COOLDOWN_MINUTES ?? '20',
      admobAppOpenCooldownMinutes: process.env.ADMOB_APP_OPEN_COOLDOWN_MINUTES ?? '720',
      admobAppIdAndroid: adMobConfig.admobAppIdAndroid,
      admobAppIdIos: adMobConfig.admobAppIdIos,
      eas: {
        projectId: '6d83845b-fcdd-4771-9479-8bbf3030c1a6',
      },
    },
  },
};
