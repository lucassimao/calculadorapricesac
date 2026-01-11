import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

const dsn = Constants.expoConfig?.extra?.sentryDsn ?? '';
export const sentryInitialized = !__DEV__ && dsn.length > 0;

if (sentryInitialized) {
  Sentry.init({
    dsn,
    enabled: true,
    debug: false,
    environment: 'production',
  });
}

export { Sentry };
