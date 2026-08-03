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

import { PortabilitySection } from '../PortabilitySection';

describe('PortabilitySection', () => {
  let renderer: ReactTestRenderer | null = null;

  afterEach(async () => {
    await act(async () => renderer?.unmount());
    renderer = null;
  });

  it('collects a new proposal and renders nominal comparison outputs', async () => {
    const onCompare = vi.fn();
    const props = {
      rateText: '9,5',
      rateType: 'annual' as const,
      termText: '180',
      costsText: 'R$ 2.000',
      onRateTextChange: vi.fn(),
      onRateTypeChange: vi.fn(),
      onTermTextChange: vi.fn(),
      onCostsTextChange: vi.fn(),
      onCompare,
      error: null,
      result: null,
    };

    await act(async () => {
      renderer = TestRenderer.create(<PortabilitySection {...props} />);
    });

    const initialTree = JSON.stringify(renderer!.toJSON());
    expect(initialTree).toContain('Comparar com outra proposta');
    expect(initialTree).toContain('Taxa da nova proposta');
    expect(initialTree).toContain('Prazo da nova proposta (meses)');
    expect(initialTree).toContain('Custos da portabilidade (R$)');
    expect(initialTree).toContain('Seguros e taxas no novo banco podem ser diferentes.');
    expect(initialTree).toContain('mesmo sistema e o mesmo indexador');
    expect(initialTree).toContain('Amortizações e usos de FGTS planejados não entram');

    const compareButton = renderer!.root
      .findAllByType(Pressable)
      .find((node) => node.props.testID === 'btn-compare-portability');
    await act(async () => compareButton!.props.onPress());
    expect(onCompare).toHaveBeenCalledOnce();

    await act(async () => {
      renderer!.update(
        <PortabilitySection
          {...props}
          result={{
            currentTotalCost: 150_000,
            newTotalCost: 140_000,
            totalSavings: 10_000,
            monthlyPaymentDelta: -200,
            currentFirstPayment: 1_500,
            newFirstPayment: 1_300,
            breakEvenMonth: 8,
            recommendation:
              'A portabilidade economiza R$ 10.000,00 no total e recupera os custos no 8º mês.',
          }}
        />,
      );
    });

    const resultTree = JSON.stringify(renderer!.toJSON());
    expect(resultTree).toContain('Total restante atual');
    expect(resultTree).toContain('Nova proposta + custos');
    expect(resultTree).toContain('Diferença na 1ª parcela');
    expect(resultTree).toContain('Break-even: 8º mês');
    expect(resultTree).toContain('A portabilidade economiza');
    expect(
      renderer!.root.find((node) => node.props.testID === 'portability-result').props
        .accessibilityLiveRegion,
    ).toBe('polite');

    await act(async () => {
      renderer!.update(
        <PortabilitySection
          {...props}
          result={{
            currentTotalCost: 150_000,
            newTotalCost: 160_000,
            totalSavings: -10_000,
            monthlyPaymentDelta: -200,
            currentFirstPayment: 1_500,
            newFirstPayment: 1_300,
            breakEvenMonth: 2,
            recommendation: 'Manter o contrato atual custa menos.',
          }}
        />,
      );
    });

    const unfavorableResult = renderer!.root.find(
      (node) => node.props.testID === 'portability-result',
    );
    expect(unfavorableResult.props.style).toContainEqual(
      expect.objectContaining({ backgroundColor: '#ffe', borderColor: '#a50' }),
    );
  });
});
