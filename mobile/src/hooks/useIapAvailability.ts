import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import Constants, { ExecutionEnvironment } from 'expo-constants';

type IapAvailability = 'checking' | 'supported' | 'unsupported';

export function useIapAvailability() {
  const [state, setState] = useState<IapAvailability>('checking');

  useEffect(() => {
    const check = async () => {
      if (Platform.OS === 'web') {
        setState('unsupported');
        return;
      }

      if (__DEV__ && Platform.OS === 'android') {
        setState('unsupported');
        return;
      }

      if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
        setState('unsupported');
        return;
      }

      if (Platform.OS === 'android') {
        const appOwnership = Constants.appOwnership ?? null;
        if (appOwnership === 'expo') {
          setState('unsupported');
          return;
        }
        const hasPlayStore = await Linking.canOpenURL('market://details?id=com.android.vending');
        if (!hasPlayStore) {
          setState('unsupported');
          return;
        }
      }

      setState('supported');
    };

    check().catch(() => setState('unsupported'));
  }, []);

  return state;
}
