/* eslint-disable import/first */
import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { ActionSheetIOS, Platform } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { exportState, premiumState, routerPushMock, trackEventMock, triggerExportMock } = vi.hoisted(
  () => ({
    exportState: {
      isExporting: false,
      isPremium: false,
      canUseRewardedExport: true,
    },
    premiumState: { isPremium: false },
    routerPushMock: vi.fn(),
    trackEventMock: vi.fn(),
    triggerExportMock: vi.fn(() => 'started'),
  }),
);

vi.mock('expo-router', () => {
  const Tabs = ({ children }: React.PropsWithChildren) =>
    React.createElement(React.Fragment, null, children);
  Tabs.Screen = function TabsScreen(props: Record<string, unknown>) {
    return React.createElement('TabsScreen', props);
  };
  return {
    Tabs,
    useRouter: () => ({ push: routerPushMock }),
  };
});

vi.mock('@expo/vector-icons', () => ({
  Ionicons: (props: Record<string, unknown>) => React.createElement('Ionicons', props),
}));

vi.mock('../../lib/theme', () => ({
  useTheme: () => ({
    colors: {
      background: '#fff',
      backgroundSecondary: '#eee',
      border: '#ccc',
      text: '#111',
      textSecondary: '#555',
      tabActive: '#06f',
      tabInactive: '#777',
    },
  }),
}));

vi.mock('../../contexts/PremiumContext', () => ({
  usePremiumContext: () => premiumState,
}));

vi.mock('../../contexts/ExportContext', () => ({
  useExport: () => ({
    ...exportState,
    triggerExport: triggerExportMock,
  }),
}));

vi.mock('../../lib/analytics', () => ({
  setPendingPaywallSource: vi.fn(),
  trackEvent: trackEventMock,
}));

import TabsLayout from '../../../app/(tabs)/_layout';

describe('export tab sheet integration', () => {
  let renderer: ReactTestRenderer | null = null;

  async function renderLayout() {
    await act(async () => {
      renderer = TestRenderer.create(React.createElement(TabsLayout));
    });
  }

  async function openExportSheet() {
    const exportTab = renderer?.root.findByProps({ name: 'export-action' });
    await act(async () => {
      exportTab?.props.listeners.tabPress({ preventDefault: vi.fn() });
    });
  }

  async function rerenderLayout() {
    await act(async () => {
      renderer?.update(React.createElement(TabsLayout));
    });
  }

  beforeEach(() => {
    exportState.isExporting = false;
    exportState.isPremium = false;
    exportState.canUseRewardedExport = true;
    premiumState.isPremium = false;
    routerPushMock.mockReset();
    trackEventMock.mockReset();
    triggerExportMock.mockReset();
    triggerExportMock.mockReturnValue('started');
    Platform.OS = 'android';
  });

  afterEach(async () => {
    await act(async () => renderer?.unmount());
    renderer = null;
  });

  it('opens the sheet and records one abandonment even if cancel is delivered twice', async () => {
    await renderLayout();
    await openExportSheet();

    const cancel = renderer?.root.findByProps({ testID: 'android-export-modal-cancel' });
    await act(async () => {
      cancel?.props.onPress();
      cancel?.props.onPress();
    });

    expect(trackEventMock).toHaveBeenCalledWith(
      'export_sheet_opened',
      expect.objectContaining({ is_premium: false, platform: 'android' }),
    );
    expect(
      trackEventMock.mock.calls.filter(([event]) => event === 'export_sheet_abandoned'),
    ).toHaveLength(1);
  });

  it('deduplicates two export tab presses delivered in the same render frame', async () => {
    await renderLayout();
    const exportTab = renderer?.root.findByProps({ name: 'export-action' });

    await act(async () => {
      exportTab?.props.listeners.tabPress({ preventDefault: vi.fn() });
      exportTab?.props.listeners.tabPress({ preventDefault: vi.fn() });
    });

    expect(
      trackEventMock.mock.calls.filter(([event]) => event === 'export_sheet_opened'),
    ).toHaveLength(1);
  });

  it('does not classify an upgrade or export selection as abandonment', async () => {
    await renderLayout();
    await openExportSheet();

    await act(async () => {
      renderer?.root.findByProps({ testID: 'android-export-modal-upgrade' }).props.onPress();
    });
    expect(trackEventMock.mock.calls.some(([event]) => event === 'export_sheet_abandoned')).toBe(
      false,
    );
    expect(trackEventMock).toHaveBeenCalledWith(
      'export_sheet_upgrade_selected',
      expect.objectContaining({ platform: 'android' }),
    );

    await openExportSheet();
    await act(async () => {
      renderer?.root.findByProps({ testID: 'android-export-modal-pdf' }).props.onPress();
    });
    expect(triggerExportMock).toHaveBeenCalledWith('pdf', undefined);
    expect(trackEventMock.mock.calls.some(([event]) => event === 'export_sheet_abandoned')).toBe(
      false,
    );
  });

  it('does not open or instrument another sheet while any export flow is busy', async () => {
    exportState.isExporting = true;
    await renderLayout();
    await openExportSheet();

    expect(trackEventMock).not.toHaveBeenCalledWith('export_sheet_opened', expect.anything());
    expect(() => renderer?.root.findByProps({ testID: 'android-export-modal-card' })).toThrow();
  });

  it('closes a blocked Android sheet without classifying it as abandonment', async () => {
    triggerExportMock.mockReturnValue('validation_blocked');
    await renderLayout();
    await openExportSheet();

    await act(async () => {
      renderer?.root.findByProps({ testID: 'android-export-modal-pdf' }).props.onPress();
    });
    expect(() => renderer?.root.findByProps({ testID: 'android-export-modal-card' })).toThrow();
    expect(trackEventMock.mock.calls.some(([event]) => event === 'export_sheet_abandoned')).toBe(
      false,
    );
    expect(trackEventMock).toHaveBeenCalledWith(
      'export_sheet_blocked',
      expect.objectContaining({ platform: 'android', reason: 'validation' }),
    );
  });

  it('closes a sheet whose first selection is busy and records the reason', async () => {
    triggerExportMock.mockReturnValue('busy');
    await renderLayout();
    await openExportSheet();

    await act(async () => {
      renderer?.root.findByProps({ testID: 'android-export-modal-pdf' }).props.onPress();
    });

    expect(() => renderer?.root.findByProps({ testID: 'android-export-modal-card' })).toThrow();
    expect(trackEventMock).toHaveBeenCalledWith(
      'export_sheet_blocked',
      expect.objectContaining({ platform: 'android', reason: 'busy' }),
    );
  });

  it('keeps the Android progress modal open when a second tap is rejected as busy', async () => {
    triggerExportMock.mockReturnValueOnce('started').mockReturnValueOnce('busy');
    await renderLayout();
    await openExportSheet();

    const pdf = renderer?.root.findByProps({ testID: 'android-export-modal-pdf' });
    await act(async () => {
      pdf?.props.onPress();
      pdf?.props.onPress();
    });

    expect(renderer?.root.findByProps({ testID: 'android-export-modal-card' })).toBeDefined();
  });

  it('closes the Android progress modal after a started export finishes', async () => {
    await renderLayout();
    await openExportSheet();

    await act(async () => {
      renderer?.root.findByProps({ testID: 'android-export-modal-pdf' }).props.onPress();
    });
    expect(renderer?.root.findByProps({ testID: 'android-export-modal-card' })).toBeDefined();

    exportState.isExporting = true;
    await rerenderLayout();
    expect(renderer?.root.findByProps({ testID: 'android-export-modal-card' })).toBeDefined();

    exportState.isExporting = false;
    await rerenderLayout();
    expect(() => renderer?.root.findByProps({ testID: 'android-export-modal-card' })).toThrow();
  });

  it('closes an Android sheet handled synchronously without marking it blocked', async () => {
    triggerExportMock.mockReturnValue('handled');
    await renderLayout();
    await openExportSheet();

    await act(async () => {
      renderer?.root.findByProps({ testID: 'android-export-modal-pdf' }).props.onPress();
    });

    expect(() => renderer?.root.findByProps({ testID: 'android-export-modal-card' })).toThrow();
    expect(trackEventMock.mock.calls.some(([event]) => event === 'export_sheet_blocked')).toBe(
      false,
    );
  });

  it('resolves a blocked iOS selection without classifying it as abandonment', async () => {
    Platform.OS = 'ios';
    triggerExportMock.mockReturnValue('validation_blocked');
    let selectionCallback: ((buttonIndex: number) => void) | undefined;
    vi.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation(
      (_options, callback) => {
        selectionCallback = callback;
      },
    );
    await renderLayout();
    await openExportSheet();

    await act(async () => selectionCallback?.(0));

    expect(trackEventMock.mock.calls.some(([event]) => event === 'export_sheet_abandoned')).toBe(
      false,
    );
    expect(trackEventMock).toHaveBeenCalledWith(
      'export_sheet_blocked',
      expect.objectContaining({ platform: 'ios', reason: 'validation' }),
    );
  });
});
