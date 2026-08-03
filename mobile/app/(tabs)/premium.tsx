import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { useAdTest } from '../../src/contexts/AdTestContext';
import { useTheme } from '../../src/lib/theme';
import { IAP_FALLBACK_PRICE } from '../../src/lib/iap';
import { usePremiumContext } from '../../src/contexts/PremiumContext';
import { useIapAvailability } from '../../src/hooks/useIapAvailability';
import { AdBanner } from '../../src/components/AdBanner';
import { BrandProfileCard } from '../../src/components/premium/BrandProfileCard';
import { PremiumOfferCard } from '../../src/components/premium/premium-offer-card';
import {
  consumePendingPaywallSource,
  getPaywallViewContext,
  trackEvent,
  trackScreen,
} from '../../src/lib/analytics';
import { useIapPurchase } from '../../src/hooks/useIapPurchase';
import { useStoreReview } from '../../src/hooks/useStoreReview';
import { shouldShowAds } from '../../src/lib/premium';
import { resetAdMonetizationTimestamps } from '../../src/lib/storage/ad-monetization';
import { saveScenarios } from '../../src/lib/storage/scenarios';
import {
  PREMIUM_BENEFITS,
  PREMIUM_ONE_TIME_MESSAGE,
  getPremiumSocialProof,
} from '../../src/lib/premium-offer';
import { INVESTMENT_RATE_PRESETS } from '../../src/lib/amortize-or-invest';
import { seedInvestmentReferenceRateChangeForDev } from '../../src/lib/investment-rate-change';

interface BenefitItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  color?: string;
}

interface PremiumStatusCardProps {
  title: string;
  description: string;
}

function BenefitItem({ icon, title, description, color = '#2563EB' }: BenefitItemProps) {
  return (
    <View style={benefitStyles.item}>
      <View style={[benefitStyles.iconWrapper, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View style={benefitStyles.textWrapper}>
        <Text style={benefitStyles.title}>{title}</Text>
        <Text style={benefitStyles.description}>{description}</Text>
      </View>
    </View>
  );
}

function PremiumStatusCard({ title, description }: PremiumStatusCardProps) {
  return (
    <View style={[styles.card, styles.premiumStatusCard]} testID="premium-status-card">
      <View style={styles.premiumStatusHeader}>
        <View style={styles.premiumStatusIcon}>
          <Ionicons name="checkmark-circle" size={22} color="#047857" />
        </View>
        <View style={styles.premiumStatusText}>
          <Text style={styles.premiumStatusTitle} testID="premium-status-title">
            {title}
          </Text>
          <Text style={styles.premiumStatusDescription}>{description}</Text>
        </View>
      </View>
      <View style={styles.premiumStatusPills}>
        <View style={styles.premiumStatusPill}>
          <Ionicons name="ban-outline" size={14} color="#047857" />
          <Text style={styles.premiumStatusPillText}>Sem anúncios</Text>
        </View>
        <View style={styles.premiumStatusPill}>
          <Ionicons name="share-outline" size={14} color="#047857" />
          <Text style={styles.premiumStatusPillText}>Exportações completas</Text>
        </View>
        <View style={styles.premiumStatusPill}>
          <Ionicons name="logo-whatsapp" size={14} color="#047857" />
          <Text style={styles.premiumStatusPillText}>Suporte prioritário</Text>
        </View>
      </View>
    </View>
  );
}

interface PremiumDiagnosticsCardProps {
  isPremium: boolean;
  loading: boolean;
  iapAvailability: string;
  purchasedProductIds: string[];
  premiumPurchaseDetails: Record<string, string> | null;
  refreshAttemptedAt: string | null;
  refreshCompletedAt: string | null;
  refreshError: string | null;
  onRefresh: () => Promise<void>;
}

function PremiumDiagnosticsCard({
  isPremium,
  loading,
  iapAvailability,
  purchasedProductIds,
  premiumPurchaseDetails,
  refreshAttemptedAt,
  refreshCompletedAt,
  refreshError,
  onRefresh,
}: PremiumDiagnosticsCardProps) {
  const [copied, setCopied] = useState(false);

  const diagnosticsText = useMemo(
    () =>
      [
        `appVersion=${Constants.expoConfig?.version ?? 'unknown'}`,
        `executionEnvironment=${String(Constants.executionEnvironment ?? 'unknown')}`,
        `appOwnership=${String(Constants.appOwnership ?? 'unknown')}`,
        `iapAvailability=${iapAvailability}`,
        `isPremium=${String(isPremium)}`,
        `loading=${String(loading)}`,
        `purchasedProductIds=${purchasedProductIds.join(',') || '(none)'}`,
        `premiumPurchaseDetails=${
          premiumPurchaseDetails
            ? Object.entries(premiumPurchaseDetails)
                .map(([key, value]) => `${key}:${value}`)
                .join('; ')
            : '(none)'
        }`,
        `refreshAttemptedAt=${refreshAttemptedAt ?? '(none)'}`,
        `refreshCompletedAt=${refreshCompletedAt ?? '(none)'}`,
        `refreshError=${refreshError ?? '(none)'}`,
      ].join('\n'),
    [
      iapAvailability,
      isPremium,
      loading,
      purchasedProductIds,
      premiumPurchaseDetails,
      refreshAttemptedAt,
      refreshCompletedAt,
      refreshError,
    ],
  );

  useEffect(() => {
    if (!copied) return;
    const timeout = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timeout);
  }, [copied]);

  return (
    <View style={styles.diagnosticsCard} testID="premium-diagnostics-card">
      <Text style={styles.diagnosticsTitle}>Diagnóstico temporário de premium</Text>
      <Text style={styles.diagnosticsHint}>
        Use isto para verificar o que o app recebeu da App Store no startup.
      </Text>
      <Text selectable style={styles.diagnosticsText} testID="premium-diagnostics-text">
        {diagnosticsText}
      </Text>
      <View style={styles.devRow}>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => {
            void onRefresh();
          }}
          accessibilityRole="button"
          accessibilityLabel="Atualizar diagnóstico premium"
        >
          <Text style={styles.secondaryButtonText}>Atualizar diagnóstico</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => {
            void Clipboard.setStringAsync(diagnosticsText);
            setCopied(true);
          }}
          accessibilityRole="button"
          accessibilityLabel="Copiar diagnóstico premium"
        >
          <Text style={styles.secondaryButtonText}>
            {copied ? 'Diagnóstico copiado' : 'Copiar diagnóstico'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function DevAdControls() {
  const { markPremium } = usePremiumContext();
  const { forceReviewPromptForDev } = useStoreReview();
  const {
    stubModeEnabled,
    interstitialStubEnabled,
    appOpenStubEnabled,
    setStubModeEnabled,
    setInterstitialStubEnabled,
    setAppOpenStubEnabled,
    resetAdTestConfig,
  } = useAdTest();

  if (!__DEV__) return null;

  const prepareFreeRewarded = async () => {
    await resetAdMonetizationTimestamps();
    await markPremium(false);
    await setStubModeEnabled(true);
    await setInterstitialStubEnabled(false);
    await setAppOpenStubEnabled(false);
  };

  const preparePremiumMode = async () => {
    await resetAdMonetizationTimestamps();
    await markPremium(true);
    await setStubModeEnabled(false);
    await setInterstitialStubEnabled(false);
    await setAppOpenStubEnabled(false);
  };

  const enableAllAdStubs = async () => {
    await setStubModeEnabled(true);
    await setInterstitialStubEnabled(true);
    await setAppOpenStubEnabled(true);
  };

  const resetSavedScenarios = async () => {
    await saveScenarios([]);
  };

  return (
    <View style={styles.devToolsCard}>
      <Text style={styles.devToolsTitle}>Anúncios stub (dev)</Text>
      <Text style={styles.devToolsStatus} testID="dev-ads-status">
        Stub: {stubModeEnabled ? 'ativo' : 'inativo'} | Interstitial:{' '}
        {interstitialStubEnabled ? 'ativo' : 'inativo'} | App open:{' '}
        {appOpenStubEnabled ? 'ativo' : 'inativo'}
      </Text>
      <View style={styles.devRow}>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => {
            void prepareFreeRewarded();
          }}
          testID="btn-dev-prepare-free-rewarded"
          accessibilityRole="button"
          accessibilityLabel="Preparar exportação grátis (dev)"
        >
          <Text style={styles.secondaryButtonText}>Preparar exportação grátis (dev)</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => {
            void preparePremiumMode();
          }}
          testID="btn-dev-prepare-premium"
          accessibilityRole="button"
          accessibilityLabel="Preparar premium (dev)"
        >
          <Text style={styles.secondaryButtonText}>Preparar premium (dev)</Text>
        </Pressable>
      </View>
      <Pressable
        style={styles.secondaryButton}
        onPress={() => {
          void enableAllAdStubs();
        }}
        testID="btn-dev-enable-all-ad-stubs"
        accessibilityRole="button"
        accessibilityLabel="Ativar todos os stubs de anúncio (dev)"
      >
        <Text style={styles.secondaryButtonText}>Ativar todos os stubs de anúncio (dev)</Text>
      </Pressable>
      <View style={styles.devRow}>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => {
            void setStubModeEnabled(true);
          }}
          testID="btn-dev-enable-ads-stub"
          accessibilityRole="button"
          accessibilityLabel="Ativar ads stub (dev)"
        >
          <Text style={styles.secondaryButtonText}>Ativar ads stub (dev)</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => {
            void setStubModeEnabled(false);
          }}
          testID="btn-dev-disable-ads-stub"
          accessibilityRole="button"
          accessibilityLabel="Desativar ads stub (dev)"
        >
          <Text style={styles.secondaryButtonText}>Desativar ads stub (dev)</Text>
        </Pressable>
      </View>
      <View style={styles.devRow}>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => {
            void setInterstitialStubEnabled(true);
          }}
          testID="btn-dev-enable-interstitial-stub"
          accessibilityRole="button"
          accessibilityLabel="Ativar interstitial stub (dev)"
        >
          <Text style={styles.secondaryButtonText}>Ativar interstitial stub (dev)</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => {
            void setInterstitialStubEnabled(false);
          }}
          testID="btn-dev-disable-interstitial-stub"
          accessibilityRole="button"
          accessibilityLabel="Desativar interstitial stub (dev)"
        >
          <Text style={styles.secondaryButtonText}>Desativar interstitial stub (dev)</Text>
        </Pressable>
      </View>
      <View style={styles.devRow}>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => {
            void setAppOpenStubEnabled(true);
          }}
          testID="btn-dev-enable-app-open-stub"
          accessibilityRole="button"
          accessibilityLabel="Ativar app open stub (dev)"
        >
          <Text style={styles.secondaryButtonText}>Ativar app open stub (dev)</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => {
            void setAppOpenStubEnabled(false);
          }}
          testID="btn-dev-disable-app-open-stub"
          accessibilityRole="button"
          accessibilityLabel="Desativar app open stub (dev)"
        >
          <Text style={styles.secondaryButtonText}>Desativar app open stub (dev)</Text>
        </Pressable>
      </View>
      <Pressable
        style={styles.secondaryButton}
        onPress={() => {
          void resetAdTestConfig();
        }}
        testID="btn-dev-reset-ads-stub"
        accessibilityRole="button"
        accessibilityLabel="Resetar ads stub (dev)"
      >
        <Text style={styles.secondaryButtonText}>Resetar ads stub (dev)</Text>
      </Pressable>
      <Pressable
        style={styles.secondaryButton}
        onPress={() => {
          void resetSavedScenarios();
        }}
        testID="btn-dev-reset-scenarios"
        accessibilityRole="button"
        accessibilityLabel="Resetar cenários salvos (dev)"
      >
        <Text style={styles.secondaryButtonText}>Resetar cenários salvos (dev)</Text>
      </Pressable>
      <Pressable
        style={styles.secondaryButton}
        onPress={() => {
          void forceReviewPromptForDev();
        }}
        testID="btn-dev-force-store-review"
        accessibilityRole="button"
        accessibilityLabel="Forçar avaliação da loja (dev)"
      >
        <Text style={styles.secondaryButtonText}>Forçar avaliação da loja (dev)</Text>
      </Pressable>
      <Pressable
        style={styles.secondaryButton}
        onPress={() => {
          void seedInvestmentReferenceRateChangeForDev(INVESTMENT_RATE_PRESETS.cdi.annualRate);
        }}
        testID="btn-dev-seed-investment-rate-change"
        accessibilityRole="button"
        accessibilityLabel="Simular mudança na taxa de investimento (dev)"
      >
        <Text style={styles.secondaryButtonText}>Simular mudança de taxa (dev)</Text>
      </Pressable>
    </View>
  );
}

const benefitStyles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrapper: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  description: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
});

export default function PremiumScreen() {
  const iapAvailability = useIapAvailability();

  useEffect(() => {
    trackScreen('premium');
  }, []);

  return iapAvailability === 'supported' ? <PremiumIapScreen /> : <PremiumUnsupportedScreen />;
}

function PremiumIapScreen() {
  const { colors } = useTheme();
  const { isPremium, loading, markPremium, refreshEntitlement, diagnostics } = usePremiumContext();
  const showAds = shouldShowAds(isPremium);
  const [modalVisible, setModalVisible] = useState(false);
  const [diagnosticsTapCount, setDiagnosticsTapCount] = useState(0);
  const [paywallSource, setPaywallSource] =
    useState<ReturnType<typeof consumePendingPaywallSource>>('premium_tab');
  const diagnosticsVisible = diagnosticsTapCount >= 7;
  const socialProof = getPremiumSocialProof({
    average: Number(Constants.expoConfig?.extra?.appStoreRatingAverage),
    count: Number(Constants.expoConfig?.extra?.appStoreRatingCount),
  });
  const {
    connected,
    priceLabel,
    isStoreReady,
    purchaseInProgress,
    restoreInProgress,
    handlePurchase,
    handleRestore,
  } = useIapPurchase({
    isPremium,
    markPremium,
    source: paywallSource,
    onPremiumActivated: () => setModalVisible(false),
  });

  const premiumTrackingStateRef = useRef({
    isPremium,
    connected,
    isStoreReady,
    priceLabel,
    purchasedProductCount: diagnostics.purchasedProductIds.length,
  });

  useEffect(() => {
    premiumTrackingStateRef.current = {
      isPremium,
      connected,
      isStoreReady,
      priceLabel,
      purchasedProductCount: diagnostics.purchasedProductIds.length,
    };
  }, [connected, diagnostics.purchasedProductIds.length, isPremium, isStoreReady, priceLabel]);

  useFocusEffect(
    useCallback(() => {
      const source = consumePendingPaywallSource();
      setPaywallSource(source);
      const initial = premiumTrackingStateRef.current;
      if (initial.isPremium) {
        trackEvent('premium_status_viewed', {
          iap_availability: 'supported',
          store_connected: initial.connected,
          store_ready: initial.isStoreReady,
          ...(initial.priceLabel ? { price_label: initial.priceLabel } : {}),
          purchased_product_count: initial.purchasedProductCount,
        });
        return undefined;
      }

      const viewedAt = Date.now();
      let blurredAt: number | null = null;
      let context: Awaited<ReturnType<typeof getPaywallViewContext>> | null = null;
      const trackDismissal = () => {
        if (!blurredAt || !context || premiumTrackingStateRef.current.isPremium) return;
        trackEvent('paywall_dismissed', {
          source,
          time_on_paywall_ms: blurredAt - viewedAt,
          nth_view: context.nth_view,
          days_since_install: context.days_since_install,
        });
      };

      void getPaywallViewContext(source).then((nextContext) => {
        context = nextContext;
        const current = premiumTrackingStateRef.current;
        trackEvent('premium_paywall_viewed', {
          source,
          nth_view: nextContext.nth_view,
          iap_availability: 'supported',
          store_connected: current.connected,
          store_ready: current.isStoreReady,
          ...(current.priceLabel ? { price_label: current.priceLabel } : {}),
          purchased_product_count: current.purchasedProductCount,
        });
        trackDismissal();
      });

      return () => {
        blurredAt = Date.now();
        trackDismissal();
      };
    }, []),
  );

  return (
    <ScrollView
      testID="screen-premium"
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable
        onPress={() => setDiagnosticsTapCount((count) => Math.min(count + 1, 7))}
        accessibilityRole="button"
        accessibilityLabel="Plano Premium"
      >
        <Text style={styles.title} testID="screen-premium-title">
          Plano Premium
        </Text>
      </Pressable>
      <Text style={styles.subtitle}>
        Desbloqueie recursos essenciais para comparar financiamentos com clareza.
      </Text>
      <AdBanner enabled={showAds} />

      {isPremium ? (
        <>
          <PremiumStatusCard
            title="Premium ativo"
            description="Sua compra foi reconhecida neste dispositivo. Todos os recursos pagos já estão liberados."
          />

          <BrandProfileCard isPremium={isPremium} />

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Tudo liberado na sua conta</Text>
            <View style={styles.benefitsList}>
              <BenefitItem
                icon="share-outline"
                title="Exportações sem limitação"
                description="PDF, XLSX e CSV completos, sem cortes e sem marca da versão gratuita."
                color="#2563EB"
              />
              <BenefitItem
                icon="ban-outline"
                title="Experiência sem anúncios"
                description="Banners e bloqueios de exportação por anúncio deixam de aparecer."
                color="#EF4444"
              />
              <BenefitItem
                icon="logo-whatsapp"
                title="Atendimento prioritário"
                description="A aba Feedback libera o contato direto via WhatsApp para assinantes."
                color="#25D366"
              />
              <BenefitItem
                icon="infinite-outline"
                title="Cenários ilimitados"
                description="Você pode criar, salvar e comparar quantos cenários precisar."
                color="#8B5CF6"
              />
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Se a compra não for reconhecida</Text>
            <Text style={styles.helper}>
              Normalmente o Premium é liberado automaticamente ao abrir o app com a mesma conta da
              Apple. Use estas ações apenas se houver atraso ou falha no reconhecimento da compra.
            </Text>
            <View style={styles.row}>
              <Pressable
                style={[
                  styles.primaryButton,
                  (!connected || loading) && styles.primaryButtonDisabled,
                ]}
                onPress={() => {
                  trackEvent('premium_status_sync_requested', {
                    store_connected: connected,
                    store_ready: isStoreReady,
                    purchased_product_count: diagnostics.purchasedProductIds.length,
                  });
                  void refreshEntitlement();
                }}
                accessibilityRole="button"
                accessibilityLabel="Atualizar status premium"
              >
                <Text style={styles.primaryButtonText}>
                  {loading ? 'Sincronizando...' : 'Sincronizar agora'}
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.secondaryButton,
                  (!connected || restoreInProgress) && styles.primaryButtonDisabled,
                ]}
                onPress={handleRestore}
                accessibilityRole="button"
                accessibilityLabel="Restaurar compra"
              >
                <Text style={styles.secondaryButtonText}>
                  {restoreInProgress ? 'Restaurando...' : 'Restaurar compra'}
                </Text>
              </Pressable>
            </View>
          </View>
        </>
      ) : (
        <>
          <PremiumOfferCard priceLabel={priceLabel} socialProof={socialProof}>
            <View style={styles.row}>
              <Pressable
                style={[
                  styles.primaryButton,
                  (isPremium || purchaseInProgress) && styles.primaryButtonDisabled,
                ]}
                onPress={() => setModalVisible(true)}
                accessibilityRole="button"
                accessibilityLabel="Comprar Premium"
              >
                <Text style={styles.primaryButtonText}>Comprar premium</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.secondaryButton,
                  (!connected || restoreInProgress) && styles.primaryButtonDisabled,
                ]}
                onPress={handleRestore}
                accessibilityRole="button"
                accessibilityLabel="Restaurar compra"
              >
                <Text style={styles.secondaryButtonText}>
                  {restoreInProgress ? 'Restaurando...' : 'Restaurar'}
                </Text>
              </Pressable>
            </View>
          </PremiumOfferCard>

          <BrandProfileCard isPremium={isPremium} />
        </>
      )}
      {__DEV__ ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Controles de premium (dev)</Text>
          <View style={styles.devRow}>
            <Pressable
              style={styles.secondaryButton}
              onPress={() => markPremium(true)}
              testID="btn-dev-enable-premium"
              accessibilityRole="button"
              accessibilityLabel="Ativar premium (dev)"
            >
              <Text style={styles.secondaryButtonText}>Ativar premium (dev)</Text>
            </Pressable>
            <Pressable
              style={styles.secondaryButton}
              onPress={() => markPremium(false)}
              testID="btn-dev-disable-premium"
              accessibilityRole="button"
              accessibilityLabel="Desativar premium (dev)"
            >
              <Text style={styles.secondaryButtonText}>Desativar premium (dev)</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <DevAdControls />
      {diagnosticsVisible ? (
        <PremiumDiagnosticsCard
          isPremium={isPremium}
          loading={loading}
          iapAvailability={diagnostics.iapAvailability}
          purchasedProductIds={diagnostics.purchasedProductIds}
          premiumPurchaseDetails={diagnostics.premiumPurchaseDetails}
          refreshAttemptedAt={diagnostics.refreshAttemptedAt}
          refreshCompletedAt={diagnostics.refreshCompletedAt}
          refreshError={diagnostics.refreshError}
          onRefresh={refreshEntitlement}
        />
      ) : null}

      <Modal
        animationType={Platform.OS === 'ios' ? 'fade' : 'slide'}
        transparent
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={[styles.modalBackdrop, Platform.OS === 'ios' && styles.modalBackdropIOS]}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: colors.background },
              Platform.OS === 'ios' && styles.modalCardIOS,
            ]}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>Desbloqueie o Premium</Text>
            <Text style={[styles.modalText, { color: colors.textSecondary }]}>
              {PREMIUM_ONE_TIME_MESSAGE}
            </Text>
            <View style={styles.modalList}>
              {PREMIUM_BENEFITS.map((benefit) => (
                <Text
                  key={benefit.title}
                  style={[styles.modalItem, { color: colors.textSecondary }]}
                >
                  • {benefit.title}
                </Text>
              ))}
            </View>
            <View style={styles.modalRow}>
              <Pressable
                style={[styles.secondaryButton, { borderColor: colors.border }]}
                onPress={() => setModalVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Cancelar compra"
              >
                <Text style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>
                  Agora não
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.primaryButton,
                  (isPremium || !isStoreReady || purchaseInProgress) &&
                    styles.primaryButtonDisabled,
                ]}
                onPress={handlePurchase}
                accessibilityRole="button"
                accessibilityLabel="Continuar para compra"
              >
                <Text style={styles.primaryButtonText}>
                  {purchaseInProgress
                    ? 'Processando...'
                    : priceLabel
                      ? `Continuar (${priceLabel})`
                      : 'Continuar'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function PremiumUnsupportedScreen() {
  const { isPremium, loading, markPremium, refreshEntitlement, diagnostics } = usePremiumContext();
  const showAds = shouldShowAds(isPremium);
  const [diagnosticsTapCount, setDiagnosticsTapCount] = useState(0);
  const diagnosticsVisible = diagnosticsTapCount >= 7;
  const socialProof = getPremiumSocialProof({
    average: Number(Constants.expoConfig?.extra?.appStoreRatingAverage),
    count: Number(Constants.expoConfig?.extra?.appStoreRatingCount),
  });

  return (
    <ScrollView
      testID="screen-premium"
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable
        onPress={() => setDiagnosticsTapCount((count) => Math.min(count + 1, 7))}
        accessibilityRole="button"
        accessibilityLabel="Plano Premium"
      >
        <Text style={styles.title} testID="screen-premium-title">
          Plano Premium
        </Text>
      </Pressable>
      <View style={styles.bannerWarning}>
        <Text style={styles.bannerWarningText}>
          Compras no app indisponíveis neste dispositivo.
        </Text>
      </View>
      <Text style={styles.subtitle}>
        Compras no app não estão disponíveis neste dispositivo. Use uma build instalada com loja
        compatível.
      </Text>
      <AdBanner enabled={showAds} />
      {isPremium ? (
        <>
          <PremiumStatusCard
            title="Premium ativo"
            description="Mesmo nesta build sem suporte a compras, o app reconheceu que sua conta já tem o Premium liberado."
          />
          <BrandProfileCard isPremium={isPremium} />
        </>
      ) : (
        <>
          <PremiumOfferCard priceLabel={IAP_FALLBACK_PRICE} socialProof={socialProof}>
            <View style={styles.bannerWarning}>
              <Text style={styles.bannerWarningText}>
                A compra não pode ser concluída nesta instalação. Use uma build instalada pela App
                Store ou Play Store.
              </Text>
            </View>
          </PremiumOfferCard>
          <BrandProfileCard isPremium={isPremium} />
        </>
      )}
      {__DEV__ ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Controles de premium (dev)</Text>
          <View style={styles.devRow}>
            <Pressable
              style={styles.secondaryButton}
              onPress={() => markPremium(true)}
              testID="btn-dev-enable-premium"
              accessibilityRole="button"
              accessibilityLabel="Ativar premium (dev)"
            >
              <Text style={styles.secondaryButtonText}>Ativar premium (dev)</Text>
            </Pressable>
            <Pressable
              style={styles.secondaryButton}
              onPress={() => markPremium(false)}
              testID="btn-dev-disable-premium"
              accessibilityRole="button"
              accessibilityLabel="Desativar premium (dev)"
            >
              <Text style={styles.secondaryButtonText}>Desativar premium (dev)</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <DevAdControls />
      {diagnosticsVisible ? (
        <PremiumDiagnosticsCard
          isPremium={isPremium}
          loading={loading}
          iapAvailability={diagnostics.iapAvailability}
          purchasedProductIds={diagnostics.purchasedProductIds}
          premiumPurchaseDetails={diagnostics.premiumPurchaseDetails}
          refreshAttemptedAt={diagnostics.refreshAttemptedAt}
          refreshCompletedAt={diagnostics.refreshCompletedAt}
          refreshError={diagnostics.refreshError}
          onRefresh={refreshEntitlement}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 32,
    backgroundColor: '#F7F7F7',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    gap: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  benefitsList: {
    gap: 16,
  },
  premiumStatusCard: {
    borderWidth: 1,
    borderColor: '#A7F3D0',
    backgroundColor: '#ECFDF5',
  },
  premiumStatusHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  premiumStatusIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D1FAE5',
  },
  premiumStatusText: {
    flex: 1,
    gap: 4,
  },
  premiumStatusTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#065F46',
  },
  premiumStatusDescription: {
    fontSize: 13,
    lineHeight: 19,
    color: '#047857',
  },
  premiumStatusPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  premiumStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#D1FAE5',
  },
  premiumStatusPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#065F46',
  },
  helper: {
    fontSize: 12,
    color: '#6B7280',
  },
  diagnosticsCard: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    gap: 10,
  },
  diagnosticsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  diagnosticsHint: {
    fontSize: 12,
    color: '#CBD5E1',
  },
  diagnosticsText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#E2E8F0',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  devToolsCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  devToolsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  devToolsStatus: {
    fontSize: 12,
    lineHeight: 18,
    color: '#475569',
  },
  primaryButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    minHeight: 44,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    minHeight: 44,
  },
  secondaryButtonText: {
    color: '#374151',
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.45)',
    justifyContent: 'flex-end',
  },
  modalBackdropIOS: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    gap: 12,
  },
  modalCardIOS: {
    borderRadius: 16,
    maxWidth: 400,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  modalText: {
    fontSize: 14,
    color: '#4B5563',
  },
  modalList: {
    gap: 6,
  },
  modalItem: {
    fontSize: 13,
    color: '#374151',
  },
  modalRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'flex-end',
  },
  devRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  bannerWarning: {
    borderWidth: 1,
    borderColor: '#F59E0B',
    backgroundColor: '#FFFBEB',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  bannerWarningText: {
    color: '#92400E',
    fontSize: 12,
    fontWeight: '600',
  },
});
