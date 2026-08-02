import { describe, expect, it } from 'vitest';
import {
  createOnboardingExampleScenario,
  isOnboardingExampleScenario,
} from '../onboarding-example';

describe('onboarding example', () => {
  it('builds the static reviewed property scenario without a network-backed index', () => {
    const startDate = new Date(2026, 7, 2);

    expect(createOnboardingExampleScenario(startDate)).toMatchObject({
      name: 'Exemplo: imóvel de R$ 400 mil',
      system: 'SAC',
      loanMode: 'property',
      propertyValue: 400_000,
      downPayment: 80_000,
      principal: 320_000,
      rate: 11.5,
      rateType: 'annual',
      term: 360,
      termUnit: 'months',
      startDate,
      prepayments: [],
    });
    expect(createOnboardingExampleScenario(startDate).indexType).toBeUndefined();
  });

  it('recognizes any scenario-field change so editing clears the chip', () => {
    const example = createOnboardingExampleScenario(new Date(2026, 7, 2));

    expect(isOnboardingExampleScenario({ ...example }, example)).toBe(true);
    expect(isOnboardingExampleScenario({ ...example, name: 'Meu cenário' }, example)).toBe(false);
  });
});
