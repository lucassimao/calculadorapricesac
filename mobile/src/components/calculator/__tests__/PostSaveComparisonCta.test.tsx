/* eslint-disable import/first */
import React from 'react';
import { AccessibilityInfo } from 'react-native';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../lib/theme', () => ({
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#ddd',
      primary: '#06c',
      primaryLight: '#def',
      text: '#111',
      textSecondary: '#333',
    },
  }),
}));

import { PostSaveComparisonCta } from '../PostSaveComparisonCta';

describe('PostSaveComparisonCta', () => {
  let renderer: ReactTestRenderer | null = null;

  afterEach(async () => {
    await act(async () => renderer?.unmount());
    renderer = null;
    vi.clearAllMocks();
  });

  it('offers comparison after save and supports action and dismissal', async () => {
    const announce = vi
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => {});
    const onCompare = vi.fn();
    const onDismiss = vi.fn();
    await act(async () => {
      renderer = TestRenderer.create(
        <PostSaveComparisonCta onCompare={onCompare} onDismiss={onDismiss} />,
      );
    });

    const tree = JSON.stringify(renderer!.toJSON());
    expect(tree).toContain('CENÁRIO SALVO');
    expect(tree).toContain('Comparar condições');
    expect(announce).toHaveBeenCalledWith('Cenário salvo. Quer comparar propostas?');

    await act(async () =>
      renderer!.root.find((node) => node.props.testID === 'btn-post-save-compare').props.onPress(),
    );
    await act(async () =>
      renderer!.root
        .find((node) => node.props.testID === 'btn-dismiss-post-save-compare')
        .props.onPress(),
    );
    expect(onCompare).toHaveBeenCalledOnce();
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
