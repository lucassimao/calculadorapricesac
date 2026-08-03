import { describe, expect, it } from 'vitest';
import { generateAmortizationSchedule } from '@loan-engine/calculations';
import { createExistingContractScenario, getScenarioEntryMode } from '../existing-contract';

describe('existing-contract scenario conversion', () => {
  it('uses the current balance, remaining installments and exact next due date', () => {
    const nextDueDate = new Date(2026, 2, 31);
    const scenario = createExistingContractScenario({
      id: 'existing-1',
      name: 'Meu contrato atual',
      system: 'SAC',
      currentBalance: 247_350.42,
      rate: 11.5,
      rateType: 'annual',
      remainingInstallments: 217,
      nextDueDate,
    });

    expect(scenario).toMatchObject({
      id: 'existing-1',
      name: 'Meu contrato atual',
      system: 'SAC',
      loanMode: 'standard',
      principal: 247_350.42,
      rate: 11.5,
      rateType: 'annual',
      term: 217,
      termUnit: 'months',
      dueDay: 31,
      entryMode: 'existing_contract',
      nextDueDate,
      includeIOF: false,
      includeOpeningFee: false,
    });
    expect(scenario.startDate).toEqual(new Date(2026, 1, 28));
    expect(getScenarioEntryMode(scenario)).toBe('existing_contract');
  });

  it('keeps optional monthly costs and index data without adding original-loan costs', () => {
    const scenario = createExistingContractScenario({
      id: 'existing-2',
      name: 'Contrato indexado',
      system: 'PRICE',
      currentBalance: 180_000,
      rate: 0.8,
      rateType: 'monthly',
      remainingInstallments: 120,
      nextDueDate: new Date(2026, 9, 10),
      insuranceRate: 0.025,
      adminFeeRate: 0.01,
      indexType: 'TR',
      indexRate: 0.12,
    });

    expect(scenario).toMatchObject({
      includeInsurance: true,
      mipRate: 0.025,
      includeAdminFee: true,
      adminFeeRate: 0.01,
      indexType: 'TR',
      indexRate: 0.12,
      includeIOF: false,
      iofRate: 0,
      includeOpeningFee: false,
      openingFee: 0,
    });
    expect(generateAmortizationSchedule(scenario)[1]?.adminFee).toBeCloseTo(18.02, 2);
  });

  it('keeps legacy scenarios in new-loan analytics mode', () => {
    expect(getScenarioEntryMode({ entryMode: undefined })).toBe('new_loan');
  });

  it('keeps a next installment on the last calendar day as a month-end contract', () => {
    const scenario = createExistingContractScenario({
      id: 'month-end',
      name: 'Vencimento no fim do mês',
      system: 'PRICE',
      currentBalance: 100_000,
      rate: 1,
      rateType: 'monthly',
      remainingInstallments: 3,
      nextDueDate: new Date(2027, 1, 28),
    });

    expect(scenario.dueDay).toBe(31);
    expect(scenario.startDate).toEqual(new Date(2027, 0, 31));
  });

  it('keeps a due date on day 30 when that happens to be the end of a short month', () => {
    const scenario = createExistingContractScenario({
      id: 'day-30',
      name: 'Vencimento dia 30',
      system: 'PRICE',
      currentBalance: 100_000,
      rate: 1,
      rateType: 'monthly',
      remainingInstallments: 3,
      nextDueDate: new Date(2027, 3, 30),
    });

    expect(scenario.dueDay).toBe(30);
    expect(scenario.startDate).toEqual(new Date(2027, 2, 30));
  });
});
