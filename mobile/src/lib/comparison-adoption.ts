import { trackEvent } from './analytics';
import {
  claimComparisonStarted,
  startNewComparisonAdoptionSession,
} from './comparison-adoption-session';

export function trackComparisonStartedOnce() {
  if (!claimComparisonStarted()) return false;
  trackEvent('comparison_started');
  return true;
}

export function resetComparisonStartedForTests() {
  startNewComparisonAdoptionSession();
}
