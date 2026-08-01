import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Alert } from 'react-native';
import { ErrorCode, useIAP } from 'expo-iap';
import {
  getPaywallViewCount,
  trackEvent,
  type AnalyticsEventMap,
  type PaywallSource,
} from '../lib/analytics';
import { IAP_FALLBACK_PRICE, IAP_PRODUCT_ID } from '../lib/iap';
import {
  completePurchaseAttempt,
  createPurchaseAttempt,
  getPendingPurchaseAttempt,
  type PurchaseTerminalEvent,
} from '../lib/purchase-attempt';

interface UseIapPurchaseOptions {
  isPremium: boolean;
  markPremium: (value: boolean) => Promise<void>;
  source: PaywallSource;
  onPremiumActivated?: () => void;
}

async function finalizeTrackedPurchaseAttempt(
  activeAttemptIdRef: RefObject<string | null>,
  terminalEvent: PurchaseTerminalEvent,
  properties: Omit<AnalyticsEventMap['purchase_success'], 'attempt_id'>,
  errorCode?: string,
) {
  const pending = await getPendingPurchaseAttempt();
  const attemptId = activeAttemptIdRef.current ?? pending?.id;
  if (!attemptId) return false;
  const completed = await completePurchaseAttempt(attemptId, terminalEvent);
  if (!completed) return false;
  activeAttemptIdRef.current = null;
  const base = { ...properties, attempt_id: attemptId };
  if (terminalEvent === 'purchase_success') trackEvent('purchase_success', base);
  else if (terminalEvent === 'purchase_cancelled') trackEvent('purchase_cancelled', base);
  else trackEvent('purchase_failed', { ...base, error_code: errorCode ?? 'unknown' });
  return true;
}

export function useIapPurchase({
  isPremium,
  markPremium,
  source,
  onPremiumActivated,
}: UseIapPurchaseOptions) {
  const [purchaseInProgress, setPurchaseInProgress] = useState(false);
  const [restoreRequestedAt, setRestoreRequestedAt] = useState<number | null>(null);
  const activeAttemptIdRef = useRef<string | null>(null);

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
      await finalizeTrackedPurchaseAttempt(
        activeAttemptIdRef,
        'purchase_success',
        getPurchaseEventProps('purchase'),
      );
      try {
        await finishTransaction({ purchase, isConsumable: false });
      } catch {
        // Ignore finish errors; entitlement is still granted locally.
      }
      await markPremium(true);
      Alert.alert('Premium ativado', 'Anúncios removidos e exportação liberada.');
      onPremiumActivated?.();
    },
    onPurchaseError: async (error) => {
      const code = String(error.code ?? ErrorCode.Unknown);
      const terminalEvent =
        code === ErrorCode.UserCancelled ? 'purchase_cancelled' : 'purchase_failed';
      await finalizeTrackedPurchaseAttempt(
        activeAttemptIdRef,
        terminalEvent,
        getPurchaseEventProps('purchase'),
        code,
      );
      if (terminalEvent === 'purchase_failed') {
        Alert.alert('Erro', 'Não foi possível concluir a compra.');
      }
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
  const getPurchaseEventProps = useCallback(
    (flow: 'purchase' | 'restore') => ({
      source,
      flow,
      connected,
      store_ready: isStoreReady,
      product_loaded: !!product,
      is_premium: isPremium,
      price_label: priceLabel,
    }),
    [connected, isPremium, isStoreReady, priceLabel, product, source],
  );

  useEffect(() => {
    if (!connected) return;
    fetchProducts({ skus: [IAP_PRODUCT_ID], type: 'in-app' }).catch(() => {});
    getAvailablePurchases().catch(() => {});
  }, [connected, fetchProducts, getAvailablePurchases]);

  useEffect(() => {
    if (hasEntitlement && !isPremium) {
      markPremium(true).catch(() => {});
    }
  }, [hasEntitlement, isPremium, markPremium]);

  useEffect(() => {
    if (restoreRequestedAt === null) return;
    if (hasEntitlement) {
      trackEvent('purchase_restore_success', getPurchaseEventProps('restore'));
      markPremium(true)
        .then(() => Alert.alert('Restaurado', 'Compra restaurada com sucesso.'))
        .catch(() => {});
      setRestoreRequestedAt(null);
    }
  }, [restoreRequestedAt, hasEntitlement, getPurchaseEventProps, markPremium]);

  useEffect(() => {
    if (restoreRequestedAt === null) return;
    const timeout = setTimeout(() => {
      if (!hasEntitlement) {
        trackEvent('purchase_restore_empty', getPurchaseEventProps('restore'));
        Alert.alert('Nada para restaurar', 'Nenhuma compra encontrada.');
        setRestoreRequestedAt(null);
      }
    }, 2000);
    return () => clearTimeout(timeout);
  }, [restoreRequestedAt, hasEntitlement, getPurchaseEventProps]);

  const handlePurchase = useCallback(async () => {
    try {
      const nthView = await getPaywallViewCount();
      trackEvent('paywall_purchase_cta_clicked', { source, nth_view: nthView });
      if (!connected) {
        trackEvent('purchase_store_unavailable', getPurchaseEventProps('purchase'));
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
      const attempt = await createPurchaseAttempt(source, nthView);
      if (attempt.supersededAttempt) {
        trackEvent('purchase_failed', {
          ...getPurchaseEventProps('purchase'),
          attempt_id: attempt.supersededAttempt.id,
          error_code: 'superseded',
        });
      }
      activeAttemptIdRef.current = attempt.id;
      trackEvent('purchase_started', {
        ...getPurchaseEventProps('purchase'),
        attempt_id: attempt.id,
        nth_view: nthView,
      });
      setPurchaseInProgress(true);
      await requestPurchase({
        type: 'in-app',
        request: {
          ios: { sku: IAP_PRODUCT_ID },
          android: { skus: [IAP_PRODUCT_ID] },
        },
      });
    } catch (error) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String(error.code)
          : ErrorCode.Unknown;
      const terminalEvent =
        code === ErrorCode.UserCancelled ? 'purchase_cancelled' : 'purchase_failed';
      const completed = await finalizeTrackedPurchaseAttempt(
        activeAttemptIdRef,
        terminalEvent,
        getPurchaseEventProps('purchase'),
        code,
      );
      if (!completed || terminalEvent === 'purchase_failed') {
        Alert.alert('Erro', 'Não foi possível concluir a compra.');
      }
    } finally {
      setPurchaseInProgress(false);
    }
  }, [connected, getPurchaseEventProps, isPremium, product, requestPurchase, source]);

  const handleRestore = useCallback(async () => {
    try {
      trackEvent('purchase_restore_started', getPurchaseEventProps('restore'));
      if (!connected) {
        trackEvent('purchase_store_unavailable', getPurchaseEventProps('restore'));
        Alert.alert('Loja indisponível', 'Conecte-se à App Store/Google Play para restaurar.');
        return;
      }
      setRestoreRequestedAt(Date.now());
      await restorePurchases();
      await getAvailablePurchases();
    } catch {
      trackEvent('purchase_restore_failed', getPurchaseEventProps('restore'));
      Alert.alert('Erro', 'Não foi possível restaurar a compra.');
    }
  }, [connected, getAvailablePurchases, getPurchaseEventProps, restorePurchases]);

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
