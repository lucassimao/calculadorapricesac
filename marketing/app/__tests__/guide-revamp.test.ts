import { describe, expect, it } from 'vitest';
import {
  calculateLoanSummary,
  formatCetResult,
  formatCurrency,
  generateAmortizationSchedule,
} from '@loan-engine/calculations';
import type { Scenario } from '@loan-engine/loan';
import { metadata } from '../page';
import { guides, referenceExample } from '../guias/content';

const referenceScenario: Scenario = {
  id: 'marketing-reference-test',
  name: 'Exemplo de referência',
  system: 'SAC',
  loanMode: 'property',
  propertyValue: 400_000,
  downPayment: 80_000,
  principal: 320_000,
  rate: 11.5,
  rateType: 'annual',
  term: 360,
  termUnit: 'months',
  startDate: new Date(2026, 0, 1),
  dueDay: 5,
};

function summaryFor(system: 'SAC' | 'PRICE') {
  const scenario = { ...referenceScenario, id: `marketing-reference-${system}`, system };
  return calculateLoanSummary(generateAmortizationSchedule(scenario), scenario);
}

describe('P3.5 guide content revamp', () => {
  it('computes the displayed reference example from the shared engine', () => {
    const sac = summaryFor('SAC');
    const price = summaryFor('PRICE');

    expect(referenceExample.sacFirstPayment).toBe(formatCurrency(sac.firstPayment));
    expect(referenceExample.sacLastPayment).toBe(formatCurrency(sac.lastPayment));
    expect(referenceExample.sacTotalInterest).toBe(formatCurrency(sac.totalInterest));
    expect(referenceExample.priceTotalInterest).toBe(formatCurrency(price.totalInterest));
    expect(referenceExample.sacCet).toBe(formatCetResult(sac.cet));
    expect(referenceExample.priceCet).toBe(formatCetResult(price.cet));
  });

  it('adds the computed example and screenshots to every guide', () => {
    expect(guides).toHaveLength(10);
    for (const guide of guides) {
      expect(guide.example).toBe(referenceExample);
      expect(guide.screenshots.length).toBeGreaterThanOrEqual(1);
      expect(guide.screenshots.every((screenshot) => screenshot.src.endsWith('.webp'))).toBe(true);
    }
  });

  it('keeps the concrete FGTS rules and Price approval angle', () => {
    const fgts = JSON.stringify(guides.find((guide) => guide.slug === 'fgts-no-financiamento'));
    const price = JSON.stringify(guides.find((guide) => guide.slug === 'sac-ou-price'));
    const tablePrice = JSON.stringify(guides.find((guide) => guide.slug === 'tabela-price'));

    expect(fgts).toContain('2 anos');
    expect(fgts).toContain('12 prestações consecutivas');
    expect(fgts).toContain('80%');
    expect(fgts).toContain('uso único');
    expect(price).toContain('regra dos 30%');
    expect(tablePrice).toContain('regra dos 30%');
    expect(price).toContain('/recursos/renda-para-financiar-imovel');
    expect(tablePrice).toContain('/recursos/renda-para-financiar-imovel');
  });

  it('aligns the homepage metadata with SAC and simulator search intent', () => {
    expect(metadata.title).toEqual({
      absolute: 'Calculadora SAC e Price — Simulador de Financiamento',
    });
    expect(metadata.description).toContain('tabela SAC');
    expect(metadata.description).toContain('simulador de amortização');
  });
});
