# Web SAC/Price Calculator — Design Spec

**Date:** 2026-06-02
**Status:** Approved design, pending implementation plan
**Author:** Lucas Simão (with Claude)

## 1. Goal & Context

Add a working in-browser SAC/Price financing calculator as the centerpiece of the
marketing homepage (`marketing/`, Next.js 16). It serves as the **landing page for a
Google Search campaign** (Brazil, Portuguese, iOS-focused, high-intent SAC/Price/
financiamento keywords, R$50/day) whose final URL points at the website, which then
drives App Store installs.

**Why this funnel:** a page that *is* a SAC/Price simulator maximizes keyword
relevance → higher Quality Score → lower CPC (critical on a small budget), satisfies
search intent, and lets us fire first-party conversion events (the App Store click) so
Smart Bidding can optimize. It also serves organic search and gives Android users (the
app is iOS-only) a usable tool.

**Product principle — funnel, not replacement:** the web calculator gives enough value
to satisfy intent and build trust, but deliberately holds back the premium features that
are the reason to install the app.

## 2. Scope

### In scope
- A "lite / conversion-first" calculator: 4 inputs → instant SAC-vs-Price comparison,
  balance chart, faded amortization-table preview, App Store unlock CTA.
- A **shared loan engine** folder consumed by both `mobile/` and `marketing/`.
- Google Ads conversion tracking on the App Store click.

### Out of scope (separate efforts)
- Vercel env var / canonical-redirect items (already handled in a prior change set).
- Android waitlist / email capture.
- SEO content/FAQ pages.
- LGPD consent-mode banner (noted follow-up; see §7).
- App Store Connect ↔ Google Ads linking for install attribution.

### Gated to the app (rendered as CTA value props, NOT built on web)
FGTS simulation · amortizações extras (prepayments) · custos detalhados (IOF, ITBI,
seguro, taxa admin, cartório) · tabela completa · exportar PDF/XLSX/CSV · salvar cenários.

## 3. Architecture

### 3.1 Shared loan engine (validated locally)
The engine is pure, dependency-free TypeScript (`calculations.ts` imports only types from
`loan.ts`; no React Native / Expo). It becomes the single source of truth for both apps.

- **New location:** `shared/loan-engine/`
  - `calculations.ts` (moved from `mobile/src/lib/calculations.ts`)
  - `loan.ts` (moved from `mobile/src/types/loan.ts`)
  - `__tests__/calculations.test.ts` (moved from `mobile/src/lib/__tests__/`)
- **Mobile wiring:**
  - `metro.config.js`: add the repo root to `watchFolders` so Metro resolves files
    outside `mobile/`.
  - `tsconfig.json`: add `baseUrl` + path alias `@loan-engine/*` → `../shared/loan-engine/*`.
  - Update existing imports in mobile (e.g. `../lib/calculations`, `../types/loan`) to the
    alias.
- **Marketing wiring (verified via throwaway spike — `next build` compiled a cross-dir
  import; output showed `✓ externalDir`):**
  - `tsconfig.json`: path alias `@loan-engine/*` → `../shared/loan-engine/*`; add
    `../shared/**/*.ts` to `include`.
  - `next.config.ts`: `experimental: { externalDir: true }`.
  - **Deploy step (manual, dashboard):** set Vercel **Root Directory → repo root**, with
    install/build commands scoped to `marketing/`. This is the one piece not provable from
    local build; documented as a required deploy change. Fallback if Vercel fights it:
    promote `shared/loan-engine` to a workspace package (Flavor B).
- **Parity:** the vitest suite moves with the engine and is run by both apps' test scripts,
  guaranteeing identical results.

### 3.2 Page structure
The homepage (`marketing/app/page.tsx`) stays a **server component** so the headline,
value-prop copy, marketing sections, and JSON-LD remain server-rendered for SEO. The
calculator is a **client island** placed where the static "RESUMO RÁPIDO" preview card is
today.

Vertical order (Option B, "calculator-first", mobile-optimized):
headline → inputs → SAC-vs-Price result → balance chart → faded table preview → unlock CTA.

### 3.3 Components — `marketing/app/components/Simulator/`
All client components (`'use client'`).

- **`Simulator.tsx`** — container. Owns input state (4 fields). On every change, builds
  **two** `Scenario` objects and runs the engine inside `useMemo`:
  - shared fields: `loanMode: 'property'`, `propertyValue`, `downPayment`,
    `principal = propertyValue − downPayment`, `rate`, `rateType: 'annual'`,
    `term`, `termUnit: 'years'`, default `startDate = today`, default `dueDay = 1`,
    `id`/`name` constants.
  - one with `system: 'SAC'`, one with `system: 'PRICE'`.
  - calls `generateAmortizationSchedule(scenario)` + `calculateLoanSummary(schedule, scenario)`
    for each. Fully client-side, instant, offline (honors the "100% offline" promise).
- **`InputsForm.tsx`** — fields: Valor do imóvel (R$), Entrada (R$), Taxa de juros (% a.a.),
  Prazo (anos). BRL masking on currency fields. Sensible defaults pre-filled
  (e.g. 400.000 / 80.000 / 11,5 / 30) so a result is visible on first paint.
- **`ResultsComparison.tsx`** — two tiles:
  - **SAC:** 1ª parcela, última parcela, total de juros, CET (a.a.)
  - **Price:** parcela (fixa), total de juros, total pago, CET (a.a.)
  - (Price has no "última" — payment is fixed.)
- **`BalanceChart.tsx`** — lightweight inline **SVG** (no chart library), saldo devedor over
  time for SAC vs Price, matching the existing hero SVG aesthetic. Series sampled from the
  schedules (downsample to ~24–36 points for a smooth path).
- **`TablePreview.tsx`** — first ~6 schedule rows (#, parcela, juros, saldo), bottom fade,
  caption "ver tabela completa no app".
- **`UnlockCTA.tsx`** — App Store CTA listing the gated value props. Renders through the
  existing `AppStoreLink` with `location="simulator"`.

### 3.4 Formatting
Reuse the engine's `formatCurrency` (Intl `pt-BR`) and add a percent formatter for rate/CET.

## 4. Data flow

```
4 inputs (state)
   └─ build Scenario[SAC], Scenario[PRICE]   (useMemo, on change)
        ├─ generateAmortizationSchedule(s)    (per system)
        └─ calculateLoanSummary(schedule, s)  (per system)
             └─ derive: tiles (summary fields), chart series (sampled balances),
                table preview (first N rows)
                └─ render
```

No network, no persistence. Recompute is cheap (≤360 monthly rows × 2 systems).

## 5. Conversion tracking

- All App Store buttons — the two existing ones plus the new `UnlockCTA` — route through
  `AppStoreLink`, which already fires Vercel Analytics `track('app_store_click', {location})`.
- **Add Google Ads conversion:** load the Google tag (`gtag.js`) via `next/script`, and on
  `app_store_click` also fire the Google Ads conversion event
  (`gtag('event', 'conversion', { send_to: '<AW-ID>/<label>' })`).
- **Open item:** the Google Ads **conversion ID/label** must be provided. Until then the
  hook is wired but a no-op (guarded by an env var, e.g. `NEXT_PUBLIC_GADS_CONVERSION`).

## 6. Error & edge handling
- Use the engine's `validateScenario` for: entrada ≥ valor do imóvel, zero/empty values,
  invalid term/rate. On invalid input show an inline message and suppress the results block
  (no NaN tiles).
- Currency inputs clamp to non-negative; empty field treated as 0 with placeholder.

## 7. Follow-ups (not blocking)
- **LGPD / Google Consent Mode v2:** adding ad cookies in Brazil warrants a lightweight
  consent banner + Consent Mode defaults. Tracked separately.
- Vercel Root Directory change (deploy-time, §3.1).
- Provide Google Ads conversion ID/label (§5).

## 8. Testing
- **Engine parity:** the moved vitest suite must pass in both apps' `test` scripts.
- **Mapping test (new, marketing):** inputs `{ valor: 400000, entrada: 80000, taxa: 11.5,
  prazo: 30 }` → built `Scenario` → assert known `LoanSummary` fields (1ª parcela, última,
  total juros, CET) for SAC and Price against fixed expected values.
- **Build check:** `next build` (marketing) and the mobile typecheck/build both pass after
  the engine move.

## 9. Risks
- **Vercel cross-dir build** (medium, mitigated): local Turbopack build verified; production
  needs the Root Directory change. Fallback = workspace package (Flavor B).
- **Mobile import churn** (low): moving the engine touches mobile imports + Metro/tsconfig;
  covered by the existing test suite and a mobile build check.
- **Cannibalization** (low, by design): lite scope + gated premium features keep the app's
  value intact.
