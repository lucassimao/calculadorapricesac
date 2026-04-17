import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { useIAP } from 'expo-iap';
import { trackEvent } from '../lib/analytics';
import { IAP_FALLBACK_PRICE, IAP_PRODUCT_ID } from '../lib/iap';

interface UseIapPurchaseOptions {
  isPremium: boolean;
  markPremium: (value: boolean) => Promise<void>;
  source: string;
  onPremiumActivated?: () => void;
}

export function useIapPurchase({
  isPremium,
  markPremium,
  source,
  onPremiumActivated,
}: UseIapPurchaseOptions) {
  const [purchaseInProgress, setPurchaseInProgress] = useState(false);
  const [restoreRequestedAt, setRestoreRequestedAt] = useState<number | null>(null);
  const [purchasesValidated, setPurchasesValidated] = useState(false);
  const [recentPurchaseAt, setRecentPurchaseAt] = useState<number | null>(null);

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
      trackEvent('purchase_success', { source });
      setRecentPurchaseAt(Date.now());
      try {
        await finishTransaction({ purchase, isConsumable: false });
      } catch {
        // Ignore finish errors; entitlement is still granted locally.
      }
      await markPremium(true);
      Alert.alert('Premium ativado', 'Anúncios removidos e exportação liberada.');
      onPremiumActivated?.();
    },
    onPurchaseError: () => {
      trackEvent('purchase_failed', { source });
      Alert.alert('Erro', 'Não foi possível concluir a compra.');
    },
  });

  const product = useMemo(() => products.find((item) => item.id === IAP_PRODUCT_ID), [products]);
  const hasEntitlement = useMemo(
    () => availablePurchases.some((purchase) => purchase.productId === IAP_PRODUCT_ID),
    [availablePurchases],
  );
  const priceLabel = product?.displayPrice ?? IAP_FALLBACK_PRICE;
  const isStoreReady = connected && !!product;
  const restoreInProgress = restoreRequestedAt !== null;
  const recentlyPurchased = recentPurchaseAt !== null && Date.now() - recentPurchaseAt < 10000;

  useEffect(() => {
    if (!connected) return;
    fetchProducts({ skus: [IAP_PRODUCT_ID], type: 'in-app' }).catch(() => {});
    getAvailablePurchases()
      .then(() => setPurchasesValidated(true))
      .catch(() => setPurchasesValidated(true));
  }, [connected, fetchProducts, getAvailablePurchases]);

  useEffect(() => {
    if (hasEntitlement && !isPremium) {
      markPremium(true).catch(() => {});
    } else if (purchasesValidated && isPremium && !hasEntitlement && !recentlyPurchased) {
      markPremium(false).catch(() => {});
    }
  }, [hasEntitlement, isPremium, markPremium, purchasesValidated, recentlyPurchased]);

  useEffect(() => {
    if (recentPurchaseAt !== null && hasEntitlement) {
      setRecentPurchaseAt(null);
    }
  }, [recentPurchaseAt, hasEntitlement]);

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

  const handlePurchase = useCallback(async () => {
    try {
      trackEvent('purchase_started', { source });
      if (!connected) {
        Alert.alert('Loja indisponível', 'Conecte-se à App Store/Google Play para comprar.');
        return;
      }
      if (isPremium) {
        Alert.alert('Premium ativo', 'Você já removeu os anúncios.');
        return;
      }
      if (!product) {
        Alert.alert(
          'Produto indisponível',
          'Não foi possível carregar o produto. Tente novamente.',
        );
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
  }, [connected, isPremium, product, requestPurchase, source]);

  const handleRestore = useCallback(async () => {
    try {
      trackEvent('purchase_restore_started', { source });
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
  }, [connected, getAvailablePurchases, restorePurchases, source]);

  return {
    connected,
    priceLabel,
    isStoreReady,
    purchaseInProgress,
    restoreInProgress,
    handlePurchase,
    handleRestore,
  };
}
