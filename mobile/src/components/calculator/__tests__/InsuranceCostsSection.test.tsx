/* eslint-disable import/first */
import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { Pressable, TextInput } from 'react-native';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../lib/theme', () => ({
  useTheme: () => ({
    colors: {
      background: '#fafafa',
      backgroundSecondary: '#fff',
      border: '#ddd',
      primary: '#06c',
      primaryLight: '#def',
      text: '#111',
      textSecondary: '#333',
      textTertiary: '#666',
    },
  }),
}));

import { InsuranceCostsSection } from '../InsuranceCostsSection';

describe('InsuranceCostsSection', () => {
  let renderer: ReactTestRenderer | null = null;

  afterEach(async () => {
    await act(async () => renderer?.unmount());
    renderer = null;
  });

  it('labels MIP/DFI bases, estimate provenance, and keeps rates manually editable', async () => {
    const onApplyAgeEstimate = vi.fn();
    const props = {
      borrowerAgeText: '28',
      mipRateText: '0,0202',
      dfiRateText: '0,01337',
      adminFeeText: 'R$ 25',
      legacyAdminFeeRateText: '0,01',
      showDfi: true,
      showInsuranceTiming: true,
      insuranceChargeTiming: 'monthly' as const,
      isExistingContract: false,
      onBorrowerAgeTextChange: vi.fn(),
      onBorrowerAgeBlur: vi.fn(),
      onMipRateTextChange: vi.fn(),
      onDfiRateTextChange: vi.fn(),
      onAdminFeeTextChange: vi.fn(),
      onLegacyAdminFeeRateTextChange: vi.fn(),
      onInsuranceChargeTimingChange: vi.fn(),
      onApplyAgeEstimate,
    };

    await act(async () => {
      renderer = TestRenderer.create(<InsuranceCostsSection {...props} />);
    });

    const tree = JSON.stringify(renderer!.toJSON());
    expect(tree).toContain('Idade do proponente');
    expect(tree).toContain('MIP (% do saldo devedor ao mês)');
    expect(tree).toContain('DFI (% do valor do imóvel ao mês)');
    expect(tree).toContain('Tarifa administrativa (R$ ao mês)');
    expect(tree).toContain('Tarifa legada (% do saldo ao mês)');
    expect(tree).toContain('Cobrança dos seguros');
    expect(tree).toContain('Mensal (padrão)');
    expect(tree).toContain('2 competências na 1ª parcela');
    expect(tree.toLowerCase()).toContain('estimativa — confira sua apólice');
    expect(tree).toContain('Itaú (taxa-base) + Brasilseg/BB (progressão)');

    const mipInput = renderer!.root
      .findAllByType(TextInput)
      .find((node) => node.props.testID === 'input-mip-rate');
    await act(async () => mipInput!.props.onChangeText('0,03'));
    expect(props.onMipRateTextChange).toHaveBeenCalledWith('0,03');

    const applyButton = renderer!.root
      .findAllByType(Pressable)
      .find((node) => node.props.testID === 'btn-apply-mip-estimate');
    await act(async () => applyButton!.props.onPress());
    expect(onApplyAgeEstimate).toHaveBeenCalledOnce();

    const prepaidButton = renderer!.root
      .findAllByType(Pressable)
      .find((node) => node.props.testID === 'btn-insurance-timing-prepaid');
    await act(async () => prepaidButton!.props.onPress());
    expect(props.onInsuranceChargeTimingChange).toHaveBeenCalledWith('prepaid_at_signing');

    const ageInput = renderer!.root
      .findAllByType(TextInput)
      .find((node) => node.props.testID === 'input-borrower-age');
    await act(async () => ageInput!.props.onBlur());
    expect(props.onBorrowerAgeBlur).toHaveBeenCalledOnce();

    await act(async () => {
      renderer!.update(
        <InsuranceCostsSection
          {...props}
          isExistingContract
          propertyValueText="R$ 300.000"
          onPropertyValueTextChange={vi.fn()}
        />,
      );
    });
    const existingTree = JSON.stringify(renderer!.toJSON());
    expect(existingTree).toContain('Valor do imóvel para DFI (R$)');
    expect(existingTree).toContain('o preset altera somente a taxa');
  });
});
