import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FgtsEvent, PrepaymentEvent, Scenario } from '@loan-engine/loan';

const STORAGE_KEY = 'scenarios:v1';

type StoredScenario = Omit<Scenario, 'startDate' | 'prepayments' | 'fgtsEvents'> & {
  startDate: string;
  prepayments?: (Omit<PrepaymentEvent, 'date'> & { date: string })[];
  fgtsEvents?: (Omit<FgtsEvent, 'date'> & { date: string })[];
};

const toStoredScenario = (scenario: Scenario): StoredScenario => ({
  ...scenario,
  startDate: scenario.startDate.toISOString(),
  prepayments: scenario.prepayments?.map((p) => ({
    ...p,
    date: p.date.toISOString(),
  })),
  fgtsEvents: scenario.fgtsEvents?.map((event) => ({
    ...event,
    date: event.date.toISOString(),
  })),
});

const fromStoredScenario = (scenario: StoredScenario): Scenario => ({
  ...scenario,
  startDate: new Date(scenario.startDate),
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
  const parsed = JSON.parse(stored) as StoredScenario[];
  return parsed.map(fromStoredScenario);
}

export async function saveScenarios(scenarios: Scenario[]): Promise<void> {
  const payload = JSON.stringify(scenarios.map(toStoredScenario));
  await AsyncStorage.setItem(STORAGE_KEY, payload);
}
