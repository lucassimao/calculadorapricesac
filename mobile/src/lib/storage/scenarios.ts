import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FgtsEvent, PrepaymentEvent, Scenario } from '@loan-engine/loan';

const STORAGE_KEY = 'scenarios:v1';
export const CURRENT_SCENARIO_SCHEMA_VERSION = 2 as const;

type StoredScenario = Omit<Scenario, 'startDate' | 'nextDueDate' | 'prepayments' | 'fgtsEvents'> & {
  startDate: string;
  nextDueDate?: string;
  prepayments?: (Omit<PrepaymentEvent, 'date'> & { date: string })[];
  fgtsEvents?: (Omit<FgtsEvent, 'date'> & { date: string })[];
};

const toStoredScenario = (scenario: Scenario): StoredScenario => {
  const serializedDates = {
    startDate: scenario.startDate.toISOString(),
    nextDueDate: scenario.nextDueDate?.toISOString(),
    prepayments: scenario.prepayments?.map((p) => ({
      ...p,
      date: p.date.toISOString(),
    })),
    fgtsEvents: scenario.fgtsEvents?.map((event) => ({
      ...event,
      date: event.date.toISOString(),
    })),
  };

  if ((scenario.schemaVersion ?? 0) > CURRENT_SCENARIO_SCHEMA_VERSION) {
    return {
      ...scenario,
      ...serializedDates,
    };
  }

  const { insuranceRate: _legacyInsuranceRate, ...currentScenario } = scenario;
  return {
    ...currentScenario,
    schemaVersion: CURRENT_SCENARIO_SCHEMA_VERSION,
    mipRate: currentScenario.mipRate ?? _legacyInsuranceRate ?? 0,
    dfiRate: currentScenario.dfiRate ?? 0,
    ...serializedDates,
  };
};

type LegacyStoredScenario = Omit<StoredScenario, 'schemaVersion'> & {
  schemaVersion?: number;
  insuranceRate?: number;
};

const migrateStoredScenario = (scenario: LegacyStoredScenario | StoredScenario): StoredScenario => {
  if (
    scenario.schemaVersion !== undefined &&
    scenario.schemaVersion >= CURRENT_SCENARIO_SCHEMA_VERSION
  ) {
    return scenario;
  }

  const { insuranceRate, ...rest } = scenario;
  return {
    ...rest,
    schemaVersion: CURRENT_SCENARIO_SCHEMA_VERSION,
    mipRate: scenario.mipRate ?? insuranceRate ?? 0,
    dfiRate: scenario.dfiRate ?? 0,
  };
};

const fromStoredScenario = (scenario: StoredScenario): Scenario => ({
  ...scenario,
  startDate: new Date(scenario.startDate),
  nextDueDate: scenario.nextDueDate ? new Date(scenario.nextDueDate) : undefined,
  prepayments: scenario.prepayments?.map((p) => ({
    ...p,
    date: new Date(p.date),
  })),
  fgtsEvents: scenario.fgtsEvents?.map((event) => ({
    ...event,
    date: new Date(event.date),
  })),
});

export async function loadScenarios(): Promise<Scenario[]> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  if (!stored) return [];
  const parsed = JSON.parse(stored) as (LegacyStoredScenario | StoredScenario)[];
  return parsed.map(migrateStoredScenario).map(fromStoredScenario);
}

export async function saveScenarios(scenarios: Scenario[]): Promise<void> {
  const futureScenario = scenarios.find(
    (scenario) => (scenario.schemaVersion ?? 0) > CURRENT_SCENARIO_SCHEMA_VERSION,
  );
  if (futureScenario) {
    throw new Error(
      `O cenário “${futureScenario.name}” foi salvo por uma versão mais nova do app; atualize o app antes de alterar a lista.`,
    );
  }
  const payload = JSON.stringify(scenarios.map(toStoredScenario));
  await AsyncStorage.setItem(STORAGE_KEY, payload);
}
