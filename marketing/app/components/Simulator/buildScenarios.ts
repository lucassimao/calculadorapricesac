import type { Scenario } from '@loan-engine/loan';
import type { SimulatorInputs } from './types';

function makeScenario(system: 'SAC' | 'PRICE', inputs: SimulatorInputs): Scenario {
  const principal = Math.max(inputs.propertyValue - inputs.downPayment, 0);
  return {
    id: `web-${system.toLowerCase()}`,
    name: system,
    system,
    loanMode: 'property',
    propertyValue: inputs.propertyValue,
    downPayment: inputs.downPayment,
    principal,
    rate: inputs.annualRate,
    rateType: 'annual',
    term: inputs.termYears,
    termUnit: 'years',
    startDate: new Date(2026, 0, 1),
    dueDay: 1,
  };
}

export function buildScenarios(inputs: SimulatorInputs): { sac: Scenario; price: Scenario } {
  return {
    sac: makeScenario('SAC', inputs),
    price: makeScenario('PRICE', inputs),
  };
}
