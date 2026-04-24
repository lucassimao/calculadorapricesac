import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../lib/theme';

type RewardedStubResult = 'earned' | 'cancelled' | 'error';
type StubAdResult = RewardedStubResult | 'closed';

type PendingStubAd =
  | {
      kind: 'rewarded';
      resolve: (result: RewardedStubResult) => void;
    }
  | {
      kind: 'interstitial' | 'appOpen';
      resolve: (result: 'closed') => void;
    };

interface AdTestConfig {
  stubModeEnabled: boolean;
  interstitialStubEnabled: boolean;
  appOpenStubEnabled: boolean;
}

export interface AdTestContextValue extends AdTestConfig {
  loading: boolean;
  setStubModeEnabled: (value: boolean) => Promise<void>;
  setInterstitialStubEnabled: (value: boolean) => Promise<void>;
  setAppOpenStubEnabled: (value: boolean) => Promise<void>;
  resetAdTestConfig: () => Promise<void>;
  showRewardedStub: () => Promise<RewardedStubResult | false>;
  showInterstitialStub: () => Promise<boolean>;
  showAppOpenStub: () => Promise<boolean>;
}

const STORAGE_KEY = 'dev:ad-test-config:v1';

const DEFAULT_CONFIG: AdTestConfig = {
  stubModeEnabled: false,
  interstitialStubEnabled: false,
  appOpenStubEnabled: false,
};

const AdTestContext = createContext<AdTestContextValue | null>(null);

function StubAdOverlay({
  pendingAd,
  closePendingAd,
}: {
  pendingAd: PendingStubAd | null;
  closePendingAd: (result: StubAdResult) => void;
}) {
  const { colors } = useTheme();

  if (!pendingAd) return null;

  const isRewarded = pendingAd.kind === 'rewarded';
  const title =
    pendingAd.kind === 'rewarded'
      ? 'Anúncio Rewarded de Teste'
      : pendingAd.kind === 'interstitial'
        ? 'Interstitial de Teste'
        : 'App Open de Teste';
  const description = isRewarded
    ? 'Escolha o desfecho do anúncio para validar o fluxo da exportação.'
    : 'Feche o anúncio de teste para voltar ao app.';

  return (
    <Modal animationType="fade" transparent visible onRequestClose={() => {}}>
      <View style={styles.backdrop} testID="stub-ad-overlay">
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.background,
              borderColor: colors.border,
            },
          ]}
          testID={`stub-ad-card-${pendingAd.kind}`}
        >
          <Text style={[styles.title, { color: colors.text }]} testID="stub-ad-title">
            {title}
          </Text>
          <Text
            style={[styles.description, { color: colors.textSecondary }]}
            testID="stub-ad-description"
          >
            {description}
          </Text>

          {isRewarded ? (
            <View style={styles.actions} testID="stub-ad-actions">
              <Pressable
                style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                onPress={() => closePendingAd('earned')}
                accessibilityRole="button"
                accessibilityLabel="Concluir anúncio"
                testID="stub-ad-rewarded-complete"
              >
                <Text style={styles.primaryButtonText}>Concluir anúncio</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.secondaryButton,
                  { borderColor: colors.border, backgroundColor: colors.backgroundSecondary },
                ]}
                onPress={() => closePendingAd('cancelled')}
                accessibilityRole="button"
                accessibilityLabel="Cancelar anúncio"
                testID="stub-ad-rewarded-cancel"
              >
                <Text style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>
                  Cancelar anúncio
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.secondaryButton,
                  { borderColor: colors.border, backgroundColor: colors.backgroundSecondary },
                ]}
                onPress={() => closePendingAd('error')}
                accessibilityRole="button"
                accessibilityLabel="Falhar anúncio"
                testID="stub-ad-rewarded-error"
              >
                <Text style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>
                  Falhar anúncio
                </Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={[styles.primaryButton, { backgroundColor: colors.primary }]}
              onPress={() => closePendingAd('closed')}
              accessibilityRole="button"
              accessibilityLabel="Fechar anúncio"
              testID="stub-ad-close-button"
            >
              <Text style={styles.primaryButtonText}>Fechar anúncio</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

export function AdTestProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AdTestConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [pendingAd, setPendingAd] = useState<PendingStubAd | null>(null);
  const configRef = useRef(DEFAULT_CONFIG);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (!value) return;
        const parsed = JSON.parse(value) as Partial<AdTestConfig>;
        const nextConfig = {
          stubModeEnabled: parsed.stubModeEnabled === true,
          interstitialStubEnabled: parsed.interstitialStubEnabled === true,
          appOpenStubEnabled: parsed.appOpenStubEnabled === true,
        };
        configRef.current = nextConfig;
        setConfig(nextConfig);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const persistConfig = useCallback(
    async (updateConfig: (current: AdTestConfig) => AdTestConfig) => {
      const nextConfig = updateConfig(configRef.current);
      configRef.current = nextConfig;
      setConfig(nextConfig);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextConfig));
    },
    [],
  );

  const setStubModeEnabled = useCallback(
    async (value: boolean) => {
      await persistConfig((current) => ({
        ...current,
        stubModeEnabled: value,
      }));
    },
    [persistConfig],
  );

  const setInterstitialStubEnabled = useCallback(
    async (value: boolean) => {
      await persistConfig((current) => ({
        ...current,
        interstitialStubEnabled: value,
      }));
    },
    [persistConfig],
  );

  const setAppOpenStubEnabled = useCallback(
    async (value: boolean) => {
      await persistConfig((current) => ({
        ...current,
        appOpenStubEnabled: value,
      }));
    },
    [persistConfig],
  );

  const resetAdTestConfig = useCallback(async () => {
    configRef.current = DEFAULT_CONFIG;
    setConfig(DEFAULT_CONFIG);
    await AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  const closePendingAd = useCallback((result: StubAdResult) => {
    setPendingAd((current) => {
      if (!current) return current;
      if (current.kind === 'rewarded') {
        if (result === 'closed') return current;
        current.resolve(result);
        return null;
      }

      if (result !== 'closed') return current;
      current.resolve('closed');
      return null;
    });
  }, []);

  const showRewardedStub = useCallback(async () => {
    if (!config.stubModeEnabled || pendingAd) return false;
    return new Promise<RewardedStubResult>((resolve) => {
      setPendingAd({
        kind: 'rewarded',
        resolve,
      });
    });
  }, [config.stubModeEnabled, pendingAd]);

  const showInterstitialStub = useCallback(async () => {
    if (!config.stubModeEnabled || !config.interstitialStubEnabled || pendingAd) return false;
    await new Promise<'closed'>((resolve) => {
      setPendingAd({
        kind: 'interstitial',
        resolve,
      });
    });
    return true;
  }, [config.stubModeEnabled, config.interstitialStubEnabled, pendingAd]);

  const showAppOpenStub = useCallback(async () => {
    if (!config.stubModeEnabled || !config.appOpenStubEnabled || pendingAd) return false;
    await new Promise<'closed'>((resolve) => {
      setPendingAd({
        kind: 'appOpen',
        resolve,
      });
    });
    return true;
  }, [config.stubModeEnabled, config.appOpenStubEnabled, pendingAd]);

  const value = useMemo<AdTestContextValue>(
    () => ({
      ...config,
      loading,
      setStubModeEnabled,
      setInterstitialStubEnabled,
      setAppOpenStubEnabled,
      resetAdTestConfig,
      showRewardedStub,
      showInterstitialStub,
      showAppOpenStub,
    }),
    [
      config,
      loading,
      resetAdTestConfig,
      setAppOpenStubEnabled,
      setInterstitialStubEnabled,
      setStubModeEnabled,
      showAppOpenStub,
      showInterstitialStub,
      showRewardedStub,
    ],
  );

  return (
    <AdTestContext.Provider value={value}>
      {children}
      <StubAdOverlay pendingAd={pendingAd} closePendingAd={closePendingAd} />
    </AdTestContext.Provider>
  );
}

export function useAdTest() {
  const context = useContext(AdTestContext);
  if (!context) {
    throw new Error('useAdTest must be used within an AdTestProvider');
  }
  return context;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
    gap: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    gap: 10,
  },
  primaryButton: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
