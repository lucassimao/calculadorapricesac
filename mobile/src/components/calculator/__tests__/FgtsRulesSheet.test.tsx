/* eslint-disable import/first */
import React from 'react';
import { Linking, Pressable } from 'react-native';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
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

import { FgtsRulesHelper, FgtsRulesSheet } from '../FgtsRulesSheet';

describe('FgtsRulesSheet', () => {
  let renderer: ReactTestRenderer | null = null;

  afterEach(async () => {
    await act(async () => renderer?.unmount());
    renderer = null;
    vi.restoreAllMocks();
  });

  it('mirrors the dated official guidance for each FGTS usage type', async () => {
    await act(async () => {
      renderer = TestRenderer.create(<FgtsRulesSheet visible onClose={vi.fn()} />);
    });

    const tree = JSON.stringify(renderer!.toJSON());
    const copy = tree.toLocaleLowerCase('pt-BR');
    expect(tree).toContain('Como usar o FGTS');
    expect(tree).toContain('Entrada');
    expect(copy).toContain('uso único na contratação');
    expect(tree).toContain('Amortização ou liquidação');
    expect(tree).toContain('intervalo mínimo de 2 anos');
    expect(tree).toContain('Pagamento de prestações');
    expect(tree).toContain('até 80% de 12 prestações consecutivas');
    expect(tree).toContain('Principais condições');
    expect(tree).toContain('02/08/2026');
    expect(tree).toContain('Confirme seu enquadramento com o banco');
    expect(
      renderer!.root.find((node) => node.props.testID === 'fgts-rule-down-payment'),
    ).toBeTruthy();
    expect(
      renderer!.root.find((node) => node.props.testID === 'fgts-rule-amortization'),
    ).toBeTruthy();
    expect(
      renderer!.root.find((node) => node.props.testID === 'fgts-rule-installment'),
    ).toBeTruthy();
  });

  it('hides the down-payment rule for an existing contract', async () => {
    await act(async () => {
      renderer = TestRenderer.create(
        <FgtsRulesSheet visible showDownPayment={false} onClose={vi.fn()} />,
      );
    });

    expect(
      renderer!.root.findAll((node) => node.props.testID === 'fgts-rule-down-payment'),
    ).toHaveLength(0);
    expect(
      renderer!.root.find((node) => node.props.testID === 'fgts-rule-amortization'),
    ).toBeTruthy();
    expect(
      renderer!.root.find((node) => node.props.testID === 'fgts-rule-installment'),
    ).toBeTruthy();
  });

  it('opens the official source and closes from both dismiss controls', async () => {
    const onClose = vi.fn();
    const openUrl = vi.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await act(async () => {
      renderer = TestRenderer.create(<FgtsRulesSheet visible onClose={onClose} />);
    });

    const source = renderer!.root.find((node) => node.props.testID === 'fgts-rules-sheet-source');
    expect(source.props.accessibilityLabel).toBe(
      'Ver orientação oficial do FGTS, consultada em 02/08/2026',
    );
    await act(async () => source.props.onPress());
    expect(openUrl).toHaveBeenCalledWith(
      'https://www.fgts.gov.br/Paginas/subpaginas/amortizacao_liquidacao.aspx',
    );

    const close = renderer!.root
      .findAllByType(Pressable)
      .find((node) => node.props.testID === 'btn-close-fgts-rules');
    expect(close!.props.accessibilityLabel).toBe('Fechar regras do FGTS');
    await act(async () => close!.props.onPress());
    expect(onClose).toHaveBeenCalledOnce();

    const backdrop = renderer!.root.find((node) => node.props.testID === 'fgts-rules-backdrop');
    expect(backdrop.props.accessible).toBe(false);
    expect(backdrop.props.accessibilityLabel).toBeUndefined();
    await act(async () => backdrop.props.onPress());
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('renders nothing while hidden', async () => {
    await act(async () => {
      renderer = TestRenderer.create(<FgtsRulesSheet visible={false} onClose={vi.fn()} />);
    });

    expect(renderer!.toJSON()).toBeNull();
  });

  it('wires the calculator helper trigger to the correctly scoped sheet', async () => {
    await act(async () => {
      renderer = TestRenderer.create(<FgtsRulesHelper showDownPayment={false} />);
    });
    expect(renderer!.root.findAll((node) => node.props.testID === 'fgts-rules-sheet')).toHaveLength(
      0,
    );

    const trigger = renderer!.root.find((node) => node.props.testID === 'btn-open-fgts-rules');
    expect(trigger.props.accessibilityLabel).toBe('Entenda as regras do FGTS por tipo de uso');
    await act(async () => trigger.props.onPress());

    expect(renderer!.root.find((node) => node.props.testID === 'fgts-rules-sheet')).toBeTruthy();
    expect(
      renderer!.root.findAll((node) => node.props.testID === 'fgts-rule-down-payment'),
    ).toHaveLength(0);
  });
});
