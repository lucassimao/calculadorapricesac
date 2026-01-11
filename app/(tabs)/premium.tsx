import { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useIAP } from 'expo-iap';
import { useTheme } from '../../src/lib/theme';
import { IAP_FALLBACK_PRICE, IAP_PRODUCT_ID } from '../../src/lib/iap';
import { usePremium } from '../../src/hooks/usePremium';
import { useIapAvailability } from '../../src/hooks/useIapAvailability';

export default function PremiumScreen() {
  const iapAvailability = useIapAvailability();

  return iapAvailability === 'supported' ? <PremiumIapScreen /> : <PremiumUnsupportedScreen />;
}

function PremiumIapScreen() {
  const { colors } = useTheme();
  const { isPremium, markPremium } = usePremium();
  const [modalVisible, setModalVisible] = useState(false);
  const [purchaseInProgress, setPurchaseInProgress] = useState(false);
  const [restoreRequestedAt, setRestoreRequestedAt] = useState<number | null>(null);
  const [purchasesValidated, setPurchasesValidated] = useState(false);
  const {
    connected,
    products,
    availablePurchases,
    requestPurchase,
    restorePurchases,
    fetchProducts,
    getAvailablePurchases,
    finishTransaction,
  } = useIAP({
    onPurchaseSuccess: async (purchase) => {
      if (purchase.productId !== IAP_PRODUCT_ID) return;
      try {
        await finishTransaction({ purchase, isConsumable: false });
      } catch {
        // Ignore finish errors; entitlement is still granted locally.
      }
      await markPremium(true);
      Alert.alert('Premium ativado', 'Anúncios removidos e exportação liberada.');
      setModalVisible(false);
    },
    onPurchaseError: () => {
      Alert.alert('Erro', 'Não foi possível concluir a compra.');
    },
  });

  const product = useMemo(
    () => products.find((item) => item.id === IAP_PRODUCT_ID),
    [products]
  );
  const hasEntitlement = useMemo(
    () => availablePurchases.some((purchase) => purchase.productId === IAP_PRODUCT_ID),
    [availablePurchases]
  );
  const priceLabel = product?.displayPrice ?? IAP_FALLBACK_PRICE;
  const isStoreReady = connected && !!product;
  const restoreInProgress = restoreRequestedAt !== null;

  useEffect(() => {
    if (!connected) return;
    fetchProducts({ skus: [IAP_PRODUCT_ID], type: 'in-app' }).catch(() => {});
    getAvailablePurchases()
      .then(() => setPurchasesValidated(true))
      .catch(() => setPurchasesValidated(true));
  }, [connected, fetchProducts, getAvailablePurchases]);

  useEffect(() => {
    if (hasEntitlement && !isPremium) {
      // Grant premium if platform says we have entitlement
      markPremium(true).catch(() => {});
    } else if (purchasesValidated && isPremium && !hasEntitlement) {
      // Revoke premium if local state says premium but platform has no entitlement
      // (e.g., user got a refund or purchase was revoked)
      markPremium(false).catch(() => {});
    }
  }, [hasEntitlement, isPremium, markPremium, purchasesValidated]);

  useEffect(() => {
    if (restoreRequestedAt === null) return;
    if (hasEntitlement) {
      markPremium(true)
        .then(() => Alert.alert('Restaurado', 'Compra restaurada com sucesso.'))
        .catch(() => {});
      setRestoreRequestedAt(null);
    }
  }, [restoreRequestedAt, hasEntitlement, markPremium]);

  useEffect(() => {
    if (restoreRequestedAt === null) return;
    const timeout = setTimeout(() => {
      if (!hasEntitlement) {
        Alert.alert('Nada para restaurar', 'Nenhuma compra encontrada.');
        setRestoreRequestedAt(null);
      }
    }, 2000);
    return () => clearTimeout(timeout);
  }, [restoreRequestedAt, hasEntitlement]);

  const handlePurchase = async () => {
    try {
      if (!connected) {
        Alert.alert('Loja indisponível', 'Conecte-se à App Store/Google Play para comprar.');
        return;
      }
      if (isPremium) {
        Alert.alert('Premium ativo', 'Você já removeu os anúncios.');
        return;
      }
      if (!product) {
        Alert.alert('Produto indisponível', 'Não foi possível carregar o produto. Tente novamente.');
        return;
      }
      setPurchaseInProgress(true);
      await requestPurchase({
        type: 'in-app',
        request: {
          ios: { sku: IAP_PRODUCT_ID },
          android: { skus: [IAP_PRODUCT_ID] },
        },
      });
    } catch {
      Alert.alert('Erro', 'Não foi possível concluir a compra.');
    } finally {
      setPurchaseInProgress(false);
    }
  };

  const handleRestore = async () => {
    try {
      if (!connected) {
        Alert.alert('Loja indisponível', 'Conecte-se à App Store/Google Play para restaurar.');
        return;
      }
      setRestoreRequestedAt(Date.now());
      await restorePurchases();
      await getAvailablePurchases();
    } catch {
      Alert.alert('Erro', 'Não foi possível restaurar a compra.');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Plano Premium</Text>
      <Text style={styles.subtitle}>
        Desbloqueie recursos essenciais para comparar financiamentos com clareza.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>O que você ganha</Text>
        <View style={styles.list}>
          <Text style={styles.listItem}>• Remover anúncios</Text>
          <Text style={styles.listItem}>• Exportar PDF</Text>
          <Text style={styles.listItem}>• Exportar XLSX</Text>
          <Text style={styles.listItem}>• Exportar CSV</Text>
          <Text style={styles.listItem}>• Exportar tabela completa de parcelas</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.priceLabel}>Pagamento único</Text>
        <Text style={styles.price}>{priceLabel}</Text>
        <Text style={styles.helper}>
          Compra única, sem assinatura recorrente.
        </Text>
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
          <View style={[
            styles.modalCard,
            { backgroundColor: colors.background },
            Platform.OS === 'ios' && styles.modalCardIOS
          ]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Desbloqueie o Premium</Text>
            <Text style={[styles.modalText, { color: colors.textSecondary }]}>
              Remova anúncios e exporte sua análise para compartilhar ou guardar.
            </Text>
            <View style={styles.modalList}>
              <Text style={[styles.modalItem, { color: colors.textSecondary }]}>• PDF com resumo e tabela</Text>
              <Text style={[styles.modalItem, { color: colors.textSecondary }]}>• XLSX para editar planilhas</Text>
              <Text style={[styles.modalItem, { color: colors.textSecondary }]}>• CSV para integrar com outros apps</Text>
            </View>
            <View style={styles.modalRow}>
              <Pressable
                style={[styles.secondaryButton, { borderColor: colors.border }]}
                onPress={() => setModalVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Cancelar compra"
              >
                <Text style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>Agora não</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.primaryButton,
                  (isPremium || !isStoreReady || purchaseInProgress) && styles.primaryButtonDisabled,
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
  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Plano Premium</Text>
      <View style={styles.bannerWarning}>
        <Text style={styles.bannerWarningText}>
          Compras no app indisponíveis neste dispositivo.
        </Text>
      </View>
      <Text style={styles.subtitle}>
        Compras no app não estão disponíveis neste dispositivo. Use uma build instalada com loja compatível.
      </Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Pagamento único</Text>
        <Text style={styles.price}>{IAP_FALLBACK_PRICE}</Text>
        <Text style={styles.helper}>
          Faça o teste em uma build instalada para concluir a compra.
        </Text>
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
  list: {
    gap: 6,
  },
  listItem: {
    fontSize: 14,
    color: '#374151',
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
