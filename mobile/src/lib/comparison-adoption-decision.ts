export const COMPARISON_SAVED_USER_THRESHOLD = 100;
export const COMPARISON_ELAPSED_DAY_THRESHOLD = 90;
export const COMPARISON_ADOPTION_THRESHOLD = 0.1;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface ComparisonAdoptionSnapshot {
  releaseStartedAt: number;
  evaluatedAt: number;
  savedScenarioUsers: number;
  savedScenarioThresholdReachedAt: number | null;
  comparisonStartedAmongSavedUsers: number;
}

export interface ComparisonAdoptionDecisionResult {
  decision: 'wait' | 'fold_into_calculator' | 'keep_comparison';
  thresholdReachedBy: 'saved_scenario_users' | 'elapsed_days' | null;
  elapsedDays: number;
  adoptionRate: number | null;
}

export function evaluateComparisonAdoptionDecision(
  snapshot: ComparisonAdoptionSnapshot,
): ComparisonAdoptionDecisionResult {
  if (
    !Number.isFinite(snapshot.releaseStartedAt) ||
    !Number.isFinite(snapshot.evaluatedAt) ||
    snapshot.evaluatedAt < snapshot.releaseStartedAt
  ) {
    throw new Error('Informe uma janela de avaliação válida.');
  }
  const counts = [snapshot.savedScenarioUsers, snapshot.comparisonStartedAmongSavedUsers];
  if (
    counts.some((count) => !Number.isSafeInteger(count) || count < 0) ||
    snapshot.comparisonStartedAmongSavedUsers > snapshot.savedScenarioUsers
  ) {
    throw new Error('Há contagens de usuários distintos inconsistentes no snapshot.');
  }
  if (snapshot.savedScenarioThresholdReachedAt === undefined) {
    throw new Error('Informe savedScenarioThresholdReachedAt como timestamp ou null.');
  }
  if (
    snapshot.savedScenarioUsers >= COMPARISON_SAVED_USER_THRESHOLD &&
    snapshot.savedScenarioThresholdReachedAt === null
  ) {
    throw new Error('Informe o timestamp do 100º usuário distinto com scenario_saved.');
  }
  if (
    snapshot.savedScenarioUsers < COMPARISON_SAVED_USER_THRESHOLD &&
    snapshot.savedScenarioThresholdReachedAt !== null
  ) {
    throw new Error('Não informe o timestamp do 100º usuário antes de 100 usuários distintos.');
  }
  if (
    snapshot.savedScenarioThresholdReachedAt !== null &&
    (!Number.isFinite(snapshot.savedScenarioThresholdReachedAt) ||
      snapshot.savedScenarioThresholdReachedAt < snapshot.releaseStartedAt ||
      snapshot.savedScenarioThresholdReachedAt > snapshot.evaluatedAt)
  ) {
    throw new Error('O timestamp do 100º usuário deve estar na janela pós-release.');
  }

  const elapsedDays = Math.floor((snapshot.evaluatedAt - snapshot.releaseStartedAt) / DAY_MS);
  const elapsedThresholdAt = snapshot.releaseStartedAt + COMPARISON_ELAPSED_DAY_THRESHOLD * DAY_MS;
  const userThresholdAt =
    snapshot.savedScenarioUsers >= COMPARISON_SAVED_USER_THRESHOLD
      ? snapshot.savedScenarioThresholdReachedAt
      : null;
  const firstThresholdAt =
    userThresholdAt === null ? elapsedThresholdAt : Math.min(userThresholdAt, elapsedThresholdAt);
  if (snapshot.evaluatedAt < firstThresholdAt) {
    return { decision: 'wait', thresholdReachedBy: null, elapsedDays, adoptionRate: null };
  }

  const thresholdReachedBy =
    userThresholdAt !== null && userThresholdAt <= elapsedThresholdAt
      ? ('saved_scenario_users' as const)
      : ('elapsed_days' as const);
  if (
    thresholdReachedBy === 'saved_scenario_users' &&
    snapshot.savedScenarioUsers !== COMPARISON_SAVED_USER_THRESHOLD
  ) {
    throw new Error('No primeiro limiar por usuários, a contagem deve ser exatamente 100.');
  }
  if (snapshot.evaluatedAt > firstThresholdAt) {
    throw new Error('As contagens devem terminar exatamente no primeiro limiar alcançado.');
  }
  if (snapshot.savedScenarioUsers === 0) {
    return {
      decision: 'wait',
      thresholdReachedBy,
      elapsedDays,
      adoptionRate: null,
    };
  }
  const adoptionRate = snapshot.comparisonStartedAmongSavedUsers / snapshot.savedScenarioUsers;
  return {
    decision:
      adoptionRate < COMPARISON_ADOPTION_THRESHOLD ? 'fold_into_calculator' : 'keep_comparison',
    thresholdReachedBy,
    elapsedDays,
    adoptionRate,
  };
}
