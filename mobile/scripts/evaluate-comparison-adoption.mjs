import { evaluateComparisonAdoptionDecision } from '../src/lib/comparison-adoption-decision.ts';

const rawSnapshot = process.argv[2];
if (!rawSnapshot) {
  throw new Error(
    'Informe um snapshot JSON como primeiro argumento. Veja mobile/docs/TRACKING_PLAN.md.',
  );
}

const result = evaluateComparisonAdoptionDecision(JSON.parse(rawSnapshot));
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
