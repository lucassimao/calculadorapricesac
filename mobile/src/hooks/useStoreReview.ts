import { useCallback } from 'react';
import * as StoreReview from 'expo-store-review';
import { trackEvent } from '../lib/analytics';
import {
  hasRequestedReview,
  isReviewSessionBlocked,
  markReviewRequested,
  recordReviewPositiveAction,
  type ReviewTrigger,
} from '../lib/storage/review';

let reviewRequestInFlight = false;

export function useStoreReview() {
  const requestNativeReview = useCallback(
    async (trigger: ReviewTrigger | 'dev_force', persistRequested: boolean) => {
      if (reviewRequestInFlight) return false;
      reviewRequestInFlight = true;
      try {
        const isAvailable = await StoreReview.isAvailableAsync();
        if (!isAvailable) return false;
        const hasAction = await StoreReview.hasAction();
        if (!hasAction) return false;
        if (persistRequested && isReviewSessionBlocked()) return false;
        trackEvent('review_prompt_requested', { trigger });
        await StoreReview.requestReview();
        if (persistRequested) await markReviewRequested();
        return true;
      } catch {
        return false;
      } finally {
        reviewRequestInFlight = false;
      }
    },
    [],
  );

  const requestReviewIfAppropriate = useCallback(
    async (
      trigger: ReviewTrigger,
      { suppressPrompt = false }: { suppressPrompt?: boolean } = {},
    ) => {
      try {
        const eligible = await recordReviewPositiveAction(trigger);
        if (!eligible || suppressPrompt) return false;
        return requestNativeReview(trigger, true);
      } catch {
        return false;
      }
    },
    [requestNativeReview],
  );

  const forceReviewPromptForDev = useCallback(
    () => requestNativeReview('dev_force', false),
    [requestNativeReview],
  );

  const checkIfAlreadyRequested = useCallback(async () => hasRequestedReview(), []);

  return {
    requestReviewIfAppropriate,
    forceReviewPromptForDev,
    checkIfAlreadyRequested,
  };
}
