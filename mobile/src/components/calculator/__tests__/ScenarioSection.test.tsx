/* eslint-disable import/first */
import React from 'react';
import { View } from 'react-native';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Scenario } from '@loan-engine/loan';

vi.mock('../../../lib/theme', () => ({
  useTheme: () => ({
    colors: {
      background: '#fafafa',
      backgroundSecondary: '#fff',
      border: '#ddd',
      borderLight: '#eee',
      primary: '#06c',
      text: '#111',
      textSecondary: '#333',
      textTertiary: '#666',
      error: '#c00',
      errorLight: '#fee',
    },
  }),
}));

import { ScenarioSection } from '../ScenarioSection';

const scenario: Scenario = {
  id: 'saved-1',
  name: 'Meu contrato salvo',
  system: 'SAC',
  principal: 200_000,
  rate: 10,
  rateType: 'annual',
  term: 120,
  termUnit: 'months',
  startDate: new Date(2026, 0, 1),
  dueDay: 5,
};

describe('ScenarioSection', () => {
  let renderer: ReactTestRenderer | null = null;

  afterEach(async () => {
    await act(async () => renderer?.unmount());
    renderer = null;
  });

  it('opens the optimizer from a saved scenario with that scenario as context', async () => {
    const onOptimize = vi.fn();
    await act(async () => {
      renderer = TestRenderer.create(
        <ScenarioSection
          scenario={scenario}
          scenarios={[scenario]}
          onNameChange={vi.fn()}
          onSave={vi.fn()}
          onNew={vi.fn()}
          onLoad={vi.fn()}
          onDelete={vi.fn()}
          onOptimize={onOptimize}
        />,
      );
    });

    const button = renderer!.root.find((node) => node.props.testID === 'btn-optimize-scenario-0');
    expect(button.props.accessibilityLabel).toBe('Otimizar amortização de Meu contrato salvo');
    await act(async () => button.props.onPress());
    expect(onOptimize).toHaveBeenCalledWith(scenario);
  });

  it('places post-save content next to the save action before the saved list', async () => {
    await act(async () => {
      renderer = TestRenderer.create(
        <ScenarioSection
          scenario={scenario}
          scenarios={[scenario]}
          onNameChange={vi.fn()}
          onSave={vi.fn()}
          onNew={vi.fn()}
          onLoad={vi.fn()}
          onDelete={vi.fn()}
          onOptimize={vi.fn()}
          afterSaveContent={<View testID="after-save-content" />}
        />,
      );
    });

    const tree = JSON.stringify(renderer!.toJSON());
    expect(tree.indexOf('after-save-content')).toBeGreaterThan(tree.indexOf('btn-save-scenario'));
    expect(tree.indexOf('after-save-content')).toBeLessThan(tree.indexOf('scenario-item-0'));
  });
});
