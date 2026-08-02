import Constants from 'expo-constants';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useIapPurchase } from '../../hooks/useIapPurchase';
import { trackEvent } from '../../lib/analytics';
import { IAP_FALLBACK_PRICE } from '../../lib/iap';
import { getPremiumSocialProof } from '../../lib/premium-offer';
import { SCENARIO_LIMIT_PAYWALL_SOURCE } from '../../lib/scenario-limit';
import { PremiumBottomSheet } from './premium-bottom-sheet';
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
    <PremiumBottomSheet
      onClose={() => onClose('dismissed')}
      testID="scenario-limit-paywall"
      visible={visible}
    >
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
    </PremiumBottomSheet>
  );
}

function ScenarioLimitPaywallUnsupported({
  onClose,
  visible,
}: Pick<ScenarioLimitPaywallProps, 'onClose' | 'visible'>) {
  return (
    <PremiumBottomSheet
      onClose={() => onClose('dismissed')}
      testID="scenario-limit-paywall"
      visible={visible}
    >
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
    </PremiumBottomSheet>
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
