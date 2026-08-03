/* eslint-disable import/first */
import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../lib/theme', () => ({
  useTheme: () => ({
    colors: {
      error: '#c00',
      errorLight: '#fee',
      warning: '#850',
      warningLight: '#ffc',
    },
  }),
}));

import { ValidationSection } from '../ValidationSection';

describe('ValidationSection', () => {
  let renderer: ReactTestRenderer | null = null;

  afterEach(async () => {
    await act(async () => renderer?.unmount());
    renderer = null;
  });

  it('bounds a recurring-event warning list and reports the hidden count', async () => {
    const warnings = Array.from({ length: 140 }, (_, index) => `Aviso ${index + 1}`);
    await act(async () => {
      renderer = TestRenderer.create(<ValidationSection errors={[]} warnings={warnings} />);
    });

    const texts = renderer!.root.findAllByType(Text).map((node) => node.props.children);
    const output = JSON.stringify(renderer!.toJSON());
    expect(texts).toContain('Aviso 1');
    expect(texts).toContain('Aviso 5');
    expect(texts).not.toContain('Aviso 6');
    expect(output).toContain('…e mais ');
    expect(output).toContain('135');
    expect(output).toContain('avisos');
  });
});
