/* eslint-disable import/first */
import React, { useEffect } from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  hasActionMock,
  hasRequestedReviewMock,
  isReviewSessionBlockedMock,
  isAvailableAsyncMock,
  markReviewRequestedMock,
  recordReviewPositiveActionMock,
  requestReviewMock,
  trackEventMock,
} = vi.hoisted(() => ({
  hasActionMock: vi.fn(),
  hasRequestedReviewMock: vi.fn(),
  isReviewSessionBlockedMock: vi.fn(),
  isAvailableAsyncMock: vi.fn(),
  markReviewRequestedMock: vi.fn(),
  recordReviewPositiveActionMock: vi.fn(),
  requestReviewMock: vi.fn(),
  trackEventMock: vi.fn(),
}));

vi.mock('expo-store-review', () => ({
  hasAction: hasActionMock,
  isAvailableAsync: isAvailableAsyncMock,
  requestReview: requestReviewMock,
}));

vi.mock('../../lib/analytics', () => ({
  trackEvent: trackEventMock,
}));

vi.mock('../../lib/storage/review', () => ({
  hasRequestedReview: hasRequestedReviewMock,
  isReviewSessionBlocked: isReviewSessionBlockedMock,
  markReviewRequested: markReviewRequestedMock,
  recordReviewPositiveAction: recordReviewPositiveActionMock,
}));

import { useStoreReview } from '../useStoreReview';

function HookHarness({
  onChange,
}: {
  onChange: (value: ReturnType<typeof useStoreReview>) => void;
}) {
  const value = useStoreReview();

  useEffect(() => {
    onChange(value);
  }, [onChange, value]);

  return null;
}

describe('useStoreReview', () => {
  let renderer: ReactTestRenderer | null = null;
  let latestValue: ReturnType<typeof useStoreReview> | null = null;

  beforeEach(async () => {
    latestValue = null;
    hasActionMock.mockReset().mockResolvedValue(true);
    hasRequestedReviewMock.mockReset().mockResolvedValue(false);
    isReviewSessionBlockedMock.mockReset().mockReturnValue(false);
    isAvailableAsyncMock.mockReset().mockResolvedValue(true);
    markReviewRequestedMock.mockReset().mockResolvedValue(undefined);
    recordReviewPositiveActionMock.mockReset().mockResolvedValue(false);
    requestReviewMock.mockReset().mockResolvedValue(undefined);
    trackEventMock.mockReset();

    await act(async () => {
      renderer = TestRenderer.create(
        React.createElement(HookHarness, {
          onChange: (value) => {
            latestValue = value;
          },
        }),
      );
    });
  });

  afterEach(async () => {
    await act(async () => {
      renderer?.unmount();
    });
    renderer = null;
  });

  it('requests the native review and marks the install after an eligible action', async () => {
    recordReviewPositiveActionMock.mockResolvedValue(true);

    let requested = false;
    await act(async () => {
      requested = (await latestValue?.requestReviewIfAppropriate('export_success')) ?? false;
    });

    expect(requested).toBe(true);
    expect(recordReviewPositiveActionMock).toHaveBeenCalledWith('export_success');
    expect(trackEventMock).toHaveBeenCalledWith('review_prompt_requested', {
      trigger: 'export_success',
    });
    expect(requestReviewMock).toHaveBeenCalledOnce();
    expect(markReviewRequestedMock).toHaveBeenCalledOnce();
    expect(trackEventMock.mock.invocationCallOrder[0]).toBeLessThan(
      requestReviewMock.mock.invocationCallOrder[0],
    );
  });

  it('records a suppressed positive action without competing with another prompt', async () => {
    recordReviewPositiveActionMock.mockResolvedValue(true);

    let requested = true;
    await act(async () => {
      requested =
        (await latestValue?.requestReviewIfAppropriate('scenario_saved', {
          suppressPrompt: true,
        })) ?? true;
    });

    expect(requested).toBe(false);
    expect(recordReviewPositiveActionMock).toHaveBeenCalledWith('scenario_saved');
    expect(isAvailableAsyncMock).not.toHaveBeenCalled();
    expect(trackEventMock).not.toHaveBeenCalled();
    expect(markReviewRequestedMock).not.toHaveBeenCalled();
  });

  it('does not emit a request signal when the native action is unavailable', async () => {
    recordReviewPositiveActionMock.mockResolvedValue(true);
    hasActionMock.mockResolvedValue(false);

    await act(async () => {
      await latestValue?.requestReviewIfAppropriate('export_success');
    });

    expect(requestReviewMock).not.toHaveBeenCalled();
    expect(trackEventMock).not.toHaveBeenCalled();
    expect(markReviewRequestedMock).not.toHaveBeenCalled();
  });

  it('rechecks the session block immediately before requesting the native prompt', async () => {
    recordReviewPositiveActionMock.mockResolvedValue(true);
    isReviewSessionBlockedMock.mockReturnValue(true);

    await act(async () => {
      await latestValue?.requestReviewIfAppropriate('export_success');
    });

    expect(requestReviewMock).not.toHaveBeenCalled();
    expect(trackEventMock).not.toHaveBeenCalled();
    expect(markReviewRequestedMock).not.toHaveBeenCalled();
  });

  it('force-triggers the native action in dev without consuming once-per-install state', async () => {
    let requested = false;
    await act(async () => {
      requested = (await latestValue?.forceReviewPromptForDev()) ?? false;
    });

    expect(requested).toBe(true);
    expect(recordReviewPositiveActionMock).not.toHaveBeenCalled();
    expect(trackEventMock).toHaveBeenCalledWith('review_prompt_requested', {
      trigger: 'dev_force',
    });
    expect(requestReviewMock).toHaveBeenCalledOnce();
    expect(markReviewRequestedMock).not.toHaveBeenCalled();
  });
});
