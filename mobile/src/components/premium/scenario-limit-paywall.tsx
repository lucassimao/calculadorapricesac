import type { PropsWithChildren } from 'react';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useIapPurchase } from '../../hooks/useIapPurchase';
import { trackEvent } from '../../lib/analytics';
import { IAP_FALLBACK_PRICE } from '../../lib/iap';
import { getPremiumSocialProof } from '../../lib/premium-offer';
import { SCENARIO_LIMIT_PAYWALL_SOURCE } from '../../lib/scenario-limit';
import { PremiumOfferCard } from './premium-offer-card';

interface ScenarioLimitPaywallProps {
  iapAvailability: 'checking' | 'supported' | 'unsupported';
  isPremium: boolean;
  markPremium: (value: boolean) => Promise<void>;
  onClose: (reason?: 'dismissed' | 'converted') => void;
  visible: boolean;
}

function getConfiguredSocialProof() {
  return getPremiumSocialProof({
    average: Number(Constants.expoConfig?.extra?.appStoreRatingAverage),
    count: Number(Constants.expoConfig?.extra?.appStoreRatingCount),
  });
}

function SheetFrame({
  children,
  onClose,
  visible,
}: PropsWithChildren<{ onClose: () => void; visible: boolean }>) {
  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop} testID="scenario-limit-paywall">
        <View style={styles.sheet} accessibilityViewIsModal>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Text style={styles.sheetTitle}>Premium</Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Fechar oferta Premium"
              testID="scenario-limit-paywall-close"
              hitSlop={12}
            >
              <Ionicons name="close" size={24} color="#475569" />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function ScenarioLimitPaywallIap({
  isPremium,
  markPremium,
  onClose,
  visible,
}: Pick<ScenarioLimitPaywallProps, 'isPremium' | 'markPremium' | 'onClose' | 'visible'>) {
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
    source: SCENARIO_LIMIT_PAYWALL_SOURCE,
    onPremiumActivated: () => onClose('converted'),
  });

  const startPurchase = () => {
    trackEvent('scenario_limit_upgrade_clicked', { source: 'save_scenario' });
    void handlePurchase();
  };

  return (
    <SheetFrame onClose={() => onClose('dismissed')} visible={visible}>
      <PremiumOfferCard
        priceLabel={priceLabel}
        socialProof={getConfiguredSocialProof()}
        title="Salve cenários ilimitados no Premium"
        subtitle="Compare novas possibilidades sem apagar as simulações que você já salvou."
      >
        <View style={styles.actions}>
          <Pressable
            style={[styles.primaryButton, !isStoreReady && styles.disabled]}
            onPress={startPurchase}
            disabled={!isStoreReady || purchaseInProgress}
            accessibilityRole="button"
            accessibilityLabel="Comprar Premium para salvar cenários ilimitados"
            testID="scenario-limit-paywall-buy"
          >
            <Text style={styles.primaryButtonText}>
              {purchaseInProgress ? 'Processando...' : 'Comprar Premium'}
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
      </PremiumOfferCard>
    </SheetFrame>
  );
}

function ScenarioLimitPaywallUnsupported({
  onClose,
  visible,
}: Pick<ScenarioLimitPaywallProps, 'onClose' | 'visible'>) {
  return (
    <SheetFrame onClose={() => onClose('dismissed')} visible={visible}>
      <PremiumOfferCard
        priceLabel={IAP_FALLBACK_PRICE}
        socialProof={getConfiguredSocialProof()}
        title="Salve cenários ilimitados no Premium"
        subtitle="Compare novas possibilidades sem apagar as simulações que você já salvou."
      >
        <Text style={styles.unavailableText}>
          A compra não pode ser concluída nesta instalação. Use uma build instalada pela App Store
          ou Play Store.
        </Text>
      </PremiumOfferCard>
    </SheetFrame>
  );
}

export function ScenarioLimitPaywall({
  iapAvailability,
  isPremium,
  markPremium,
  onClose,
  visible,
}: ScenarioLimitPaywallProps) {
  return iapAvailability === 'supported' ? (
    <ScenarioLimitPaywallIap
      isPremium={isPremium}
      markPremium={markPremium}
      onClose={onClose}
      visible={visible}
    />
  ) : (
    <ScenarioLimitPaywallUnsupported onClose={onClose} visible={visible} />
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  sheet: {
    maxHeight: '92%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: '#F8FAFC',
    paddingTop: 8,
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#CBD5E1',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  sheetTitle: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 28,
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
