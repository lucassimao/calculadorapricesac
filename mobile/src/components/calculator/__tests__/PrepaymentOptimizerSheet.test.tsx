/* eslint-disable import/first */
import React from 'react';
import { Pressable, View } from 'react-native';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../lib/theme', () => ({
  useTheme: () => ({
    colors: {
      background: '#fafafa',
      backgroundSecondary: '#fff',
      backgroundTertiary: '#f4f4f5',
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
      errorLight: '#fee',
    },
  }),
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: View,
}));

import type { OptimizerSuccess, OptimizerUnreachable } from '@loan-engine/calculations/optimizer';
import { PrepaymentOptimizerSheet } from '../PrepaymentOptimizerSheet';

const successResult: OptimizerSuccess = {
  status: 'success',
  goal: 'payoff_by_date',
  prepayments: [
    {
      id: 'optimizer-1',
      date: new Date(2026, 1, 5),
      amount: 850,
      type: 'fixed_amount',
      strategy: 'reduce_term',
    },
  ],
  baseSummary: {
    totalPayment: 300_000,
    totalInterest: 100_000,
    firstPayment: 3_000,
    lastPayment: 1_700,
    averagePayment: 2_500,
    interestPercentage: 33.33,
    totalUpfrontCosts: 0,
    totalMonthlyCosts: 0,
    totalPaymentWithCosts: 300_000,
    cet: { status: 'available', root: 'positive', annualRate: 10 },
    financedPrincipal: 200_000,
    propertyTotalCost: 0,
    totalFgtsUsed: 0,
    totalPaymentNet: 300_000,
    totalIndexCorrection: 0,
  },
  optimizedSummary: {
    totalPayment: 250_000,
    totalInterest: 50_000,
    firstPayment: 3_850,
    lastPayment: 2_000,
    averagePayment: 3_000,
    interestPercentage: 20,
    totalUpfrontCosts: 0,
    totalMonthlyCosts: 0,
    totalPaymentWithCosts: 250_000,
    cet: { status: 'available', root: 'positive', annualRate: 10 },
    financedPrincipal: 200_000,
    propertyTotalCost: 0,
    totalFgtsUsed: 0,
    totalPaymentNet: 250_000,
    totalIndexCorrection: 0,
  },
  payoffDate: new Date(2031, 1, 5),
  interestSaved: 50_000,
  iterations: 20,
  horizonMonths: 60,
  explanation: 'Este é o menor valor mensal usando redução de prazo.',
  recurringAmount: 850,
};

const unreachableResult: OptimizerUnreachable = {
  status: 'unreachable',
  goal: 'payoff_by_date',
  prepayments: [],
  message: 'Não é possível quitar antes da primeira parcela.',
  iterations: 0,
};

const baseProps = {
  visible: true,
  isPremium: true,
  goal: 'payoff_by_date' as const,
  targetDateText: '05/02/2031',
  oneOffAmountText: '',
  recurringAmountText: '',
  targetPaymentText: '',
  result: null,
  isGenerating: false,
  onClose: vi.fn(),
  onGoalChange: vi.fn(),
  onTargetDateTextChange: vi.fn(),
  onOneOffAmountTextChange: vi.fn(),
  onRecurringAmountTextChange: vi.fn(),
  onTargetPaymentTextChange: vi.fn(),
  onGenerate: vi.fn(),
  onUpgrade: vi.fn(),
  onSavePlan: vi.fn(),
};

describe('PrepaymentOptimizerSheet', () => {
  let renderer: ReactTestRenderer | null = null;

  afterEach(async () => {
    await act(async () => renderer?.unmount());
    renderer = null;
    vi.clearAllMocks();
  });

  it('keeps all goals visible but gates the result for free users', async () => {
    await act(async () => {
      renderer = TestRenderer.create(<PrepaymentOptimizerSheet {...baseProps} isPremium={false} />);
    });

    const tree = JSON.stringify(renderer!.toJSON());
    expect(tree).toContain('Assistente de amortização');
    expect(tree).toContain('Quitar até uma data');
    expect(tree).toContain('Minimizar juros');
    expect(tree).toContain('Reduzir parcela para um teto');
    expect(tree).toContain('Resultado exclusivo do Premium');
    expect(tree.toLocaleLowerCase('pt-BR')).toContain('plano personalizado');

    const upgrade = renderer!.root.find((node) => node.props.testID === 'btn-optimizer-upgrade');
    await act(async () => upgrade.props.onPress());
    expect(baseProps.onUpgrade).toHaveBeenCalledOnce();
    expect(baseProps.onGenerate).not.toHaveBeenCalled();
  });

  it('switches goals and exposes the matching Premium inputs', async () => {
    await act(async () => {
      renderer = TestRenderer.create(<PrepaymentOptimizerSheet {...baseProps} />);
    });

    const minimize = renderer!.root.find(
      (node) => node.props.testID === 'optimizer-goal-minimize-interest',
    );
    await act(async () => minimize.props.onPress());
    expect(baseProps.onGoalChange).toHaveBeenCalledWith('minimize_interest');

    await act(async () => {
      renderer!.update(<PrepaymentOptimizerSheet {...baseProps} goal="minimize_interest" />);
    });
    const tree = JSON.stringify(renderer!.toJSON()).replaceAll('\u00a0', ' ');
    expect(tree).toContain('Valor único disponível');
    expect(tree).toContain('Orçamento mensal');

    const generate = renderer!.root
      .findAllByType(Pressable)
      .find((node) => node.props.testID === 'btn-generate-optimizer-plan');
    await act(async () => generate!.props.onPress());
    expect(baseProps.onGenerate).toHaveBeenCalledOnce();
  });

  it('masks an Android numeric date and disables generation while calculating', async () => {
    await act(async () => {
      renderer = TestRenderer.create(
        <PrepaymentOptimizerSheet {...baseProps} isGenerating={true} />,
      );
    });

    const dateInput = renderer!.root.find(
      (node) => node.props.testID === 'input-optimizer-target-date',
    );
    await act(async () => dateInput.props.onChangeText('01012031'));
    expect(baseProps.onTargetDateTextChange).toHaveBeenCalledWith('01/01/2031');

    const generate = renderer!.root.find(
      (node) => node.props.testID === 'btn-generate-optimizer-plan',
    );
    expect(generate.props.disabled).toBe(true);
    expect(JSON.stringify(renderer!.toJSON())).toContain('Calculando plano');
  });

  it('shows the generated plan, before/after values and save action', async () => {
    await act(async () => {
      renderer = TestRenderer.create(
        <PrepaymentOptimizerSheet {...baseProps} result={successResult} />,
      );
    });

    const tree = JSON.stringify(renderer!.toJSON()).replaceAll('\u00a0', ' ');
    expect(tree).toContain('R$ 850,00 por mês');
    expect(tree).toContain('Juros antes');
    expect(tree).toContain('Juros com o plano');
    expect(tree).toContain('R$ 50.000,00');
    expect(tree).toContain('Quitação estimada');
    expect(tree).toContain('Salvar como cenário');

    const save = renderer!.root.find((node) => node.props.testID === 'btn-save-optimizer-plan');
    await act(async () => save.props.onPress());
    expect(baseProps.onSavePlan).toHaveBeenCalledOnce();
  });

  it('shows a clear unreachable message without rendering a plan', async () => {
    await act(async () => {
      renderer = TestRenderer.create(
        <PrepaymentOptimizerSheet {...baseProps} result={unreachableResult} />,
      );
    });

    const tree = JSON.stringify(renderer!.toJSON());
    expect(tree).toContain('Meta não alcançável');
    expect(tree).toContain('Não é possível quitar antes da primeira parcela.');
    expect(tree).not.toContain('btn-save-optimizer-plan');
  });

  it('does not offer to save when the goal already needs no prepayment', async () => {
    await act(async () => {
      renderer = TestRenderer.create(
        <PrepaymentOptimizerSheet
          {...baseProps}
          result={{ ...successResult, prepayments: [], recurringAmount: 0 }}
        />,
      );
    });

    const tree = JSON.stringify(renderer!.toJSON());
    expect(tree).toContain('Nenhuma amortização adicional necessária');
    expect(tree).not.toContain('btn-save-optimizer-plan');
  });
});
