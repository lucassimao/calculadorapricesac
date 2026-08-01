import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { endConnection, getAvailablePurchases, initConnection, type Purchase } from 'expo-iap';
import { IAP_PRODUCT_ID } from '../lib/iap';
import { useIapAvailability } from '../hooks/useIapAvailability';
import { syncPremiumAnalyticsStatus, trackEvent } from '../lib/analytics';

const PREMIUM_STATUS_KEY = '@calculadora-price-sac:premium:last_known:v1';
const PREMIUM_PURCHASE_DATE_KEY = '@calculadora-price-sac:premium:purchase_date:v1';

export type EntitlementState = 'entitled' | 'confirmed_absent' | 'indeterminate';

export async function loadLastKnownPremiumStatus() {
  return (await AsyncStorage.getItem(PREMIUM_STATUS_KEY)) === 'true';
}

export interface PremiumDiagnostics {
  entitlementState: EntitlementState;
  iapAvailability: 'checking' | 'supported' | 'unsupported';
  purchasedProductIds: string[];
  premiumPurchaseDetails: Record<string, string> | null;
  refreshAttemptedAt: string | null;
  refreshCompletedAt: string | null;
  refreshError: string | null;
}

export interface PremiumContextValue {
  isPremium: boolean;
  loading: boolean;
  markPremium: (value: boolean) => Promise<void>;
  refreshEntitlement: () => Promise<void>;
  diagnostics: PremiumDiagnostics;
}

const PremiumContext = createContext<PremiumContextValue | null>(null);

export function hasPremiumEntitlement(purchases: Purchase[]): boolean {
  return purchases.some((purchase) => purchase.productId === IAP_PRODUCT_ID);
}

function formatTimestamp(value?: number | null) {
  if (!value) return null;
  return new Date(value).toISOString();
}

export function getPremiumPurchaseDetails(purchases: Purchase[]) {
  const premiumPurchase = purchases.find((purchase) => purchase.productId === IAP_PRODUCT_ID);

  if (!premiumPurchase) {
    return null;
  }

  return {
    productId: premiumPurchase.productId,
    store: premiumPurchase.store ? String(premiumPurchase.store) : '(none)',
    transactionId:
      'transactionId' in premiumPurchase && premiumPurchase.transactionId
        ? premiumPurchase.transactionId
        : '(none)',
    transactionDate: formatTimestamp(premiumPurchase.transactionDate) ?? '(none)',
    purchaseToken: premiumPurchase.purchaseToken ?? '(none)',
    purchaseState: premiumPurchase.purchaseState ?? '(none)',
    currentPlanId: premiumPurchase.currentPlanId ?? '(none)',
    environmentIOS:
      'environmentIOS' in premiumPurchase ? (premiumPurchase.environmentIOS ?? '(none)') : '(n/a)',
    originalTransactionIdentifierIOS:
      'originalTransactionIdentifierIOS' in premiumPurchase
        ? (premiumPurchase.originalTransactionIdentifierIOS ?? '(none)')
        : '(n/a)',
    originalTransactionDateIOS:
      'originalTransactionDateIOS' in premiumPurchase
        ? (formatTimestamp(premiumPurchase.originalTransactionDateIOS) ?? '(none)')
        : '(n/a)',
    ownershipTypeIOS:
      'ownershipTypeIOS' in premiumPurchase
        ? (premiumPurchase.ownershipTypeIOS ?? '(none)')
        : '(n/a)',
    appBundleIdIOS:
      'appBundleIdIOS' in premiumPurchase ? (premiumPurchase.appBundleIdIOS ?? '(none)') : '(n/a)',
  };
}

export function PremiumProvider({ children }: { children: React.ReactNode }) {
  const iapAvailability = useIapAvailability();
  const connectedRef = useRef(false);
  const isPremiumRef = useRef(false);
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);
  const [purchasedProductIds, setPurchasedProductIds] = useState<string[]>([]);
  const [premiumPurchaseDetails, setPremiumPurchaseDetails] = useState<Record<
    string,
    string
  > | null>(null);
  const [refreshAttemptedAt, setRefreshAttemptedAt] = useState<string | null>(null);
  const [refreshCompletedAt, setRefreshCompletedAt] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [entitlementState, setEntitlementState] = useState<EntitlementState>('indeterminate');

  const applyKnownPremiumStatus = useCallback(async (value: boolean) => {
    isPremiumRef.current = value;
    setIsPremium(value);
    await AsyncStorage.setItem(PREMIUM_STATUS_KEY, String(value));
    if (value) {
      const existingPurchaseDate = await AsyncStorage.getItem(PREMIUM_PURCHASE_DATE_KEY);
      if (!existingPurchaseDate) {
        await AsyncStorage.setItem(PREMIUM_PURCHASE_DATE_KEY, String(Date.now()));
      }
    } else {
      await AsyncStorage.removeItem(PREMIUM_PURCHASE_DATE_KEY);
    }
    await syncPremiumAnalyticsStatus(value);
  }, []);

  const restoreLastKnownPremiumStatus = useCallback(async () => {
    if (await loadLastKnownPremiumStatus()) {
      isPremiumRef.current = true;
      setIsPremium(true);
      await syncPremiumAnalyticsStatus(true);
    }
  }, []);

  const ensureConnection = useCallback(async () => {
    if (iapAvailability !== 'supported') return false;
    if (connectedRef.current) return true;

    try {
      const result = await initConnection();
      connectedRef.current = result;
      return result;
    } catch {
      connectedRef.current = false;
      return false;
    }
  }, [iapAvailability]);

  const refreshEntitlement = useCallback(async () => {
    if (iapAvailability !== 'supported') {
      connectedRef.current = false;
      setEntitlementState('indeterminate');
      await restoreLastKnownPremiumStatus();
      setLoading(false);
      setPurchasedProductIds([]);
      setPremiumPurchaseDetails(null);
      setRefreshError(null);
      return;
    }

    setLoading(true);
    setRefreshAttemptedAt(new Date().toISOString());
    setRefreshError(null);

    try {
      const ready = await ensureConnection();

      if (!ready) {
        setEntitlementState('indeterminate');
        await restoreLastKnownPremiumStatus();
        setPurchasedProductIds([]);
        setPremiumPurchaseDetails(null);
        setRefreshError('store_connection_failed');
        return;
      }

      const purchases = await getAvailablePurchases();
      setPurchasedProductIds(purchases.map((purchase) => purchase.productId));
      setPremiumPurchaseDetails(getPremiumPurchaseDetails(purchases));
      const entitled = hasPremiumEntitlement(purchases);
      setEntitlementState(entitled ? 'entitled' : 'confirmed_absent');
      const wasPremium =
        isPremiumRef.current || (await AsyncStorage.getItem(PREMIUM_STATUS_KEY)) === 'true';
      if (!entitled && wasPremium) {
        const storedPurchaseDate = await AsyncStorage.getItem(PREMIUM_PURCHASE_DATE_KEY);
        const purchaseDate = storedPurchaseDate
          ? Number.parseInt(storedPurchaseDate, 10)
          : Date.now();
        trackEvent('premium_status_lost', {
          days_since_purchase: Math.max(
            0,
            Math.floor((Date.now() - purchaseDate) / (24 * 60 * 60 * 1000)),
          ),
        });
      }
      await applyKnownPremiumStatus(entitled);
    } catch {
      setEntitlementState('indeterminate');
      await restoreLastKnownPremiumStatus();
      setPurchasedProductIds([]);
      setPremiumPurchaseDetails(null);
      setRefreshError('get_available_purchases_failed');
    } finally {
      setLoading(false);
      setRefreshCompletedAt(new Date().toISOString());
    }
  }, [applyKnownPremiumStatus, ensureConnection, iapAvailability, restoreLastKnownPremiumStatus]);

  useEffect(() => {
    if (iapAvailability === 'checking') {
      setLoading(true);
      return;
    }

    if (iapAvailability === 'unsupported') {
      connectedRef.current = false;
      setEntitlementState('indeterminate');
      setLoading(false);
      setPurchasedProductIds([]);
      setPremiumPurchaseDetails(null);
      setRefreshError(null);
      void restoreLastKnownPremiumStatus();
      return;
    }

    void refreshEntitlement();
  }, [iapAvailability, refreshEntitlement, restoreLastKnownPremiumStatus]);

  useEffect(() => {
    return () => {
      connectedRef.current = false;
      void endConnection().catch(() => {});
    };
  }, []);

  const markPremium = useCallback(
    async (value: boolean) => {
      setEntitlementState(value ? 'entitled' : 'confirmed_absent');
      await applyKnownPremiumStatus(value);
    },
    [applyKnownPremiumStatus],
  );

  const value = useMemo<PremiumContextValue>(
    () => ({
      isPremium,
      loading,
      markPremium,
      refreshEntitlement,
      diagnostics: {
        entitlementState,
        iapAvailability,
        purchasedProductIds,
        premiumPurchaseDetails,
        refreshAttemptedAt,
        refreshCompletedAt,
        refreshError,
      },
    }),
    [
      iapAvailability,
      entitlementState,
      isPremium,
      loading,
      markPremium,
      purchasedProductIds,
      premiumPurchaseDetails,
      refreshAttemptedAt,
      refreshCompletedAt,
      refreshEntitlement,
      refreshError,
    ],
  );

  return <PremiumContext.Provider value={value}>{children}</PremiumContext.Provider>;
}

export function usePremiumContext() {
  const context = useContext(PremiumContext);

  if (!context) {
    throw new Error('usePremiumContext must be used within a PremiumProvider');
  }

  return context;
}
