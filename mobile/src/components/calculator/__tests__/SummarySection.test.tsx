/* eslint-disable import/first */
import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LoanSummary } from '@loan-engine/loan';

vi.mock('../../../lib/theme', () => ({
  useTheme: () => ({
    colors: {
      backgroundSecondary: '#fff',
      border: '#ddd',
      borderLight: '#eee',
      success: '#080',
      successLight: '#efe',
      text: '#111',
      textSecondary: '#333',
      textTertiary: '#666',
    },
  }),
}));

import { SummarySection } from '../SummarySection';

const summary: LoanSummary = {
  totalPayment: 120_000,
  totalInterest: 20_000,
  firstPayment: 1_000,
  lastPayment: 900,
  averagePayment: 950,
  interestPercentage: 20,
  totalUpfrontCosts: 0,
  totalMonthlyCosts: 0,
  totalPaymentWithCosts: 120_000,
  cet: { status: 'available', root: 'positive', annualRate: 12.34 },
  financedPrincipal: 100_000,
  propertyTotalCost: 0,
  totalFgtsUsed: 0,
  totalPaymentNet: 120_000,
  totalIndexCorrection: 0,
};

describe('SummarySection', () => {
  let renderer: ReactTestRenderer | null = null;

  afterEach(async () => {
    await act(async () => renderer?.unmount());
    renderer = null;
  });

  it('marks origination CET as not applicable for an existing-contract tail', async () => {
    await act(async () => {
      renderer = TestRenderer.create(
        <SummarySection
          summary={summary}
          principal={100_000}
          isPremium={false}
          isCalculating={false}
          cetNotApplicable
        />,
      );
    });

    expect(JSON.stringify(renderer!.toJSON())).not.toContain('CET (a.a.)');
    expect(JSON.stringify(renderer!.toJSON())).toContain('Não se aplica ao saldo atual');
    expect(JSON.stringify(renderer!.toJSON())).toContain('Total de Juros');
  });
});
