/* eslint-disable import/first */
import React, { useEffect } from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { storage } = vi.hoisted(() => ({
  storage: new Map<string, string>(),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      storage.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      storage.delete(key);
    }),
  },
}));

vi.mock('../../lib/theme', () => ({
  useTheme: () => ({
    colors: {
      background: '#ffffff',
      border: '#d1d5db',
      text: '#111827',
      textSecondary: '#6b7280',
      primary: '#2563eb',
      backgroundSecondary: '#f3f4f6',
    },
  }),
}));

import { AdTestProvider, useAdTest, type AdTestContextValue } from '../AdTestContext';

function flushMicrotasks() {
  return Promise.resolve().then(() => Promise.resolve());
}

function Harness({ onChange }: { onChange: (value: ReturnType<typeof useAdTest>) => void }) {
  const value = useAdTest();

  useEffect(() => {
    onChange(value);
  }, [value, onChange]);

  return null;
}

describe('AdTestProvider', () => {
  let renderer: ReactTestRenderer | null = null;
  let latestValue: AdTestContextValue | null = null;

  function getLatestValue() {
    if (!latestValue) throw new Error('AdTest context was not captured');
    return latestValue;
  }

  async function renderProvider() {
    await act(async () => {
      renderer = TestRenderer.create(
        React.createElement(AdTestProvider, null, [
          React.createElement(Harness, {
            key: 'harness',
            onChange: (value) => {
              latestValue = value;
            },
          }),
        ]),
      );
      await flushMicrotasks();
    });
  }

  beforeEach(() => {
    storage.clear();
    latestValue = null;
  });

  afterEach(async () => {
    await act(async () => {
      renderer?.unmount();
      await flushMicrotasks();
    });
    renderer = null;
  });

  it('persists the stub configuration and hydrates it on the next mount', async () => {
    await renderProvider();

    await act(async () => {
      await getLatestValue().setStubModeEnabled(true);
      await getLatestValue().setInterstitialStubEnabled(true);
      await flushMicrotasks();
    });

    expect(getLatestValue().stubModeEnabled).toBe(true);
    expect(getLatestValue().interstitialStubEnabled).toBe(true);

    await act(async () => {
      renderer?.unmount();
      await flushMicrotasks();
    });

    latestValue = null;
    renderer = null;

    await renderProvider();

    expect(getLatestValue().stubModeEnabled).toBe(true);
    expect(getLatestValue().interstitialStubEnabled).toBe(true);
  });

  it('resolves rewarded and interstitial stub flows through the rendered modal actions', async () => {
    await renderProvider();

    await act(async () => {
      await getLatestValue().setStubModeEnabled(true);
      await getLatestValue().setInterstitialStubEnabled(true);
      await flushMicrotasks();
    });

    let rewardedResult: Promise<'earned' | 'cancelled' | 'error' | false> | undefined;
    await act(async () => {
      rewardedResult = getLatestValue().showRewardedStub();
      await flushMicrotasks();
    });

    const finishRewardedButton = renderer?.root.findByProps({
      accessibilityLabel: 'Concluir anúncio',
    });

    await act(async () => {
      finishRewardedButton?.props.onPress();
      await flushMicrotasks();
    });

    await expect(rewardedResult).resolves.toBe('earned');

    let interstitialResult: Promise<boolean> | undefined;
    await act(async () => {
      interstitialResult = getLatestValue().showInterstitialStub();
      await flushMicrotasks();
    });

    const closeInterstitialButton = renderer?.root.findByProps({
      accessibilityLabel: 'Fechar anúncio',
    });

    await act(async () => {
      closeInterstitialButton?.props.onPress();
      await flushMicrotasks();
    });

    await expect(interstitialResult).resolves.toBe(true);
  });
});
