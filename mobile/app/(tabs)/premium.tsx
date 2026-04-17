import { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/lib/theme';
import { IAP_FALLBACK_PRICE, IAP_PRODUCT_ID } from '../../src/lib/iap';
import { usePremium } from '../../src/hooks/usePremium';
import { useIapAvailability } from '../../src/hooks/useIapAvailability';
import { AdBanner } from '../../src/components/AdBanner';
import { trackEvent, trackScreen } from '../../src/lib/analytics';
import { useIapPurchase } from '../../src/hooks/useIapPurchase';
import { shouldShowAds } from '../../src/lib/premium';

interface BenefitItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  color?: string;
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
  const { isPremium, markPremium } = usePremium();
  const showAds = shouldShowAds(isPremium);
  const [modalVisible, setModalVisible] = useState(false);
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
    source: 'premium_tab',
    onPremiumActivated: () => setModalVisible(false),
  });

  useEffect(() => {
    trackEvent('premium_paywall_viewed');
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Plano Premium</Text>
      <Text style={styles.subtitle}>
        Desbloqueie recursos essenciais para comparar financiamentos com clareza.
      </Text>
      <AdBanner enabled={showAds} />

      <View style={styles.card}>
        <Text style={styles.cardTitle}>O que você ganha</Text>
        <View style={styles.benefitsList}>
          <BenefitItem
            icon="ban-outline"
            title="Sem anúncios"
            description="Navegue sem interrupções publicitárias"
            color="#EF4444"
          />
          <BenefitItem
            icon="share-outline"
            title="Exportar simulação"
            description="Gere arquivos PDF, XLSX e CSV com tabela completa, resumo e os principais dados do cenário"
            color="#2563EB"
          />
          <BenefitItem
            icon="logo-whatsapp"
            title="Suporte prioritário"
            description="Atendimento direto via WhatsApp para dúvidas e sugestões"
            color="#25D366"
          />
          <BenefitItem
            icon="infinite-outline"
            title="Cenários ilimitados"
            description="Salve e compare quantos cenários precisar"
            color="#8B5CF6"
          />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.priceLabel}>Pagamento único</Text>
        <Text style={styles.price}>{priceLabel}</Text>
        <Text style={styles.helper}>Compra única, sem assinatura recorrente.</Text>
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
            <Text style={styles.primaryButtonText}>
              {isPremium ? 'Premium ativo' : 'Comprar premium'}
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
              {restoreInProgress ? 'Restaurando...' : 'Restaurar'}
            </Text>
          </Pressable>
        </View>
        {__DEV__ ? (
          <View style={styles.devRow}>
            <Pressable
              style={styles.secondaryButton}
              onPress={() => markPremium(true)}
              accessibilityRole="button"
              accessibilityLabel="Ativar premium (dev)"
            >
              <Text style={styles.secondaryButtonText}>Ativar premium (dev)</Text>
            </Pressable>
            <Pressable
              style={styles.secondaryButton}
              onPress={() => markPremium(false)}
              accessibilityRole="button"
              accessibilityLabel="Desativar premium (dev)"
            >
              <Text style={styles.secondaryButtonText}>Desativar premium (dev)</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

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
              Remova anúncios e exporte sua análise para compartilhar ou guardar.
            </Text>
            <View style={styles.modalList}>
              <Text style={[styles.modalItem, { color: colors.textSecondary }]}>
                • PDF com resumo e tabela
              </Text>
              <Text style={[styles.modalItem, { color: colors.textSecondary }]}>
                • XLSX para editar planilhas
              </Text>
              <Text style={[styles.modalItem, { color: colors.textSecondary }]}>
                • CSV para integrar com outros apps
              </Text>
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
                  {purchaseInProgress ? 'Processando...' : `Continuar (${priceLabel})`}
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
  const { isPremium, markPremium } = usePremium();
  const showAds = shouldShowAds(isPremium);

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Plano Premium</Text>
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
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Pagamento único</Text>
        <Text style={styles.price}>{IAP_FALLBACK_PRICE}</Text>
        <Text style={styles.helper}>
          Faça o teste em uma build instalada para concluir a compra.
        </Text>
        {__DEV__ ? (
          <View style={styles.devRow}>
            <Pressable
              style={styles.secondaryButton}
              onPress={() => markPremium(true)}
              accessibilityRole="button"
              accessibilityLabel="Ativar premium (dev)"
            >
              <Text style={styles.secondaryButtonText}>Ativar premium (dev)</Text>
            </Pressable>
            <Pressable
              style={styles.secondaryButton}
              onPress={() => markPremium(false)}
              accessibilityRole="button"
              accessibilityLabel="Desativar premium (dev)"
            >
              <Text style={styles.secondaryButtonText}>Desativar premium (dev)</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
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
  priceLabel: {
    fontSize: 12,
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  price: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  helper: {
    fontSize: 12,
    color: '#6B7280',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
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
