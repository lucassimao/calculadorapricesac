# Web SAC/Price Calculator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a working in-browser SAC/Price financing calculator as the calculator-first homepage of `marketing/`, serving as the Google Ads landing page that funnels to App Store installs.

**Architecture:** Extract the existing loan engine into a `shared/loan-engine/` folder consumed by both apps (mobile keeps working via one-line re-export shims; marketing imports it via a path alias + Next `externalDir`). The homepage stays a server component; the calculator is a client island that runs the engine for both SAC and PRICE on every keystroke and shows a comparison, chart, table preview, and an App Store unlock CTA wired to conversion tracking.

**Tech Stack:** Next.js 16 (App Router, Turbopack), React 19, TypeScript, CSS Modules, vitest, Vercel Analytics, Expo/Metro (mobile side).

**Reference spec:** `docs/superpowers/specs/2026-06-02-web-sac-price-calculator-design.md`

---

## File Structure

**New shared engine (single source of truth):**
- `shared/loan-engine/loan.ts` — types (moved from `mobile/src/types/loan.ts`)
- `shared/loan-engine/calculations.ts` — engine (moved from `mobile/src/lib/calculations.ts`)
- `shared/loan-engine/__tests__/calculations.test.ts` — moved test (optional; mobile test still covers via shim)

**Mobile (minimal, low-risk changes):**
- `mobile/src/types/loan.ts` — becomes a re-export shim
- `mobile/src/lib/calculations.ts` — becomes a re-export shim
- `mobile/metro.config.js` — add repo root to `watchFolders`

**Marketing (new calculator):**
- `marketing/vitest.config.ts` — vitest config (jsdom)
- `marketing/test/setup.ts` — testing-library setup
- `marketing/app/components/Simulator/types.ts` — `SimulatorInputs` type
- `marketing/app/components/Simulator/buildScenarios.ts` — inputs → `{ sac, price }` Scenario
- `marketing/app/components/Simulator/format.ts` — `formatPercent`, `sampleBalances`
- `marketing/app/components/Simulator/InputsForm.tsx`
- `marketing/app/components/Simulator/ResultsComparison.tsx`
- `marketing/app/components/Simulator/BalanceChart.tsx`
- `marketing/app/components/Simulator/TablePreview.tsx`
- `marketing/app/components/Simulator/UnlockCTA.tsx`
- `marketing/app/components/Simulator/Simulator.tsx` — container (client island)
- `marketing/app/components/Simulator/Simulator.module.css`
- `marketing/app/components/Simulator/__tests__/buildScenarios.test.ts`
- `marketing/app/components/Simulator/__tests__/format.test.ts`
- `marketing/app/components/Simulator/__tests__/Simulator.test.tsx`

**Marketing (modified):**
- `marketing/tsconfig.json` — add `@loan-engine/*` alias + include `../shared`
- `marketing/next.config.ts` — `experimental.externalDir`
- `marketing/package.json` — add vitest + testing-library devDeps, `test` script
- `marketing/app/AppStoreLink.tsx` — also fire Google Ads conversion
- `marketing/app/layout.tsx` — load `gtag.js` (guarded by env var)
- `marketing/app/page.tsx` — replace static preview card with `<Simulator/>`, reorder hero
- `marketing/app/page.module.css` — minor layout tweak for calculator-first hero

---

## Task 1: Extract loan engine into `shared/loan-engine/` (mobile stays green)

This is a pure refactor. The existing mobile vitest suite is the safety net — it must pass before and after.

**Files:**
- Create: `shared/loan-engine/loan.ts`
- Create: `shared/loan-engine/calculations.ts`
- Modify: `mobile/src/types/loan.ts` (→ shim)
- Modify: `mobile/src/lib/calculations.ts` (→ shim)
- Modify: `mobile/metro.config.js`

- [ ] **Step 1: Baseline — run the mobile engine tests (must be green)**

Run: `cd mobile && npm test`
Expected: PASS (existing `calculations.test.ts` suite green). Record the passing count.

- [ ] **Step 2: Move the types file verbatim into the shared folder**

Copy the full current contents of `mobile/src/types/loan.ts` into a new file `shared/loan-engine/loan.ts`, unchanged. (It has no imports, so nothing to rewrite.)

- [ ] **Step 3: Move the engine into the shared folder and fix its one internal import**

Copy the full current contents of `mobile/src/lib/calculations.ts` into `shared/loan-engine/calculations.ts`. Change ONLY the first import line so it points at the sibling types file:

```ts
// shared/loan-engine/calculations.ts (first line)
import type { FgtsEvent, LoanSummary, PrepaymentEvent, Scenario, ScheduleRow } from './loan';
```

Everything else stays identical.

- [ ] **Step 4: Replace the mobile types file with a re-export shim**

Overwrite `mobile/src/types/loan.ts` with:

```ts
// Re-export shim. Source of truth: shared/loan-engine/loan.ts
export * from '../../../shared/loan-engine/loan';
```

- [ ] **Step 5: Replace the mobile engine file with a re-export shim**

Overwrite `mobile/src/lib/calculations.ts` with:

```ts
// Re-export shim. Source of truth: shared/loan-engine/calculations.ts
export * from '../../../shared/loan-engine/calculations';
```

- [ ] **Step 6: Let Metro resolve files above `mobile/`**

Overwrite `mobile/metro.config.js` with:

```js
const path = require('path');
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

const config = getSentryExpoConfig(__dirname);

// Allow importing the shared loan engine from the repo root (../shared)
config.watchFolders = [...(config.watchFolders ?? []), path.resolve(__dirname, '..')];

module.exports = config;
```

- [ ] **Step 7: Re-run the mobile engine tests (must still be green via the shims)**

Run: `cd mobile && npm test`
Expected: PASS with the same count as Step 1. The test imports `../calculations` and `../../types/loan`, which now resolve through the shims to the shared code.

- [ ] **Step 8: Typecheck mobile**

Run: `cd mobile && npx tsc --noEmit`
Expected: No errors. (Relative shim paths resolve under `strict`.)

- [ ] **Step 9: Commit**

```bash
git add shared/loan-engine mobile/src/types/loan.ts mobile/src/lib/calculations.ts mobile/metro.config.js
git commit -m "refactor: extract loan engine into shared/loan-engine with mobile shims"
```

---

## Task 2: Wire marketing to the shared engine + set up vitest

**Files:**
- Modify: `marketing/tsconfig.json`
- Modify: `marketing/next.config.ts`
- Modify: `marketing/package.json`
- Create: `marketing/vitest.config.ts`
- Create: `marketing/test/setup.ts`
- Create: `marketing/app/components/Simulator/__tests__/engine-parity.test.ts`

- [ ] **Step 1: Add the path alias + include the shared folder in tsconfig**

In `marketing/tsconfig.json`, set `paths` and `include` to:

```jsonc
"paths": {
  "@/*": ["./*"],
  "@loan-engine/*": ["../shared/loan-engine/*"]
}
```
and add `"../shared/**/*.ts"` to the `include` array (after `"**/*.tsx"`).

- [ ] **Step 2: Allow Next to compile files outside the app dir**

Overwrite `marketing/next.config.ts` with:

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Import the shared loan engine from ../shared (outside the marketing app dir)
  experimental: {
    externalDir: true,
  },
};

export default nextConfig;
```

- [ ] **Step 3: Add test dependencies and a `test` script**

Run:
```bash
cd marketing && pnpm add -D vitest@^4 @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
```
Then add to `marketing/package.json` `scripts`: `"test": "vitest run"`.

- [ ] **Step 4: Create the vitest config**

Create `marketing/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@loan-engine': fileURLToPath(new URL('../shared/loan-engine', import.meta.url)),
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
  },
});
```

- [ ] **Step 5: Create the testing-library setup file**

Create `marketing/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 6: Write a failing engine-parity test (proves the alias resolves)**

Create `marketing/app/components/Simulator/__tests__/engine-parity.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  generateAmortizationSchedule,
  calculateLoanSummary,
} from '@loan-engine/calculations';
import type { Scenario } from '@loan-engine/loan';

function base(system: 'SAC' | 'PRICE'): Scenario {
  return {
    id: 't',
    name: 'parity',
    system,
    loanMode: 'property',
    propertyValue: 400000,
    downPayment: 80000,
    principal: 320000,
    rate: 11.5,
    rateType: 'annual',
    term: 30,
    termUnit: 'years',
    startDate: new Date(2026, 0, 1),
    dueDay: 1,
  };
}

describe('shared engine is reachable from marketing', () => {
  it('produces a 361-row schedule (row 0 + 360 months) for a 30y loan', () => {
    const schedule = generateAmortizationSchedule(base('SAC'));
    expect(schedule).toHaveLength(361);
  });

  it('SAC pays less total interest than PRICE for the same loan', () => {
    const sac = calculateLoanSummary(generateAmortizationSchedule(base('SAC')), base('SAC'));
    const price = calculateLoanSummary(generateAmortizationSchedule(base('PRICE')), base('PRICE'));
    expect(sac.totalInterest).toBeLessThan(price.totalInterest);
  });
});
```

- [ ] **Step 7: Run the test — expect PASS**

Run: `cd marketing && pnpm test`
Expected: PASS (both assertions). If the alias fails to resolve, fix Step 4 before continuing.

- [ ] **Step 8: Verify the production build still compiles with externalDir**

Run: `cd marketing && pnpm build`
Expected: `Compiled successfully`, output shows `✓ externalDir`.

- [ ] **Step 9: Commit**

```bash
git add marketing/tsconfig.json marketing/next.config.ts marketing/package.json marketing/pnpm-lock.yaml marketing/vitest.config.ts marketing/test/setup.ts marketing/app/components/Simulator/__tests__/engine-parity.test.ts
git commit -m "build(marketing): consume shared loan engine + add vitest"
```

---

## Task 3: `buildScenarios` — map UI inputs to two Scenarios (TDD)

**Files:**
- Create: `marketing/app/components/Simulator/types.ts`
- Create: `marketing/app/components/Simulator/buildScenarios.ts`
- Test: `marketing/app/components/Simulator/__tests__/buildScenarios.test.ts`

- [ ] **Step 1: Define the input type**

Create `marketing/app/components/Simulator/types.ts`:

```ts
export interface SimulatorInputs {
  /** Valor do imóvel, em reais. */
  propertyValue: number;
  /** Entrada, em reais. */
  downPayment: number;
  /** Taxa de juros anual, em % (ex.: 11.5 = 11,5% a.a.). */
  annualRate: number;
  /** Prazo, em anos. */
  termYears: number;
}

export const DEFAULT_INPUTS: SimulatorInputs = {
  propertyValue: 400000,
  downPayment: 80000,
  annualRate: 11.5,
  termYears: 30,
};
```

- [ ] **Step 2: Write the failing test**

Create `marketing/app/components/Simulator/__tests__/buildScenarios.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildScenarios } from '../buildScenarios';
import { DEFAULT_INPUTS } from '../types';
import {
  generateAmortizationSchedule,
  calculateLoanSummary,
} from '@loan-engine/calculations';

describe('buildScenarios', () => {
  it('derives the financed principal from propertyValue - downPayment', () => {
    const { sac, price } = buildScenarios(DEFAULT_INPUTS);
    expect(sac.principal).toBe(320000);
    expect(price.principal).toBe(320000);
    expect(sac.propertyValue).toBe(400000);
    expect(sac.downPayment).toBe(80000);
    expect(sac.loanMode).toBe('property');
  });

  it('sets the two systems, annual rate, and year term', () => {
    const { sac, price } = buildScenarios(DEFAULT_INPUTS);
    expect(sac.system).toBe('SAC');
    expect(price.system).toBe('PRICE');
    expect(sac.rate).toBe(11.5);
    expect(sac.rateType).toBe('annual');
    expect(sac.term).toBe(30);
    expect(sac.termUnit).toBe('years');
  });

  it('produces summaries where SAC first payment > last and PRICE is flat', () => {
    const { sac, price } = buildScenarios(DEFAULT_INPUTS);
    const sacSum = calculateLoanSummary(generateAmortizationSchedule(sac), sac);
    const priceSum = calculateLoanSummary(generateAmortizationSchedule(price), price);
    expect(sacSum.firstPayment).toBeGreaterThan(sacSum.lastPayment);
    expect(priceSum.firstPayment).toBeCloseTo(priceSum.lastPayment, 0);
    expect(sacSum.cetAnnualRate).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd marketing && pnpm test buildScenarios`
Expected: FAIL with "buildScenarios is not a function" / module not found.

- [ ] **Step 4: Implement `buildScenarios`**

Create `marketing/app/components/Simulator/buildScenarios.ts`:

```ts
import type { Scenario } from '@loan-engine/loan';
import type { SimulatorInputs } from './types';

function makeScenario(system: 'SAC' | 'PRICE', inputs: SimulatorInputs): Scenario {
  const principal = Math.max(inputs.propertyValue - inputs.downPayment, 0);
  return {
    id: `web-${system.toLowerCase()}`,
    name: system,
    system,
    loanMode: 'property',
    propertyValue: inputs.propertyValue,
    downPayment: inputs.downPayment,
    principal,
    rate: inputs.annualRate,
    rateType: 'annual',
    term: inputs.termYears,
    termUnit: 'years',
    startDate: new Date(2026, 0, 1),
    dueDay: 1,
  };
}

export function buildScenarios(inputs: SimulatorInputs): { sac: Scenario; price: Scenario } {
  return {
    sac: makeScenario('SAC', inputs),
    price: makeScenario('PRICE', inputs),
  };
}
```

Note: `startDate` is a fixed constant (not `new Date()`) so results are deterministic and SSR/CSR-stable; the date only affects row labels, which the lite UI does not display.

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd marketing && pnpm test buildScenarios`
Expected: PASS (all 3 tests).

- [ ] **Step 6: Commit**

```bash
git add marketing/app/components/Simulator/types.ts marketing/app/components/Simulator/buildScenarios.ts marketing/app/components/Simulator/__tests__/buildScenarios.test.ts
git commit -m "feat(simulator): inputs -> SAC/PRICE scenario builder"
```

---

## Task 4: Formatting + chart sampling helpers (TDD)

**Files:**
- Create: `marketing/app/components/Simulator/format.ts`
- Test: `marketing/app/components/Simulator/__tests__/format.test.ts`

- [ ] **Step 1: Write the failing test**

Create `marketing/app/components/Simulator/__tests__/format.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatPercent, sampleBalances } from '../format';
import type { ScheduleRow } from '@loan-engine/loan';

describe('formatPercent', () => {
  it('formats with pt-BR comma and one decimal', () => {
    expect(formatPercent(13.84)).toBe('13,8%');
  });
});

describe('sampleBalances', () => {
  const rows: ScheduleRow[] = Array.from({ length: 361 }, (_, i) => ({
    installmentNumber: i,
    date: new Date(2026, 0, 1),
    payment: 0,
    interest: 0,
    amortization: 0,
    balance: 361 - i, // strictly decreasing 361..1
  }));

  it('downsamples to the requested point count, keeping first and last', () => {
    const out = sampleBalances(rows, 24);
    expect(out).toHaveLength(24);
    expect(out[0]).toBe(361);
    expect(out[out.length - 1]).toBe(1);
  });

  it('never returns more points than rows', () => {
    expect(sampleBalances(rows.slice(0, 5), 24)).toHaveLength(5);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd marketing && pnpm test format`
Expected: FAIL ("formatPercent is not a function").

- [ ] **Step 3: Implement the helpers**

Create `marketing/app/components/Simulator/format.ts`:

```ts
import type { ScheduleRow } from '@loan-engine/loan';

const percentFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function formatPercent(value: number): string {
  return `${percentFormatter.format(value)}%`;
}

/** Evenly downsample a schedule's balances to `points` values, always keeping first and last. */
export function sampleBalances(rows: ScheduleRow[], points: number): number[] {
  if (rows.length <= points) return rows.map((r) => r.balance);
  const out: number[] = [];
  for (let i = 0; i < points; i++) {
    const idx = Math.round((i * (rows.length - 1)) / (points - 1));
    out.push(rows[idx].balance);
  }
  return out;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd marketing && pnpm test format`
Expected: PASS (all assertions).

- [ ] **Step 5: Commit**

```bash
git add marketing/app/components/Simulator/format.ts marketing/app/components/Simulator/__tests__/format.test.ts
git commit -m "feat(simulator): percent formatter + balance downsampler"
```

---

## Task 5: Styles + InputsForm component

**Files:**
- Create: `marketing/app/components/Simulator/Simulator.module.css`
- Create: `marketing/app/components/Simulator/InputsForm.tsx`

- [ ] **Step 1: Create the CSS module**

Create `marketing/app/components/Simulator/Simulator.module.css` (uses the existing global tokens from `app/globals.css`):

```css
.simulator { display: flex; flex-direction: column; gap: 16px; }

.card {
  background: var(--bg-elevated);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  padding: 16px;
  box-shadow: 0 12px 30px rgba(25, 25, 25, 0.06);
}

.fields { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.field { display: flex; flex-direction: column; gap: 4px; }
.label {
  font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em;
  color: var(--muted); font-weight: 600;
}
.inputWrap {
  display: flex; align-items: center; gap: 6px;
  background: #fff; border: 1px solid var(--line);
  border-radius: var(--radius-sm); padding: 9px 11px;
}
.inputWrap:focus-within { border-color: var(--accent); }
.affix { color: var(--muted); font-size: 13px; font-weight: 500; }
.input {
  border: 0; outline: 0; background: transparent; width: 100%;
  font: inherit; font-weight: 600; font-size: 15px; color: var(--ink);
}
.error { color: #b3261e; font-size: 12px; margin: 2px 0 0; }

.results { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.tile { border-radius: var(--radius-md); padding: 14px; }
.tileSac { background: var(--accent-soft); }
.tilePrice { background: var(--highlight); }
.tileName { display: flex; justify-content: space-between; align-items: baseline; font-weight: 700; margin-bottom: 8px; }
.tileName small { font-weight: 500; color: var(--muted); font-size: 11px; }
.kv { display: flex; justify-content: space-between; font-size: 12px; color: var(--muted); margin: 4px 0; }
.kv b { color: var(--ink); font-weight: 700; }

.chartCard { padding: 12px 14px; }
.chart { width: 100%; height: 64px; display: block; }
.legend { display: flex; gap: 14px; font-size: 11px; color: var(--muted); margin-top: 6px; }
.legendDot { display: inline-block; width: 9px; height: 9px; border-radius: 2px; margin-right: 5px; vertical-align: middle; }

.tablePreview { position: relative; overflow: hidden; }
.table { width: 100%; border-collapse: collapse; font-size: 12px; }
.table th { text-align: right; color: var(--muted); font-weight: 600; font-size: 10px; text-transform: uppercase; padding: 4px 0; }
.table th:first-child, .table td:first-child { text-align: left; }
.table td { text-align: right; padding: 5px 0; border-top: 1px solid var(--line); }
.tableFade { position: absolute; left: 0; right: 0; bottom: 0; height: 48px; background: linear-gradient(transparent, var(--bg-elevated)); pointer-events: none; }
.tableCaption { text-align: center; font-size: 12px; color: var(--muted); margin: 8px 0 0; }

.unlock { background: var(--accent-strong); color: #fff; border-radius: var(--radius-md); padding: 16px; text-align: center; }
.unlockTitle { font-weight: 700; margin-bottom: 4px; }
.unlockList { font-size: 12px; opacity: 0.9; line-height: 1.5; margin: 0 0 12px; }

@media (max-width: 520px) {
  .fields { grid-template-columns: 1fr 1fr; }
  .results { grid-template-columns: 1fr; }
}
```

- [ ] **Step 2: Create the InputsForm component**

Create `marketing/app/components/Simulator/InputsForm.tsx`:

```tsx
'use client';

import styles from './Simulator.module.css';
import type { SimulatorInputs } from './types';

const brl = new Intl.NumberFormat('pt-BR');

function parseNumber(raw: string): number {
  const digits = raw.replace(/\D/g, '');
  return digits ? Number(digits) : 0;
}

interface Props {
  value: SimulatorInputs;
  onChange: (next: SimulatorInputs) => void;
  errors: string[];
}

export function InputsForm({ value, onChange, errors }: Props) {
  const set = (patch: Partial<SimulatorInputs>) => onChange({ ...value, ...patch });

  return (
    <div className={styles.card}>
      <div className={styles.fields}>
        <label className={styles.field}>
          <span className={styles.label}>Valor do imóvel</span>
          <span className={styles.inputWrap}>
            <span className={styles.affix}>R$</span>
            <input
              className={styles.input}
              inputMode="numeric"
              aria-label="Valor do imóvel"
              value={brl.format(value.propertyValue)}
              onChange={(e) => set({ propertyValue: parseNumber(e.target.value) })}
            />
          </span>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Entrada</span>
          <span className={styles.inputWrap}>
            <span className={styles.affix}>R$</span>
            <input
              className={styles.input}
              inputMode="numeric"
              aria-label="Entrada"
              value={brl.format(value.downPayment)}
              onChange={(e) => set({ downPayment: parseNumber(e.target.value) })}
            />
          </span>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Taxa de juros</span>
          <span className={styles.inputWrap}>
            <input
              className={styles.input}
              inputMode="decimal"
              aria-label="Taxa de juros anual"
              value={String(value.annualRate).replace('.', ',')}
              onChange={(e) => set({ annualRate: Number(e.target.value.replace(',', '.')) || 0 })}
            />
            <span className={styles.affix}>% a.a.</span>
          </span>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Prazo</span>
          <span className={styles.inputWrap}>
            <input
              className={styles.input}
              inputMode="numeric"
              aria-label="Prazo em anos"
              value={String(value.termYears)}
              onChange={(e) => set({ termYears: parseNumber(e.target.value) })}
            />
            <span className={styles.affix}>anos</span>
          </span>
        </label>
      </div>
      {errors.length > 0 && (
        <p className={styles.error} role="alert">{errors[0]}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `cd marketing && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add marketing/app/components/Simulator/Simulator.module.css marketing/app/components/Simulator/InputsForm.tsx
git commit -m "feat(simulator): inputs form + styles"
```

---

## Task 6: ResultsComparison component

**Files:**
- Create: `marketing/app/components/Simulator/ResultsComparison.tsx`

- [ ] **Step 1: Create the component**

Create `marketing/app/components/Simulator/ResultsComparison.tsx`:

```tsx
import styles from './Simulator.module.css';
import { formatCurrency } from '@loan-engine/calculations';
import type { LoanSummary } from '@loan-engine/loan';
import { formatPercent } from './format';

interface Props {
  sac: LoanSummary;
  price: LoanSummary;
}

export function ResultsComparison({ sac, price }: Props) {
  return (
    <div className={styles.results}>
      <div className={`${styles.tile} ${styles.tileSac}`}>
        <div className={styles.tileName}>
          SAC <small>parcela decrescente</small>
        </div>
        <div className={styles.kv}><span>1ª parcela</span><b>{formatCurrency(sac.firstPayment)}</b></div>
        <div className={styles.kv}><span>Última parcela</span><b>{formatCurrency(sac.lastPayment)}</b></div>
        <div className={styles.kv}><span>Total de juros</span><b>{formatCurrency(sac.totalInterest)}</b></div>
        <div className={styles.kv}><span>CET</span><b>{formatPercent(sac.cetAnnualRate)} a.a.</b></div>
      </div>

      <div className={`${styles.tile} ${styles.tilePrice}`}>
        <div className={styles.tileName}>
          Price <small>parcela fixa</small>
        </div>
        <div className={styles.kv}><span>Parcela</span><b>{formatCurrency(price.firstPayment)}</b></div>
        <div className={styles.kv}><span>Total pago</span><b>{formatCurrency(price.totalPayment)}</b></div>
        <div className={styles.kv}><span>Total de juros</span><b>{formatCurrency(price.totalInterest)}</b></div>
        <div className={styles.kv}><span>CET</span><b>{formatPercent(price.cetAnnualRate)} a.a.</b></div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd marketing && npx tsc --noEmit`
Expected: No errors. (Confirms `LoanSummary` exposes `firstPayment`, `lastPayment`, `totalInterest`, `totalPayment`, `cetAnnualRate` — all defined in `shared/loan-engine/loan.ts`.)

- [ ] **Step 3: Commit**

```bash
git add marketing/app/components/Simulator/ResultsComparison.tsx
git commit -m "feat(simulator): SAC vs Price result tiles"
```

---

## Task 7: BalanceChart component

**Files:**
- Create: `marketing/app/components/Simulator/BalanceChart.tsx`

- [ ] **Step 1: Create the component**

Create `marketing/app/components/Simulator/BalanceChart.tsx`. It draws two SVG polylines (SAC vs Price saldo devedor) from sampled balances. Width/height use a fixed viewBox; the SVG scales to its container.

```tsx
import styles from './Simulator.module.css';

interface Props {
  sacBalances: number[];
  priceBalances: number[];
}

const W = 240;
const H = 64;

function toPath(values: number[], max: number): string {
  if (values.length === 0 || max <= 0) return '';
  return values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * W;
      const y = H - (v / max) * H;
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

export function BalanceChart({ sacBalances, priceBalances }: Props) {
  const max = Math.max(...sacBalances, ...priceBalances, 1);
  return (
    <div className={`${styles.card} ${styles.chartCard}`}>
      <span className={styles.label}>Saldo devedor ao longo do tempo</span>
      <svg
        className={styles.chart}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Evolução do saldo devedor: SAC e Price"
      >
        <path d={toPath(priceBalances, max)} fill="none" stroke="#d64b3c" strokeWidth="2.5" strokeLinecap="round" />
        <path d={toPath(sacBalances, max)} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <div className={styles.legend}>
        <span><span className={styles.legendDot} style={{ background: 'var(--accent)' }} />SAC</span>
        <span><span className={styles.legendDot} style={{ background: '#d64b3c' }} />Price</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd marketing && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add marketing/app/components/Simulator/BalanceChart.tsx
git commit -m "feat(simulator): saldo devedor SVG chart"
```

---

## Task 8: TablePreview component

**Files:**
- Create: `marketing/app/components/Simulator/TablePreview.tsx`

- [ ] **Step 1: Create the component**

Create `marketing/app/components/Simulator/TablePreview.tsx`. Shows the first N real installment rows (skipping row 0), faded at the bottom.

```tsx
import styles from './Simulator.module.css';
import { formatCurrency } from '@loan-engine/calculations';
import type { ScheduleRow } from '@loan-engine/loan';

interface Props {
  rows: ScheduleRow[];
  count?: number;
}

export function TablePreview({ rows, count = 6 }: Props) {
  const preview = rows.filter((r) => r.installmentNumber > 0).slice(0, count);
  return (
    <div className={`${styles.card} ${styles.tablePreview}`}>
      <span className={styles.label}>Tabela de amortização (SAC)</span>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>#</th>
            <th>Parcela</th>
            <th>Juros</th>
            <th>Saldo</th>
          </tr>
        </thead>
        <tbody>
          {preview.map((r) => (
            <tr key={r.installmentNumber}>
              <td>{r.installmentNumber}</td>
              <td>{formatCurrency(r.payment)}</td>
              <td>{formatCurrency(r.interest)}</td>
              <td>{formatCurrency(r.balance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className={styles.tableFade} />
      <p className={styles.tableCaption}>Veja a tabela completa, mês a mês, no app.</p>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd marketing && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add marketing/app/components/Simulator/TablePreview.tsx
git commit -m "feat(simulator): faded amortization table preview"
```

---

## Task 9: Conversion tracking — extend AppStoreLink + UnlockCTA

**Files:**
- Modify: `marketing/app/AppStoreLink.tsx`
- Create: `marketing/app/components/Simulator/UnlockCTA.tsx`

- [ ] **Step 1: Add a Google Ads conversion fire to AppStoreLink**

Overwrite `marketing/app/AppStoreLink.tsx`:

```tsx
'use client';

import { track } from '@vercel/analytics';

type AppStoreLinkProps = {
  href: string;
  /** Where on the page the button lives, e.g. "hero", "cta", "simulator". */
  location: string;
  className?: string;
  children: React.ReactNode;
};

// Google Ads conversion target, e.g. "AW-XXXXXXXXX/abcdEFGhij". No-op until set.
const GADS_CONVERSION = process.env.NEXT_PUBLIC_GADS_CONVERSION;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * App Store download button. Fires a Vercel Analytics event and (when configured)
 * a Google Ads conversion on click, so the Search campaign can optimize on installs.
 */
export function AppStoreLink({ href, location, className, children }: AppStoreLinkProps) {
  const handleClick = () => {
    track('app_store_click', { location });
    if (GADS_CONVERSION && typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'conversion', { send_to: GADS_CONVERSION });
    }
  };
  return (
    <a className={className} href={href} onClick={handleClick}>
      {children}
    </a>
  );
}
```

- [ ] **Step 2: Create the UnlockCTA component**

Create `marketing/app/components/Simulator/UnlockCTA.tsx`:

```tsx
import styles from './Simulator.module.css';
import { AppStoreLink } from '../../AppStoreLink';

const appStoreUrl = 'https://apps.apple.com/br/app/calculadora-sac-price/id6757717537';

export function UnlockCTA() {
  return (
    <div className={styles.unlock}>
      <div className={styles.unlockTitle}>Baixe o app para desbloquear</div>
      <p className={styles.unlockList}>
        FGTS · amortizações extras · custos (IOF, ITBI, seguro, cartório) · tabela completa
        · exportar PDF, XLSX e CSV · salvar cenários
      </p>
      <AppStoreLink className="" href={appStoreUrl} location="simulator">
        <span
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            gap: 8, background: '#fff', color: 'var(--ink)', fontWeight: 600,
            padding: '11px 18px', borderRadius: 14,
          }}
        >
          Baixar na App Store
        </span>
      </AppStoreLink>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `cd marketing && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add marketing/app/AppStoreLink.tsx marketing/app/components/Simulator/UnlockCTA.tsx
git commit -m "feat(simulator): unlock CTA + Google Ads conversion on app store click"
```

---

## Task 10: Simulator container (state + engine + validation) with integration test (TDD)

**Files:**
- Create: `marketing/app/components/Simulator/Simulator.tsx`
- Test: `marketing/app/components/Simulator/__tests__/Simulator.test.tsx`

- [ ] **Step 1: Write the failing integration test**

Create `marketing/app/components/Simulator/__tests__/Simulator.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Simulator } from '../Simulator';

describe('Simulator', () => {
  it('renders SAC and Price results on first paint (default inputs)', () => {
    render(<Simulator />);
    // "1ª parcela" appears only in the SAC tile; "CET" appears once per tile.
    expect(screen.getByText('1ª parcela')).toBeInTheDocument();
    expect(screen.getAllByText('CET')).toHaveLength(2);
  });

  it('hides results and shows an alert when entrada >= valor do imóvel', () => {
    render(<Simulator />);
    // fireEvent.change sets the value in one shot (avoids masked-input typing flakiness).
    fireEvent.change(screen.getByLabelText('Entrada'), { target: { value: '500000' } });
    expect(screen.queryByText('1ª parcela')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
```

Note: `validateScenario` flags this case directly (`shared/loan-engine/calculations.ts`: "Entrada deve ser menor que o valor do imóvel."), so no extra guard is needed in the container.

- [ ] **Step 2: Run to verify it fails**

Run: `cd marketing && pnpm test Simulator`
Expected: FAIL (module `../Simulator` not found).

- [ ] **Step 3: Implement the container**

Create `marketing/app/components/Simulator/Simulator.tsx`:

```tsx
'use client';

import { useMemo, useState } from 'react';
import styles from './Simulator.module.css';
import { DEFAULT_INPUTS, type SimulatorInputs } from './types';
import { buildScenarios } from './buildScenarios';
import { sampleBalances } from './format';
import { InputsForm } from './InputsForm';
import { ResultsComparison } from './ResultsComparison';
import { BalanceChart } from './BalanceChart';
import { TablePreview } from './TablePreview';
import { UnlockCTA } from './UnlockCTA';
import {
  generateAmortizationSchedule,
  calculateLoanSummary,
  validateScenario,
} from '@loan-engine/calculations';

export function Simulator() {
  const [inputs, setInputs] = useState<SimulatorInputs>(DEFAULT_INPUTS);

  const model = useMemo(() => {
    const { sac, price } = buildScenarios(inputs);
    const validation = validateScenario(sac);
    if (validation.errors.length > 0) {
      return { errors: validation.errors, result: null };
    }
    const sacSchedule = generateAmortizationSchedule(sac);
    const priceSchedule = generateAmortizationSchedule(price);
    return {
      errors: [],
      result: {
        sacSummary: calculateLoanSummary(sacSchedule, sac),
        priceSummary: calculateLoanSummary(priceSchedule, price),
        sacSchedule,
        sacBalances: sampleBalances(sacSchedule, 30),
        priceBalances: sampleBalances(priceSchedule, 30),
      },
    };
  }, [inputs]);

  return (
    <div className={styles.simulator}>
      {/* InputsForm renders the validation message (role="alert") when errors is non-empty. */}
      <InputsForm value={inputs} onChange={setInputs} errors={model.errors} />
      {model.result && (
        <>
          <ResultsComparison sac={model.result.sacSummary} price={model.result.priceSummary} />
          <BalanceChart
            sacBalances={model.result.sacBalances}
            priceBalances={model.result.priceBalances}
          />
          <TablePreview rows={model.result.sacSchedule} />
        </>
      )}
      <UnlockCTA />
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd marketing && pnpm test Simulator`
Expected: PASS (both tests). The validator flags entrada ≥ valor deterministically, so results are suppressed and the alert renders.

- [ ] **Step 5: Run the whole marketing suite**

Run: `cd marketing && pnpm test`
Expected: PASS (engine-parity, buildScenarios, format, Simulator).

- [ ] **Step 6: Commit**

```bash
git add marketing/app/components/Simulator/Simulator.tsx marketing/app/components/Simulator/__tests__/Simulator.test.tsx
git commit -m "feat(simulator): container with live recompute + validation"
```

---

## Task 11: Mount the Simulator on the homepage (calculator-first)

**Files:**
- Modify: `marketing/app/page.tsx`
- Modify: `marketing/app/page.module.css`

- [ ] **Step 1: Import the Simulator and replace the static preview card**

In `marketing/app/page.tsx`:
1. Add import near the existing imports:
   ```tsx
   import { Simulator } from './components/Simulator/Simulator';
   ```
2. Replace the entire `<div className={styles.heroCard}> … </div>` block (the static "RESUMO RÁPIDO" + "Gráficos" preview, currently `page.tsx:130-207`) with:
   ```tsx
   <div className={styles.heroCard}>
     <Simulator />
   </div>
   ```
   Leave the left hero column (badge, `<h1>`, subtitle, App Store buttons, chips) unchanged — it already reads as a calculator-first headline.

- [ ] **Step 2: Tighten the hero card for the live tool**

In `marketing/app/page.module.css`, find the `.heroCard` rule and ensure it doesn't force the old fixed preview sizing. Set/adjust it to:

```css
.heroCard {
  width: 100%;
  align-self: start;
}
```
(Remove any `max-width`/`aspect-ratio`/fixed `height` previously constraining the mock card, if present. Keep the surrounding `.hero` grid as-is.)

- [ ] **Step 3: Build and verify the homepage compiles and renders the calculator**

Run: `cd marketing && pnpm build`
Expected: `Compiled successfully`; route `/` listed.

- [ ] **Step 4: Visual smoke check**

Run: `cd marketing && pnpm start -p 3199` (background), then
`agent-browser open http://localhost:3199 && agent-browser set viewport 390 844 && agent-browser screenshot /tmp/sim-mobile.png`
Expected: hero shows the live inputs (400.000 / 80.000 / 11,5 / 30), SAC & Price tiles with numbers, chart, faded table, and the unlock CTA. Stop the server afterward.

- [ ] **Step 5: Commit**

```bash
git add marketing/app/page.tsx marketing/app/page.module.css
git commit -m "feat(home): calculator-first homepage with live SAC/Price simulator"
```

---

## Task 12: Load the Google tag (gtag.js), guarded by env

**Files:**
- Modify: `marketing/app/layout.tsx`

- [ ] **Step 1: Add the Google tag via next/script, only when the env var is set**

In `marketing/app/layout.tsx`:
1. Add imports:
   ```tsx
   import Script from 'next/script';
   ```
2. Read the ID near the other consts:
   ```tsx
   const gadsId = process.env.NEXT_PUBLIC_GADS_ID; // e.g. "AW-XXXXXXXXX"
   ```
3. Inside `<body>`, just before `<Analytics />`, render the tag conditionally:
   ```tsx
   {gadsId && (
     <>
       <Script
         src={`https://www.googletagmanager.com/gtag/js?id=${gadsId}`}
         strategy="afterInteractive"
       />
       <Script id="gtag-init" strategy="afterInteractive">
         {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${gadsId}');`}
       </Script>
     </>
   )}
   ```

- [ ] **Step 2: Document the required env vars**

Append to `marketing/SEO_SHARE_CHECKLIST.md` a short section:

```
## 7) Google Ads (Search → site)
- NEXT_PUBLIC_GADS_ID = AW-XXXXXXXXX        (loads gtag.js)
- NEXT_PUBLIC_GADS_CONVERSION = AW-XXXXXXXXX/label   (fires on App Store click)
Set both in Vercel env. Until set, no Google tag loads and conversions are a no-op.
```

- [ ] **Step 3: Build**

Run: `cd marketing && pnpm build`
Expected: `Compiled successfully` (no gtag loads locally without the env vars — correct).

- [ ] **Step 4: Commit**

```bash
git add marketing/app/layout.tsx marketing/SEO_SHARE_CHECKLIST.md
git commit -m "feat(marketing): optional Google tag for Ads conversion tracking"
```

---

## Task 13: Full verification + deploy notes

**Files:**
- Create: `docs/superpowers/plans/2026-06-02-web-sac-price-calculator-DEPLOY.md`

- [ ] **Step 1: Run both test suites**

Run: `cd mobile && npm test` then `cd ../marketing && pnpm test`
Expected: both PASS.

- [ ] **Step 2: Typecheck + lint + build marketing**

Run: `cd marketing && npx tsc --noEmit && pnpm lint && pnpm build`
Expected: no type errors, lint exit 0, `Compiled successfully` with `✓ externalDir`.

- [ ] **Step 3: Mobile build sanity (Metro can resolve the shared engine)**

Run: `cd mobile && npx expo export --platform ios --output-dir /tmp/expo-export-check`
Expected: export completes without "Unable to resolve" errors for the loan engine. (If `expo export` is heavy in CI, substitute the project's existing typecheck/build command.)

- [ ] **Step 4: Write the deploy checklist**

Create `docs/superpowers/plans/2026-06-02-web-sac-price-calculator-DEPLOY.md`:

```markdown
# Deploy checklist — web calculator

## Vercel (required, dashboard)
- Settings → General → Root Directory: set to the **repo root** (was `marketing`).
- Build Command: `cd marketing && pnpm build`  (or set "Include source files outside of the Root Directory" if keeping root = marketing).
- Install Command: `cd marketing && pnpm install`
- Output Directory: `marketing/.next`
- Redeploy and confirm `/` renders the calculator and the build log shows `✓ externalDir`.
- Fallback if cross-dir build fails on Vercel: promote `shared/loan-engine` to a workspace package (Flavor B) — see spec §3.1.

## Google Ads (required for conversion tracking)
- Create a conversion action (Website → "App Store click").
- Set Vercel env: NEXT_PUBLIC_GADS_ID, NEXT_PUBLIC_GADS_CONVERSION.
- Point the Search campaign's Final URL at https://www.calculadorapricesac.com.br/ (not the App Store).
- Verify with Google Tag Assistant that the conversion fires on the App Store button.

## Follow-ups (separate)
- LGPD / Google Consent Mode v2 banner.
- The earlier SEO fixes (env var www, canonical 301) — see prior change set.
```

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/plans/2026-06-02-web-sac-price-calculator-DEPLOY.md
git commit -m "docs: deploy checklist for web calculator"
```

---

## Notes on test design (for the implementer)
- **Pure logic is unit-tested** (`buildScenarios`, `format`, engine parity) with deterministic inputs — no magic-number brittleness; we assert *relationships and invariants* (SAC interest < Price interest, schedule length, monotonic balance) plus exact structural fields (principal, system, units).
- **The container has one integration test** covering the two behaviors that matter: results render on first paint, and invalid input suppresses results + surfaces a message.
- **UI components are verified by `tsc` + `next build` + the integration render** rather than per-component snapshots, to avoid brittle markup tests.
- Run a single file with `pnpm test <name>` (vitest matches by filename substring).
