import AsyncStorage from '@react-native-async-storage/async-storage';
import { readFileSync } from 'node:fs';
import path from 'node:path';
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

  it('migrates a schema-less stored fixture from insuranceRate to schema v2 MIP/DFI', async () => {
    const fixture = readFileSync(
      path.join(__dirname, 'fixtures', 'stored-scenario-v1.json'),
      'utf-8',
    );
    await AsyncStorage.setItem('scenarios:v1', fixture);

    const [loaded] = await loadScenarios();

    expect(loaded.schemaVersion).toBe(2);
    expect(loaded.mipRate).toBe(0.031);
    expect(loaded.dfiRate).toBe(0);
    expect(loaded.insuranceRate).toBeUndefined();
    expect(loaded.adminFeeRate).toBe(0.01);
    expect(loaded.adminFee).toBeUndefined();
  });

  it('keeps an already-v2 stored fixture stable', async () => {
    const fixture = readFileSync(
      path.join(__dirname, 'fixtures', 'stored-scenario-v2.json'),
      'utf-8',
    );
    await AsyncStorage.setItem('scenarios:v1', fixture);

    const [loaded] = await loadScenarios();

    expect(loaded.schemaVersion).toBe(2);
    expect(loaded.borrowerAge).toBe(42);
    expect(loaded.mipRate).toBe(0.0395);
    expect(loaded.dfiRate).toBe(0.006);
  });

  it('writes the current schema version into every saved scenario', async () => {
    const scenario: Scenario = {
      id: 'new-schema',
      name: 'Novo schema',
      system: 'SAC',
      principal: 100_000,
      rate: 1,
      rateType: 'monthly',
      term: 120,
      termUnit: 'months',
      startDate: new Date(2026, 0, 1),
      dueDay: 1,
      insuranceRate: 0.03,
    };

    await saveScenarios([scenario]);
    const stored = JSON.parse((await AsyncStorage.getItem('scenarios:v1')) ?? '[]');

    expect(stored[0].schemaVersion).toBe(2);
    expect(stored[0].insuranceRate).toBeUndefined();
    expect(stored[0].mipRate).toBe(0.03);
  });

  it('loads but refuses to overwrite a future stored schema', async () => {
    await AsyncStorage.setItem(
      'scenarios:v1',
      JSON.stringify([
        {
          schemaVersion: 3,
          id: 'future',
          name: 'Futuro',
          system: 'PRICE',
          principal: 100000,
          rate: 1,
          rateType: 'monthly',
          term: 12,
          termUnit: 'months',
          startDate: '2026-01-01T00:00:00.000Z',
          dueDay: 5,
          insuranceRate: 0.02,
          futureOnly: 'preserved',
        },
      ]),
    );

    const [loaded] = await loadScenarios();

    expect(loaded.schemaVersion).toBe(3);
    expect(loaded.insuranceRate).toBe(0.02);
    expect(loaded.mipRate).toBeUndefined();

    await expect(saveScenarios([loaded])).rejects.toThrow('versão mais nova');
    const preserved = JSON.parse((await AsyncStorage.getItem('scenarios:v1')) ?? '[]');
    expect(preserved[0].schemaVersion).toBe(3);
    expect(preserved[0].insuranceRate).toBe(0.02);
    expect(preserved[0].mipRate).toBeUndefined();
    expect(preserved[0].futureOnly).toBe('preserved');
  });

  it('preserves a disabled legacy insurance toggle during migration', async () => {
    await AsyncStorage.setItem(
      'scenarios:v1',
      JSON.stringify([
        {
          id: 'disabled-insurance',
          name: 'Sem seguro',
          system: 'SAC',
          principal: 100000,
          rate: 1,
          rateType: 'monthly',
          term: 12,
          termUnit: 'months',
          startDate: '2026-01-01T00:00:00.000Z',
          dueDay: 5,
          insuranceRate: 0.03,
          includeInsurance: false,
        },
      ]),
    );

    const [loaded] = await loadScenarios();
    expect(loaded.mipRate).toBe(0.03);
    expect(loaded.dfiRate).toBe(0);
    expect(loaded.includeInsurance).toBe(false);
  });

  it('migrates split insurance for a legacy existing contract', async () => {
    await AsyncStorage.setItem(
      'scenarios:v1',
      JSON.stringify([
        {
          id: 'existing-v1',
          name: 'Contrato antigo',
          system: 'PRICE',
          principal: 80000,
          rate: 1,
          rateType: 'monthly',
          term: 48,
          termUnit: 'months',
          startDate: '2026-01-01T00:00:00.000Z',
          nextDueDate: '2026-02-05T00:00:00.000Z',
          dueDay: 5,
          entryMode: 'existing_contract',
          insuranceRate: 0.025,
        },
      ]),
    );

    const [loaded] = await loadScenarios();
    expect(loaded.entryMode).toBe('existing_contract');
    expect(loaded.nextDueDate).toBeInstanceOf(Date);
    expect(loaded.mipRate).toBe(0.025);
    expect(loaded.dfiRate).toBe(0);
  });

  it('prefers an already-split MIP rate when a legacy record carries both fields', async () => {
    await AsyncStorage.setItem(
      'scenarios:v1',
      JSON.stringify([
        {
          id: 'both-rates',
          name: 'Duas taxas',
          system: 'SAC',
          principal: 100000,
          rate: 1,
          rateType: 'monthly',
          term: 12,
          termUnit: 'months',
          startDate: '2026-01-01T00:00:00.000Z',
          dueDay: 5,
          insuranceRate: 0.03,
          mipRate: 0.04,
        },
      ]),
    );

    const [loaded] = await loadScenarios();
    expect(loaded.mipRate).toBe(0.04);
  });
});
