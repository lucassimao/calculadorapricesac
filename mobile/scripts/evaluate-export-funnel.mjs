import { evaluateExportFunnelDecision } from '../src/lib/export-funnel-decision.ts';

const rawSnapshot = process.argv[2];

if (!rawSnapshot) {
  throw new Error(
    'Informe um snapshot JSON como primeiro argumento. Veja mobile/docs/TRACKING_PLAN.md.',
  );
}

const result = evaluateExportFunnelDecision(JSON.parse(rawSnapshot));

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
