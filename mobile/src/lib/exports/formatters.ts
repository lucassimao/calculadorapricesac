import type { Scenario } from '../../types/loan';

const TERM_UNIT_LABELS: Record<Scenario['termUnit'], string> = {
  months: 'meses',
  years: 'anos',
};

export function formatExportTerm(term: number, termUnit: Scenario['termUnit']) {
  return `${term} ${TERM_UNIT_LABELS[termUnit] ?? termUnit}`;
}
