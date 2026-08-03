/* eslint-disable import/first */
import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { Pressable, Text } from 'react-native';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../lib/theme', () => ({
  useTheme: () => ({
    colors: {
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

import { EntryModeSelector } from '../EntryModeSelector';

describe('EntryModeSelector', () => {
  let renderer: ReactTestRenderer | null = null;

  afterEach(async () => {
    await act(async () => renderer?.unmount());
    renderer = null;
  });

  it('offers the exact new-loan and existing-contract choices', async () => {
    const onChange = vi.fn();
    await act(async () => {
      renderer = TestRenderer.create(
        <EntryModeSelector entryMode="new_loan" onChange={onChange} />,
      );
    });

    const labels = renderer!.root.findAllByType(Text).map((node) => node.props.children);
    expect(labels).toContain('Novo financiamento');
    expect(labels).toContain('Já tenho um financiamento');
    expect(JSON.stringify(renderer!.toJSON())).toContain('Simule um crédito desde a contratação.');

    const existingButton = renderer!.root
      .findAllByType(Pressable)
      .find((node) => node.props.testID === 'entry-mode-existing-contract');
    await act(async () => existingButton!.props.onPress());
    expect(onChange).toHaveBeenCalledWith('existing_contract');
    await act(async () => {
      renderer!.update(<EntryModeSelector entryMode="existing_contract" onChange={onChange} />);
    });
    expect(JSON.stringify(renderer!.toJSON())).toContain(
      'Use o saldo e as parcelas que ainda faltam no seu contrato.',
    );
  });
});
