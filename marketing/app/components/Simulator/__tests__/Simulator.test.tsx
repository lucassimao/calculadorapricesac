import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Simulator } from '../Simulator';

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
});
