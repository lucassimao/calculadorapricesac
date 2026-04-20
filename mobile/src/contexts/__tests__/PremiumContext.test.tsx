import React, { useEffect } from 'react';
import { Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PremiumProvider,
  getPremiumPurchaseDetails,
  hasPremiumEntitlement,
  type PremiumContextValue,
  usePremiumContext,
} from '../PremiumContext';

const state = {
  availability: 'supported' as 'checking' | 'supported' | 'unsupported',
  initConnectionResult: true,
  purchases: [] as Array<{ productId: string }>,
};

const initConnectionMock = vi.fn(async () => state.initConnectionResult);
const endConnectionMock = vi.fn(async () => undefined);
const getAvailablePurchasesMock = vi.fn(async () => state.purchases);

vi.mock('expo-iap', () => ({
  endConnection: () => endConnectionMock(),
  getAvailablePurchases: () => getAvailablePurchasesMock(),
  initConnection: () => initConnectionMock(),
}));

vi.mock('../../hooks/useIapAvailability', () => ({
  useIapAvailability: () => state.availability,
}));

function PremiumProbe({ onSnapshot }: { onSnapshot: (value: PremiumContextValue) => void }) {
  const premium = usePremiumContext();

  useEffect(() => {
    onSnapshot(premium);
  }, [onSnapshot, premium]);

  return null;
}

function PremiumStatusText() {
  const { isPremium, loading } = usePremiumContext();

  return <Text>{loading ? 'premium-loading' : isPremium ? 'premium-ready' : 'premium-free'}</Text>;
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('PremiumProvider', () => {
  beforeEach(() => {
    state.availability = 'supported';
    state.initConnectionResult = true;
    state.purchases = [];
    endConnectionMock.mockClear();
    getAvailablePurchasesMock.mockClear();
    initConnectionMock.mockClear();
  });

  it('detects premium entitlement from non-consumable purchases', () => {
    expect(hasPremiumEntitlement([] as never[])).toBe(false);
    expect(hasPremiumEntitlement([{ productId: 'other_sku' }] as never[])).toBe(false);
    expect(hasPremiumEntitlement([{ productId: 'remove_ads' }] as never[])).toBe(true);
  });

  it('extracts detailed diagnostics for the premium entitlement purchase', () => {
    const details = getPremiumPurchaseDetails([
      {
        productId: 'remove_ads',
        store: 'app-store',
        purchaseState: 'purchased',
        purchaseToken: 'token-123',
        transactionDate: Date.parse('2026-04-20T13:49:10.000Z'),
        transactionId: 'tx-123',
        currentPlanId: 'remove_ads',
        environmentIOS: 'Sandbox',
        originalTransactionIdentifierIOS: 'orig-tx-1',
        originalTransactionDateIOS: Date.parse('2026-04-19T13:49:10.000Z'),
        ownershipTypeIOS: 'PURCHASED',
        appBundleIdIOS: 'com.lsimaocosta.calculadorapricesac',
      },
    ] as never[]);

    expect(details).toEqual({
      productId: 'remove_ads',
      store: 'app-store',
      transactionId: 'tx-123',
      transactionDate: '2026-04-20T13:49:10.000Z',
      purchaseToken: 'token-123',
      purchaseState: 'purchased',
      currentPlanId: 'remove_ads',
      environmentIOS: 'Sandbox',
      originalTransactionIdentifierIOS: 'orig-tx-1',
      originalTransactionDateIOS: '2026-04-19T13:49:10.000Z',
      ownershipTypeIOS: 'PURCHASED',
      appBundleIdIOS: 'com.lsimaocosta.calculadorapricesac',
    });
  });

  it('marks the user as free when IAP is unsupported', async () => {
    state.availability = 'unsupported';

    let snapshot: PremiumContextValue | null = null;

    await act(async () => {
      create(
        <PremiumProvider>
          <PremiumProbe onSnapshot={(value) => (snapshot = value)} />
        </PremiumProvider>,
      );
    });

    expect(snapshot?.loading).toBe(false);
    expect(snapshot?.isPremium).toBe(false);
    expect(initConnectionMock).not.toHaveBeenCalled();
    expect(getAvailablePurchasesMock).not.toHaveBeenCalled();
  });

  it('loads the entitlement from the store on startup', async () => {
    state.purchases = [{ productId: 'remove_ads' }];

    let snapshot: PremiumContextValue | null = null;

    await act(async () => {
      create(
        <PremiumProvider>
          <PremiumProbe onSnapshot={(value) => (snapshot = value)} />
        </PremiumProvider>,
      );
    });

    await flushEffects();

    expect(initConnectionMock).toHaveBeenCalledTimes(1);
    expect(getAvailablePurchasesMock).toHaveBeenCalledTimes(1);
    expect(snapshot?.loading).toBe(false);
    expect(snapshot?.isPremium).toBe(true);
    expect(snapshot?.diagnostics.iapAvailability).toBe('supported');
    expect(snapshot?.diagnostics.purchasedProductIds).toEqual(['remove_ads']);
    expect(snapshot?.diagnostics.premiumPurchaseDetails).toMatchObject({
      productId: 'remove_ads',
    });
    expect(snapshot?.diagnostics.refreshAttemptedAt).not.toBeNull();
    expect(snapshot?.diagnostics.refreshCompletedAt).not.toBeNull();
    expect(snapshot?.diagnostics.refreshError).toBeNull();
  });

  it('renders premium UI state on cold start when store entitlement exists', async () => {
    state.purchases = [{ productId: 'remove_ads' }];

    let renderer: ReactTestRenderer;

    await act(async () => {
      renderer = create(
        <PremiumProvider>
          <PremiumStatusText />
        </PremiumProvider>,
      );
    });

    await flushEffects();

    const premiumLabels = renderer!.root.findAll(
      (node) => node.type === 'Text' && node.props.children === 'premium-ready',
    );

    expect(initConnectionMock).toHaveBeenCalledTimes(1);
    expect(getAvailablePurchasesMock).toHaveBeenCalledTimes(1);
    expect(premiumLabels).toHaveLength(1);
  });

  it('does not persist optimistic premium state across remounts', async () => {
    state.purchases = [];

    let snapshot: PremiumContextValue | null = null;
    let renderer: ReactTestRenderer;

    await act(async () => {
      renderer = create(
        <PremiumProvider>
          <PremiumProbe onSnapshot={(value) => (snapshot = value)} />
        </PremiumProvider>,
      );
    });

    await flushEffects();
    expect(snapshot?.isPremium).toBe(false);

    await act(async () => {
      await snapshot?.markPremium(true);
    });
    expect(snapshot?.isPremium).toBe(true);

    await act(async () => {
      renderer!.unmount();
    });

    snapshot = null;

    await act(async () => {
      create(
        <PremiumProvider>
          <PremiumProbe onSnapshot={(value) => (snapshot = value)} />
        </PremiumProvider>,
      );
    });

    await flushEffects();

    expect(snapshot?.loading).toBe(false);
    expect(snapshot?.isPremium).toBe(false);
  });

  it('falls back to free mode when the store connection fails', async () => {
    state.initConnectionResult = false;

    let snapshot: PremiumContextValue | null = null;

    await act(async () => {
      create(
        <PremiumProvider>
          <PremiumProbe onSnapshot={(value) => (snapshot = value)} />
        </PremiumProvider>,
      );
    });

    await flushEffects();

    expect(initConnectionMock).toHaveBeenCalledTimes(1);
    expect(getAvailablePurchasesMock).not.toHaveBeenCalled();
    expect(snapshot?.loading).toBe(false);
    expect(snapshot?.isPremium).toBe(false);
    expect(snapshot?.diagnostics.purchasedProductIds).toEqual([]);
    expect(snapshot?.diagnostics.premiumPurchaseDetails).toBeNull();
    expect(snapshot?.diagnostics.refreshError).toBe('store_connection_failed');
  });
});
