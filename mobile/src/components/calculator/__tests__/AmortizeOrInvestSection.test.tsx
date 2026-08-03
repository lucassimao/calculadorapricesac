/* eslint-disable import/first */
import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { Pressable } from 'react-native';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../lib/theme', () => ({
  useTheme: () => ({
    colors: {
      background: '#fafafa',
      backgroundSecondary: '#fff',
      border: '#ddd',
      primary: '#06c',
      primaryLight: '#def',
      success: '#080',
      successLight: '#efe',
      warning: '#a50',
      warningLight: '#ffe',
      text: '#111',
      textSecondary: '#333',
      textTertiary: '#666',
      error: '#c00',
    },
  }),
}));

import { AmortizeOrInvestSection } from '../AmortizeOrInvestSection';

const result = {
  amortization: {
    interestSaved: 28_500,
    originalPayoffDate: new Date(2036, 7, 5),
    newPayoffDate: new Date(2034, 3, 5),
    horizonValue: 31_000,
    equivalentAnnualReturn: 9.16,
  },
  investment: {
    grossBalance: 30_000,
    grossProfit: 10_000,
    taxRate: 0.15,
    taxAmount: 1_500,
    netBalance: 28_500,
    netProfit: 8_500,
  },
  winner: 'amortize' as const,
  difference: 2_500,
  flipAnnualRate: 11.42,
};

const baseProps = {
  amountText: 'R$ 20.000',
  vehicle: 'cdi' as const,
  annualRateText: '14,15',
  horizonText: '60',
  taxRegime: 'regressive' as const,
  isPremium: true,
  result: null,
  error: null,
  onAmountTextChange: vi.fn(),
  onVehicleChange: vi.fn(),
  onAnnualRateTextChange: vi.fn(),
  onHorizonTextChange: vi.fn(),
  onTaxRegimeChange: vi.fn(),
  onCompare: vi.fn(),
  onUpgrade: vi.fn(),
  onOpenSource: vi.fn(),
};

describe('AmortizeOrInvestSection', () => {
  let renderer: ReactTestRenderer | null = null;

  afterEach(async () => {
    await act(async () => renderer?.unmount());
    renderer = null;
    vi.clearAllMocks();
  });

  it('shows editable investment assumptions, presets, tax regime and source', async () => {
    await act(async () => {
      renderer = TestRenderer.create(<AmortizeOrInvestSection {...baseProps} />);
    });

    const tree = JSON.stringify(renderer!.toJSON());
    expect(tree).toContain('Amortizar ou investir?');
    expect(tree).toContain('Valor disponível agora');
    expect(tree).toContain('100% do CDI');
    expect(tree).toContain('Tesouro Selic');
    expect(tree).toContain('Rentabilidade bruta (% a.a.)');
    expect(tree).toContain('Horizonte (meses)');
    expect(tree).toContain('IR regressivo');
    expect(tree).toContain('Investimento isento');
    expect(tree).toContain('estimativa');
    expect(tree).toContain('B3 — DI Over');

    const selic = renderer!.root.find((node) => node.props.testID === 'investment-vehicle-selic');
    await act(async () => selic.props.onPress());
    expect(baseProps.onVehicleChange).toHaveBeenCalledWith('tesouro_selic');

    const source = renderer!.root.find((node) => node.props.testID === 'investment-source-link');
    await act(async () => source.props.onPress());
    expect(baseProps.onOpenSource).toHaveBeenCalledOnce();
  });

  it('gates the result for free users while keeping the assumptions visible', async () => {
    await act(async () => {
      renderer = TestRenderer.create(<AmortizeOrInvestSection {...baseProps} isPremium={false} />);
    });

    const tree = JSON.stringify(renderer!.toJSON());
    expect(tree).toContain('Resultado exclusivo do Premium');
    expect(tree).toContain('Compare o ganho líquido');
    const upgrade = renderer!.root.find(
      (node) => node.props.testID === 'btn-amortize-invest-upgrade',
    );
    await act(async () => upgrade.props.onPress());
    expect(baseProps.onUpgrade).toHaveBeenCalledOnce();
    expect(baseProps.onCompare).not.toHaveBeenCalled();
  });

  it('renders both paths, winner, payoff and flip threshold for Premium', async () => {
    await act(async () => {
      renderer = TestRenderer.create(<AmortizeOrInvestSection {...baseProps} result={result} />);
    });

    const compare = renderer!.root
      .findAllByType(Pressable)
      .find((node) => node.props.testID === 'btn-compare-amortize-invest');
    await act(async () => compare!.props.onPress());
    expect(baseProps.onCompare).toHaveBeenCalledOnce();

    const tree = JSON.stringify(renderer!.toJSON());
    expect(tree).toContain('Amortizar vence');
    expect(tree).toContain('Juros economizados');
    expect(tree).toContain('Nova quitação');
    expect(tree).toContain('Retorno anual equivalente (isento)');
    expect(tree).toContain('Saldo bruto');
    expect(tree).toContain('IR estimado');
    expect(tree).toContain('Saldo líquido');
    expect(tree).toContain('Taxa de virada');
    expect(tree).toContain('reinveste as parcelas economizadas');
    expect(tree).toContain('11,42%');
    expect(tree).toContain('a.a. bruto');
    expect(tree).toContain('não é recomendação de investimento');
    expect(
      renderer!.root.find((node) => node.props.testID === 'amortize-invest-result').props
        .accessibilityLiveRegion,
    ).toBe('polite');
  });

  it('renders a tie as neutral without describing either path as a loss', async () => {
    await act(async () => {
      renderer = TestRenderer.create(
        <AmortizeOrInvestSection
          {...baseProps}
          result={{ ...result, winner: 'tie', difference: 0 }}
        />,
      );
    });

    const panel = renderer!.root.find((node) => node.props.testID === 'amortize-invest-result');
    const tree = JSON.stringify(renderer!.toJSON());
    expect(tree).toContain('Empate técnico');
    expect(tree).not.toContain('Empate técnico por');
    expect(panel.props.style).toContainEqual(
      expect.objectContaining({ backgroundColor: '#def', borderColor: '#06c' }),
    );
  });
});
