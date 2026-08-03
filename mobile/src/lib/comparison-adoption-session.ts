let comparisonStarted = false;

export function startNewComparisonAdoptionSession() {
  comparisonStarted = false;
}

export function claimComparisonStarted() {
  if (comparisonStarted) return false;
  comparisonStarted = true;
  return true;
}
