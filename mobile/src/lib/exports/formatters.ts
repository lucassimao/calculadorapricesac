import type { Scenario } from '@loan-engine/loan';

const TERM_UNIT_LABELS: Record<Scenario['termUnit'], string> = {
  months: 'meses',
  years: 'anos',
};

export function formatExportTerm(term: number, termUnit: Scenario['termUnit']) {
  return `${term} ${TERM_UNIT_LABELS[termUnit] ?? termUnit}`;
}

export function formatEffectiveInstallmentCount(installmentCount: number) {
  return `${installmentCount} parcelas`;
}

export function formatCorrectionRate(rate: number | undefined) {
  return `${(rate ?? 0).toFixed(5).replace('.', ',')}% a.m.`;
}
