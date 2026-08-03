import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Scenario } from '@loan-engine/loan';
import { loadScenarios, saveScenarios } from '../storage/scenarios';

const storage = vi.hoisted(() => new Map<string, string>());

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    clear: async () => storage.clear(),
    getItem: async (key: string) => storage.get(key) ?? null,
    setItem: async (key: string, value: string) => storage.set(key, value),
    removeItem: async (key: string) => storage.delete(key),
  },
}));

describe('scenario storage', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('round-trips the existing-contract next due date as a Date', async () => {
    const scenario: Scenario = {
      id: 'existing',
      name: 'Contrato atual',
      system: 'PRICE',
      loanMode: 'standard',
      principal: 180_000,
      rate: 0.8,
      rateType: 'monthly',
      term: 120,
      termUnit: 'months',
      startDate: new Date(2026, 8, 10),
      dueDay: 10,
      entryMode: 'existing_contract',
      nextDueDate: new Date(2026, 9, 10),
      prepayments: [],
      fgtsEvents: [],
    };

    await saveScenarios([scenario]);
    const [loaded] = await loadScenarios();

    expect(loaded.entryMode).toBe('existing_contract');
    expect(loaded.startDate).toEqual(scenario.startDate);
    expect(loaded.nextDueDate).toEqual(scenario.nextDueDate);
    expect(loaded.nextDueDate).toBeInstanceOf(Date);
  });
});
