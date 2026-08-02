import { useCallback, useEffect, useRef, type PropsWithChildren } from 'react';
import Constants from 'expo-constants';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useIapPurchase } from '../../hooks/useIapPurchase';
import { getPaywallViewContext, trackEvent } from '../../lib/analytics';
import { IAP_FALLBACK_PRICE } from '../../lib/iap';
import { POST_EXPORT_PAYWALL_SOURCE } from '../../lib/post-export-paywall';
import { getPremiumSocialProof } from '../../lib/premium-offer';
import { PremiumBottomSheet } from './premium-bottom-sheet';
import { PremiumOfferCard } from './premium-offer-card';

interface PostExportPaywallProps {
  iapAvailability: 'checking' | 'supported' | 'unsupported';
  isPremium: boolean;
  markPremium: (value: boolean) => Promise<void>;
  onClose: () => void;
  visible: boolean;
}

function getConfiguredSocialProof() {
  return getPremiumSocialProof({
    average: Number(Constants.expoConfig?.extra?.appStoreRatingAverage),
    count: Number(Constants.expoConfig?.extra?.appStoreRatingCount),
  });
}

function ExportComparison() {
  return (
    <View style={styles.comparison} testID="post-export-comparison">
      <View style={[styles.comparisonCard, styles.freeCard]}>
        <Text style={styles.freeLabel}>VERSÃO GRÁTIS</Text>
        <Text style={styles.comparisonTitle}>Com marca d’água</Text>
        <Text style={styles.comparisonItem}>• tabela resumida</Text>
        <Text style={styles.comparisonItem}>• anúncio a cada exportação</Text>
      </View>
      <View style={[styles.comparisonCard, styles.premiumCard]}>
        <Text style={styles.premiumLabel}>PREMIUM</Text>
        <Text style={styles.comparisonTitle}>Limpo e profissional</Text>
        <Text style={styles.comparisonItem}>• sem marca d’água</Text>
        <Text style={styles.comparisonItem}>• PDF com sua marca</Text>
      </View>
    </View>
  );
}

function PostExportOffer({
  children,
  onClose,
  priceLabel,
  visible,
}: PropsWithChildren<{
  onClose: () => void;
  priceLabel: string | null;
  visible: boolean;
}>) {
  return (
    <PremiumBottomSheet onClose={onClose} testID="post-export-paywall" visible={visible}>
      <PremiumOfferCard
        highlight={<ExportComparison />}
        priceLabel={priceLabel}
        socialProof={getConfiguredSocialProof()}
        title="Seu arquivo foi exportado"
        subtitle="Agora compare o resultado gratuito com tudo o que você libera no Premium."
      >
        {children}
      </PremiumOfferCard>
    </PremiumBottomSheet>
  );
}

function PostExportPaywallIap({
  isPremium,
  markPremium,
  onClose,
  visible,
}: Omit<PostExportPaywallProps, 'onClose'> & { onClose: (converted?: boolean) => void }) {
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
    source: POST_EXPORT_PAYWALL_SOURCE,
    onPremiumActivated: () => onClose(true),
  });

  const startPurchase = () => {
    trackEvent('export_upgrade_clicked', {
      source: POST_EXPORT_PAYWALL_SOURCE,
      placement: 'post_export_paywall',
    });
    void handlePurchase();
  };

  return (
    <PostExportOffer onClose={() => onClose(false)} priceLabel={priceLabel} visible={visible}>
      <View style={styles.actions}>
        <Pressable
          style={[styles.primaryButton, !isStoreReady && styles.disabled]}
          onPress={startPurchase}
          disabled={!isStoreReady || purchaseInProgress}
          accessibilityRole="button"
          accessibilityLabel="Comprar Premium depois da exportação"
          testID="post-export-paywall-buy"
        >
          <Text style={styles.primaryButtonText}>
            {purchaseInProgress ? 'Processando...' : 'Liberar Premium'}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.secondaryButton, (!connected || restoreInProgress) && styles.disabled]}
          onPress={handleRestore}
          disabled={!connected || restoreInProgress}
          accessibilityRole="button"
          accessibilityLabel="Restaurar compra Premium"
        >
          <Text style={styles.secondaryButtonText}>
            {restoreInProgress ? 'Restaurando...' : 'Restaurar compra'}
          </Text>
        </Pressable>
      </View>
    </PostExportOffer>
  );
}

function PostExportPaywallUnsupported({
  onClose,
  visible,
}: Pick<PostExportPaywallProps, 'onClose' | 'visible'>) {
  return (
    <PostExportOffer onClose={onClose} priceLabel={IAP_FALLBACK_PRICE} visible={visible}>
      <Text style={styles.unavailableText}>
        A compra não pode ser concluída nesta instalação. Use uma build instalada pela App Store ou
        Play Store.
      </Text>
    </PostExportOffer>
  );
}

export function PostExportPaywall({
  iapAvailability,
  isPremium,
  markPremium,
  onClose,
  visible,
}: PostExportPaywallProps) {
  const trackingRef = useRef<{
    openedAt: number;
    closedAt: number | null;
    context: Awaited<ReturnType<typeof getPaywallViewContext>> | null;
    converted: boolean;
    dismissalTracked: boolean;
  } | null>(null);

  const trackDismissal = useCallback(() => {
    const state = trackingRef.current;
    if (
      !state ||
      state.converted ||
      state.dismissalTracked ||
      state.closedAt === null ||
      !state.context
    ) {
      return;
    }
    state.dismissalTracked = true;
    trackEvent('paywall_dismissed', {
      source: POST_EXPORT_PAYWALL_SOURCE,
      time_on_paywall_ms: Math.max(0, state.closedAt - state.openedAt),
      nth_view: state.context.nth_view,
      days_since_install: state.context.days_since_install,
    });
    trackingRef.current = null;
  }, []);

  const closePaywall = useCallback(
    (converted = false) => {
      const state = trackingRef.current;
      if (state) {
        state.converted = converted;
        state.closedAt = Date.now();
        if (converted) trackingRef.current = null;
        else trackDismissal();
      }
      onClose();
    },
    [onClose, trackDismissal],
  );

  useEffect(() => {
    if (!visible || trackingRef.current) return;
    const openedAt = Date.now();
    trackingRef.current = {
      openedAt,
      closedAt: null,
      context: null,
      converted: false,
      dismissalTracked: false,
    };
    void getPaywallViewContext(POST_EXPORT_PAYWALL_SOURCE)
      .then((context) => {
        const state = trackingRef.current;
        if (!state || state.openedAt !== openedAt) return;
        state.context = context;
        trackEvent('premium_paywall_viewed', {
          source: POST_EXPORT_PAYWALL_SOURCE,
          nth_view: context.nth_view,
          iap_availability: iapAvailability,
        });
        trackDismissal();
      })
      .catch(() => {
        const state = trackingRef.current;
        if (state?.openedAt === openedAt && state.closedAt !== null) trackingRef.current = null;
      });
  }, [iapAvailability, trackDismissal, visible]);

  return iapAvailability === 'supported' ? (
    <PostExportPaywallIap
      iapAvailability={iapAvailability}
      isPremium={isPremium}
      markPremium={markPremium}
      onClose={closePaywall}
      visible={visible}
    />
  ) : (
    <PostExportPaywallUnsupported onClose={() => closePaywall(false)} visible={visible} />
  );
}

const styles = StyleSheet.create({
  comparison: {
    flexDirection: 'row',
    gap: 10,
  },
  comparisonCard: {
    flex: 1,
    minHeight: 132,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  freeCard: {
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
  },
  premiumCard: {
    borderColor: '#93C5FD',
    backgroundColor: '#EFF6FF',
  },
  freeLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '800',
  },
  premiumLabel: {
    color: '#1D4ED8',
    fontSize: 11,
    fontWeight: '800',
  },
  comparisonTitle: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 6,
    marginBottom: 8,
  },
  comparisonItem: {
    color: '#475569',
    fontSize: 12,
    lineHeight: 18,
  },
  actions: {
    gap: 10,
  },
  primaryButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  secondaryButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: '#334155',
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.55,
  },
  unavailableText: {
    color: '#92400E',
    fontSize: 13,
    lineHeight: 19,
    borderRadius: 10,
    backgroundColor: '#FFFBEB',
    padding: 12,
  },
});
