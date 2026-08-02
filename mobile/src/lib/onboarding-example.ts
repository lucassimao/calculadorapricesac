import type { Scenario } from '@loan-engine/loan';

export const ONBOARDING_EXAMPLE_VERSION = 1;

export function createOnboardingExampleScenario(startDate = new Date()): Scenario {
  return {
    id: `onboarding-example-v${ONBOARDING_EXAMPLE_VERSION}`,
    name: 'Exemplo: imóvel de R$ 400 mil',
    system: 'SAC',
    loanMode: 'property',
    propertyValue: 400_000,
    downPayment: 80_000,
    principal: 320_000,
    // example-rate reviewed 2026-08
    rate: 11.5,
    rateType: 'annual',
    term: 360,
    termUnit: 'months',
    startDate,
    dueDay: 5,
    prepayments: [],
  };
}

export function isOnboardingExampleScenario(current: Scenario, example: Scenario) {
  return JSON.stringify(current) === JSON.stringify(example);
}
