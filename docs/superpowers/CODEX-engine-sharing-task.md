# Task for Codex: properly share the loan engine between mobile and marketing

## Goal
Make the loan calculation engine reusable by BOTH apps through a real, idiomatic
module mechanism — no build-time file copying. The two import specifiers

- `@loan-engine/calculations`
- `@loan-engine/loan`

must resolve natively in **dev, test, type-check, and production build** for both apps.

## The engine (single source today)
- `mobile/src/lib/calculations.ts` (≈589 lines) — pure TypeScript, its only import is
  the types below.
- `mobile/src/types/loan.ts` (≈98 lines) — pure TypeScript, no imports.
- No runtime dependencies. Used by ~17 mobile files (via `../lib/calculations` /
  `../types/loan`) and by the marketing calculator (`marketing/app/components/Simulator/*`
  via `@loan-engine/calculations` and `@loan-engine/loan`).

## The two consumers
- **mobile/** — Expo SDK 56, **npm** (`package-lock.json`), Metro (`metro.config.js` uses
  `@sentry/react-native/metro`), built/shipped via **EAS Build**. Tests: `cd mobile && npm test`
  (vitest, **98 tests** must stay green). iOS app currently in production.
- **marketing/** — Next.js 16 (App Router, **Turbopack**), **pnpm**
  (`pnpm-lock.yaml`, `pnpm-workspace.yaml` currently `packages: - .`). Tests:
  `cd marketing && pnpm test` (vitest, **11 tests** must stay green).
- There is **no root workspace** today; the repo root has only `mobile/`, `marketing/`,
  `tools/`, `docs/`.

## Hard constraints
1. **Do NOT break mobile / EAS.** No fragile symlinks pointing outside `mobile/`, no
   change that EAS Build can't reproduce. If you change mobile's package manager or Metro
   config, justify it and verify `npx expo export --platform ios` still resolves the engine.
2. Both Metro and Turbopack **refuse to bundle files outside their own project root.**
   Confirmed dead ends (don't repeat): Next `experimental.externalDir`, Turbopack
   `resolveAlias` to `../…` or an absolute path, and an in-`marketing` symlink to a sibling
   dir all fail to resolve at build; Metro `watchFolders=[repoRoot]` + an out-of-root
   relative import fails the file SHA-1 step without watchman. The reliable way both
   bundlers resolve a module outside the app dir is **via `node_modules`** (i.e. a real
   package), so a workspace package is the most likely correct approach.
3. The package-manager split (mobile npm, marketing pnpm) is the core difficulty — solve it
   cleanly (e.g. a root workspace that each tool understands, or a publishable/linked
   package). Keep both lockfiles coherent.
4. Keep the engine the single source of truth — no duplicated copies of the code.

## Current transitional state (what to fix)
- The engine lives in `mobile/src` (pristine).
- The previous build-time copy approach was just removed: `marketing/scripts/sync-loan-engine.mjs`,
  the `prebuild`/`predev` hooks, `marketing/loan-engine-shim/`, and the Turbopack alias are gone.
- `marketing/tsconfig.json` and `marketing/vitest.config.ts` still alias
  `@loan-engine/calculations` → `../mobile/src/lib/calculations` and
  `@loan-engine/loan` → `../mobile/src/types/loan` (so tsc + vitest pass today).
  Replace these temporary aliases with the proper module resolution.
- As a result, `cd marketing && pnpm build` currently FAILS to resolve `@loan-engine/*` —
  that is the symptom to fix.

## Acceptance criteria (all must pass)
- `cd mobile && npm test` → 98 passed; `cd mobile && npx tsc --noEmit` clean.
- `cd mobile && npx expo export --platform ios` resolves the engine (no "Unable to resolve").
- `cd marketing && pnpm test` → 11 passed; `cd marketing && npx tsc --noEmit` clean;
  `cd marketing && pnpm lint` exit 0; `cd marketing && pnpm build` → Compiled successfully.
- No build-time copy/codegen of the engine source. Single source of truth preserved.
- Update `docs/superpowers/plans/2026-06-02-web-sac-price-calculator-DEPLOY.md` to describe
  the final sharing mechanism and any Vercel/EAS implications.
