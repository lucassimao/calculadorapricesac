import { describe, expect, it } from 'vitest';
import { generateAmortizationSchedule } from '@loan-engine/calculations';
import { createExistingContractScenario } from '../existing-contract';
import {
  calculatePortabilityComparison,
  compareNominalCashFlows,
  createPortabilityScenario,
  parsePortabilityProposalInputs,
} from '../portability';

describe('loan portability comparison', () => {
  it('counts one-time costs once and finds the first nominal break-even month', () => {
    const result = compareNominalCashFlows([1_000, 1_000, 1_000], [800, 800, 800], 300);

    expect(result.currentTotalCost).toBe(3_000);
    expect(result.newTotalCost).toBe(2_700);
    expect(result.totalSavings).toBe(300);
    expect(result.monthlyPaymentDelta).toBe(-200);
    expect(result.breakEvenMonth).toBe(2);
  });

  it('reports no break-even when cumulative monthly savings never repay the costs', () => {
    const result = compareNominalCashFlows([1_000, 1_000, 1_000], [800, 800, 800], 700);

    expect(result.newTotalCost).toBe(3_100);
    expect(result.totalSavings).toBe(-100);
    expect(result.breakEvenMonth).toBeNull();
    expect(result.recommendation).toContain('manter o contrato atual');
  });

  it('reports the first month as break-even when there are no portability costs', () => {
    const result = compareNominalCashFlows([1_000], [800], 0);

    expect(result.breakEvenMonth).toBe(1);
  });

  it('rejects negative costs and invalid monthly payments', () => {
    expect(() => compareNominalCashFlows([1_000], [800], -1)).toThrow(
      'Custos da portabilidade inválidos',
    );
    expect(() => compareNominalCashFlows([Number.NaN], [800], 0)).toThrow('Fluxo mensal inválido');
  });

  it('parses a masked pt-BR portability cost without dropping its value', () => {
    expect(
      parsePortabilityProposalInputs({
        rateText: '8,5',
        rateType: 'annual',
        termText: '180',
        costsText: 'R$ 2.000,50',
      }),
    ).toEqual({ rate: 8.5, rateType: 'annual', term: 180, costs: 2_000.5 });
  });

  it('builds the new nominal path from the current balance with the same monthly fees', () => {
    const current = createExistingContractScenario({
      id: 'existing',
      name: 'Contrato atual',
      system: 'SAC',
      currentBalance: 120_000,
      rate: 1,
      rateType: 'monthly',
      remainingInstallments: 24,
      nextDueDate: new Date(2026, 7, 20),
      insuranceRate: 0.02,
      adminFeeRate: 0.01,
    });
    current.prepayments = [
      {
        id: 'planned-extra',
        date: new Date(2026, 8, 20),
        amount: 5_000,
        type: 'fixed_amount',
        strategy: 'reduce_term',
      },
    ];

    const proposal = createPortabilityScenario(current, {
      rate: 0.7,
      rateType: 'monthly',
      term: 18,
      costs: 1_500,
    });

    expect(proposal).toMatchObject({
      system: 'SAC',
      principal: 120_000,
      rate: 0.7,
      rateType: 'monthly',
      term: 18,
      termUnit: 'months',
      entryMode: 'existing_contract',
      includeInsurance: true,
      mipRate: 0.02,
      includeAdminFee: true,
      adminFeeRate: 0.01,
      prepayments: [],
      fgtsEvents: [],
    });
    expect(proposal.nextDueDate).toEqual(current.nextDueDate);
  });

  it('keeps the current index assumption on the new proposal', () => {
    const current = createExistingContractScenario({
      id: 'indexed',
      name: 'Contrato indexado',
      system: 'SAC',
      currentBalance: 120_000,
      rate: 10,
      rateType: 'annual',
      remainingInstallments: 24,
      nextDueDate: new Date(2026, 7, 20),
      indexType: 'IPCA',
      indexRate: 0.4,
    });

    const proposal = createPortabilityScenario(current, {
      rate: 8,
      rateType: 'annual',
      term: 24,
      costs: 0,
    });

    expect(proposal.indexType).toBe('IPCA');
    expect(proposal.indexRate).toBe(0.4);
  });

  it('compares engine schedules including current monthly insurance and admin fees', () => {
    const current = createExistingContractScenario({
      id: 'existing',
      name: 'Contrato atual',
      system: 'PRICE',
      currentBalance: 100_000,
      rate: 1,
      rateType: 'monthly',
      remainingInstallments: 24,
      nextDueDate: new Date(2026, 7, 20),
      insuranceRate: 0.02,
      adminFeeRate: 0.01,
    });

    const result = calculatePortabilityComparison(current, {
      rate: 0.6,
      rateType: 'monthly',
      term: 24,
      costs: 1_000,
    });
    const currentSchedule = generateAmortizationSchedule(current);
    const firstCurrentRow = currentSchedule.find((row) => row.installmentNumber === 1)!;

    expect(result.currentFirstPayment).toBe(firstCurrentRow.totalCost);
    expect(result.currentFirstPayment).toBeGreaterThan(firstCurrentRow.payment);
    expect(result.newTotalCost).toBeGreaterThan(
      result.newMonthlyPayments.reduce((a, b) => a + b, 0),
    );
    expect(result.newTotalCost).toBeCloseTo(
      result.newMonthlyPayments.reduce((a, b) => a + b, 0) + 1_000,
      2,
    );
    expect(result.totalSavings).toBeGreaterThan(0);
    expect(result.breakEvenMonth).not.toBeNull();
    expect(result.recommendation).toContain('portabilidade');
  });

  it('does not invent savings when rate, term, fees, system, and index are identical', () => {
    const current = createExistingContractScenario({
      id: 'same-proposal',
      name: 'Contrato atual',
      system: 'PRICE',
      currentBalance: 100_000,
      rate: 10.5,
      rateType: 'annual',
      remainingInstallments: 120,
      nextDueDate: new Date(2026, 7, 20),
      insuranceRate: 0.03,
      adminFeeRate: 0.008,
      indexType: 'IPCA',
      indexRate: 0.4,
    });

    const result = calculatePortabilityComparison(current, {
      rate: 10.5,
      rateType: 'annual',
      term: 120,
      costs: 0,
    });

    expect(result.newMonthlyPayments).toEqual(result.currentMonthlyPayments);
    expect(result.totalSavings).toBe(0);
  });

  it('keeps split MIP, DFI, property basis, and fixed admin fee symmetric', () => {
    const current = createExistingContractScenario({
      id: 'split-insurance',
      name: 'Contrato atual',
      system: 'PRICE',
      currentBalance: 100_000,
      rate: 0.8,
      rateType: 'monthly',
      remainingInstallments: 24,
      nextDueDate: new Date(2026, 7, 20),
      borrowerAge: 38,
      mipRate: 0.02,
      dfiRate: 0.01,
      adminFee: 25,
    });
    current.propertyValue = 200_000;

    const result = calculatePortabilityComparison(current, {
      rate: 0.8,
      rateType: 'monthly',
      term: 24,
      costs: 0,
    });

    expect(result.proposalScenario.propertyValue).toBe(200_000);
    expect(result.proposalScenario.mipRate).toBe(0.02);
    expect(result.proposalScenario.dfiRate).toBe(0.01);
    expect(result.proposalScenario.adminFee).toBe(25);
    expect(result.newMonthlyPayments).toEqual(result.currentMonthlyPayments);
  });

  it('accepts a zero-interest portability proposal supported by the engine', () => {
    expect(
      parsePortabilityProposalInputs({
        rateText: '0',
        rateType: 'monthly',
        termText: '12',
        costsText: '',
      }),
    ).toEqual({ rate: 0, rateType: 'monthly', term: 12, costs: 0 });
  });

  it('compares the contractual current path without planned prepayment or FGTS simulations', () => {
    const current = createExistingContractScenario({
      id: 'existing-with-plan',
      name: 'Contrato atual',
      system: 'SAC',
      currentBalance: 100_000,
      rate: 1,
      rateType: 'monthly',
      remainingInstallments: 24,
      nextDueDate: new Date(2026, 7, 20),
    });
    current.prepayments = [
      {
        id: 'planned-extra',
        date: new Date(2026, 9, 20),
        amount: 20_000,
        type: 'fixed_amount',
        strategy: 'reduce_term',
      },
    ];
    const contractualSchedule = generateAmortizationSchedule({
      ...current,
      prepayments: [],
      fgtsEvents: [],
    });

    const result = calculatePortabilityComparison(current, {
      rate: 0.8,
      rateType: 'monthly',
      term: 24,
      costs: 1_000,
    });

    expect(result.currentMonthlyPayments[2]).toBe(contractualSchedule[3].totalCost);
    expect(result.currentMonthlyPayments[2]).toBeLessThan(20_000);
  });
});
