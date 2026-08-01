import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Simulator } from '../Simulator';
import { ResultsComparison } from '../ResultsComparison';
import { buildScenarios } from '../buildScenarios';
import { calculateLoanSummary, generateAmortizationSchedule } from '@loan-engine/calculations';

describe('Simulator', () => {
  it('renders SAC and Price results on first paint (default inputs)', () => {
    render(<Simulator />);
    // "1ª parcela" appears only in the SAC tile; "CET" appears once per tile.
    expect(screen.getByText('1ª parcela')).toBeInTheDocument();
    expect(screen.getAllByText('CET')).toHaveLength(2);
  });

  it('hides results and shows an alert when entrada >= valor do imóvel', () => {
    render(<Simulator />);
    // fireEvent.change sets the value in one shot (avoids masked-input typing flakiness).
    fireEvent.change(screen.getByLabelText('Entrada'), { target: { value: '500000' } });
    expect(screen.queryByText('1ª parcela')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('hides results and shows an alert when the interest rate is zero', () => {
    render(<Simulator />);
    fireEvent.change(screen.getByLabelText('Taxa de juros anual'), { target: { value: '0' } });
    expect(screen.queryByText('1ª parcela')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('renders the explanatory label when CET is unavailable', () => {
    const scenarios = buildScenarios({
      propertyValue: 400000,
      downPayment: 80000,
      annualRate: 11.5,
      termYears: 30,
    });
    const sac = calculateLoanSummary(generateAmortizationSchedule(scenarios.sac), scenarios.sac);
    const price = calculateLoanSummary(
      generateAmortizationSchedule(scenarios.price),
      scenarios.price,
    );

    render(
      <ResultsComparison
        sac={{ ...sac, cet: { status: 'unavailable', reason: 'no_sign_change' } }}
        price={{ ...price, cet: { status: 'unavailable', reason: 'non_convergence' } }}
      />,
    );

    expect(screen.getAllByText('CET indisponível para este cenário')).toHaveLength(2);
  });
});
