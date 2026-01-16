import { useCallback, useEffect, useRef } from 'react';
import * as StoreReview from 'expo-store-review';
import {
  hasRequestedReview,
  incrementAppOpens,
  markReviewRequested,
  shouldRequestReview,
} from '../lib/storage/review';

/**
 * Hook to manage store review requests.
 *
 * - Tracks app opens automatically
 * - Provides a function to request review at appropriate moments
 * - Only requests review once per user, after 5+ app opens
 * - Uses native in-app review dialog (non-intrusive)
 */
export function useStoreReview() {
  const hasTrackedOpen = useRef(false);

  // Track app open on mount (once per session)
  useEffect(() => {
    if (hasTrackedOpen.current) return;
    hasTrackedOpen.current = true;
    incrementAppOpens().catch(() => {});
  }, []);

  /**
   * Request a store review if conditions are met:
   * - User has opened the app 5+ times
   * - User hasn't been asked before
   * - Device supports in-app review
   */
  const requestReviewIfAppropriate = useCallback(async () => {
    try {
      // Check if we should request
      const should = await shouldRequestReview();
      if (!should) return false;

      // Check if the device supports in-app review
      const isAvailable = await StoreReview.isAvailableAsync();
      if (!isAvailable) return false;

      // Check if we can actually request (some platforms have rate limits)
      const hasAction = await StoreReview.hasAction();
      if (!hasAction) return false;

      // Request the review
      await StoreReview.requestReview();

      // Mark as requested (even if user dismissed - we don't want to ask again)
      await markReviewRequested();

      return true;
    } catch {
      // Silently fail - review requests should never break the app
      return false;
    }
  }, []);

  /**
   * Check if the user has already been asked for a review.
   */
  const checkIfAlreadyRequested = useCallback(async () => {
    return hasRequestedReview();
  }, []);

  return {
    requestReviewIfAppropriate,
    checkIfAlreadyRequested,
  };
}
