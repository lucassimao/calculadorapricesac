# Feature Roadmap & Work Plan

Revision 2 — 2026-08-01. Sources: codebase audit, PostHog usage data (project `calculadorapricesac`, id 389897, May–Jul 2026), competitor App Store research, real-user complaint research (Reclame Aqui, finance blogs, competitor reviews), and an independent engineering review that verified the engine claims against the code.

## How to use this file (instructions for an AI agent)

- Work items **top to bottom within a priority tier**. P0 before P1 before P2 before P3. Order within a tier is intentional (some items depend on earlier ones — dependencies are stated inline).
- Each item is a checkbox. When you complete one, check it off and append a one-line note: date + what shipped + test evidence.
- **Engine bug claims have been independently verified against the code** (line references were confirmed on 2026-08-01), but code drifts: still start every engine item by writing the failing test that reproduces the claim. If it no longer reproduces, mark the item `[x]` with "not reproducible — <why>".
- **TDD is mandatory for all engine work**: failing test → fix → green. Never weaken or delete an existing test to make a change pass. When a fix legitimately changes expected values (e.g. CET after P0.2), update the fixture and document the old→new value and why in the test.
- Keep all user-facing copy in **pt-BR** (no i18n layer; strings are inline).
- **A user-facing feature is not "done" until its marketing-site counterpart ships** (see P3.3 for the per-feature mapping) — same release cycle, not a someday task.

### Execution protocol (per-item workflow — follow in this exact order)

Items are worked sequentially on the current branch — no per-item branches. An item is **done** when it passes all quality checks below and meets its spec; only then is the next item unlocked.

For every item, in order:

1. **Write the tests first** (TDD — failing test that reproduces the bug or specifies the feature), then implement until green.
2. **Ask Claude for a code review of the diff** before anything else: run `claude -p "Review the uncommitted diff on this branch for correctness, edge cases, and consistency with mobile/FEATURE_ROADMAP.md item <id>. Be adversarial."` (non-interactive; if the `claude` CLI is unavailable, mark the step `[b] BLOCKED — owner action: claude CLI login` rather than skipping). Address every finding you agree is real; note disagreements + reasoning in the completion note. Re-request review after significant rework.
3. **Run the full test suite**: `cd mobile && npm test` — all green, including pre-existing tests.
4. **Visual/emulator tests (required for any item that touches UI):** validate the important flows locally with **Maestro on the Android emulator** (the agent runs on Linux) — keep the existing flows passing, and when the item adds or changes a screen (P0.3's CET display, all of P1, P2.1–P2.3, P2.5, P2.7's result screens), add or update a Maestro flow covering the new UI state in the same branch. Note in the completion note that visual verification was Android-only.
5. **Static checks, immediately before commit**: `cd mobile && npx tsc --noEmit`; lint if a lint script exists; apply the repo's formatter (e.g. `npx prettier --write` on touched files if Prettier is configured). Plus `cd marketing && npm run build` whenever `mobile/packages/@loan-engine/*` or anything the site imports was touched.
6. **Commit** locally with a descriptive message (one commit per item, plus the roadmap checkbox update). **Do not push, open PRs, publish releases, or submit builds.**
7. Only when steps 1–6 are all clean is the item done: check it off with its completion note and **proceed to the next item in the list**.

- **Blocked protocol:** if an item needs owner-only access (App Store Connect, PostHog web UI, real device, paid accounts), complete every automatable part, then mark the checkbox `[b]` with `BLOCKED — owner action: <exact steps for Lucas>`. Never fake or skip the blocked part silently.

### Repo orientation

- App: `mobile/` — Expo **56** (`expo ^56.0.8` in `mobile/package.json`) / React Native, Expo Router, TypeScript. Main screen: `mobile/app/(tabs)/calculator.tsx` (~2,600 lines). Tabs under `mobile/app/(tabs)/`: calculator, comparison, premium, feedback.
- Shared loan engine (also consumed by the marketing site via `file:` deps — **changes must keep `marketing/` building**):
  - Types: `mobile/packages/@loan-engine/loan/src/index.ts`
  - Engine: `mobile/packages/@loan-engine/calculations/src/index.ts` (~589 lines; the package contains only this source file)
  - **Engine tests live in the app, not the package**: `mobile/src/lib/__tests__/calculations.test.ts` (+ `fixtures/` beside it). Run scoped: `cd mobile && npx vitest run src/lib/__tests__/calculations.test.ts`.
- Analytics: `mobile/src/lib/analytics.ts` — PostHog; `posthogEnabled = !__DEV__ && apiKey.length > 0` (line 28), so **events are unobservable in dev builds** (see P0.1 §6); a super property `app_platform: Platform.OS` is already registered (lines 31–35).
- Monetization: `mobile/src/lib/iap.ts` (one-time `remove_ads`), purchase flow `mobile/src/hooks/useIapPurchase.ts`, rewarded exports `mobile/src/hooks/useRewardedExport.ts` + `mobile/src/hooks/rewarded-export-state.ts`, review prompt `mobile/src/hooks/useStoreReview.ts`, export gating `mobile/src/lib/exports/access.ts`, AdMob config `mobile/app.config.js`.
- Exports: `mobile/src/lib/exports/{pdf,xlsx,csv}.ts`. Scenario storage: `mobile/src/lib/storage/scenarios.ts` (free limit const `FREE_SCENARIO_LIMIT = 1` in `calculator.tsx`).
- BACEN rates: `mobile/src/lib/bacen.ts` — **TR (SGS 226) and IPCA (SGS 433) only; there is no Selic or average-mortgage-rate series in the app**. 6h cache, 10s timeout, stale-on-error.

### Key usage evidence (why the priorities are what they are)

- ~370 lifetime users; iOS only. App Store: "Calculadora SAC & Price" id 6757717537, 5.0★ with only **2 ratings**.
- Most-used feature by far: prepayment simulation (`prepayment_added` = 56 events in Jul alone).
- FGTS feature is nearly dead: `fgts_added` = 2 events in 3 months, despite FGTS being a top-searched financing topic — a modeling/discoverability problem, not lack of demand.
- Paywall: 104 `premium_paywall_viewed` → 4 `purchase_success` in Jul (~4%).
- Exports: Jul had 31 `export_clicked` → 22 `export_success`; rewarded-ad unlocks fail often (`rewarded_export_ad_failed` present — BR ad no-fill).
- Users hit the free 1-scenario cap (`scenario_save_blocked_free_limit` firing).
- The historical `app_open` event collapsed (60 DAU May → 1 in Jul) while other events kept flowing — the open event was renamed across versions. **Retention/DAU metrics are currently untrustworthy.**
- Comparison tab and professional export are barely used (12 and 4 events in 3 months) — do not invest there until discoverability is addressed (P3.2).

---

## P0 — Correctness & measurement

Trust in the numbers is the product. Fix these before shipping any new feature.

- [b] **P0.1 Analytics foundation: unify lifecycle events, type the contract, add missing events, fix privacy.**
  One item, one branch — lifecycle unification and the tracking plan are the same files and must land together.
  **Hard constraint — self-contained analytics:** every metric must be derivable exclusively from events the app itself captures into PostHog at runtime. No dependency on App Store Connect analytics, App Store Server Notifications, Play Console stats, or any store-side feed — if a metric would need one, redesign around an in-app signal or drop it (note the drop in `TRACKING_PLAN.md`). In-app store SDK callbacks (expo-iap results, entitlement checks) are fine; store-side reports are not.

  **1. Audit first, then delta.** Enumerate every `trackEvent` call site (there are ~70+; many already pass properties — e.g. `export_clicked`/`export_success` already carry format/premium info, prepayment events already carry type/strategy). Produce a field-by-field delta table in `mobile/docs/TRACKING_PLAN.md`: event → current properties → target properties → action (keep / extend / add / retire). Do not trust this roadmap's prose over the code you find.

  **2. Type the contract.** Replace `trackEvent(event: string)` with a typed `AnalyticsEvent` map (event name → allowed properties) in one file; TypeScript enforces the contract. `TRACKING_PLAN.md` documents each event: when it fires, properties, and the decision it supports. Any PR that adds/changes an event updates that doc.

  **3. Canonical lifecycle + super/person properties.** Disable `captureAppLifecycleEvents`; fire exactly one `app_open` (cold start + foreground after 30 min). Extend the existing super-property registration (keep `app_platform` — do not rename it) with `app_version`, `is_premium`, `saved_scenario_count`. Mirror `is_premium` and `first_app_version` as person properties on premium status change. Keep a legacy-events appendix mapping dead names (`app_open` pre-1.2.0, `$app_opened`, `Application Opened`) to the canonical one.

  **4. New/extended events** (snake_case, `object_action`; do not rename existing high-value events — extend only, so historical charts keep working):
  - `calculation_performed` — the missing core event. Debounced (~2s after last input change). Properties: `system`, `loan_mode`, `rate_type`, `rate_bucket` (`<9 | 9-11 | 11-13 | >13` % a.a.), `term_months`, `principal_bucket` (`<100k | 100-300k | 300-500k | 500k-1M | >1M`), `prepayment_count`, `fgts_event_count`, `index_type`, `has_insurance`, `has_admin_fee`, `has_iof`, `entry_mode` (`new_loan | existing_contract` once P2.2 ships). Decision: which loan shapes are common → build/kill.
  - `premium_paywall_viewed` — **this stays the canonical name** (it has history; do not introduce `paywall_viewed`). REQUIRE property `source`: `premium_tab | scenario_limit | post_export | export_upgrade | amortizar_investir | prepayment_optimizer | onboarding`. The premium-tab call site currently passes properties but not `source` — add it.
  - `paywall_dismissed` — closes paywall without buying. Properties: `source`, `time_on_paywall_ms`, `nth_view` (lifetime count, persisted in AsyncStorage via a helper in `analytics.ts`), `days_since_install`. The change-of-mind event.
  - `paywall_purchase_cta_clicked` — buy-button tap BEFORE the native sheet. Properties: `source`, `nth_view`. Separates "offer didn't convince" from "checkout lost them".
  - Purchase terminal contract with a **persisted attempt state machine**: generate an `attempt_id` (AsyncStorage) when the user initiates; fire `purchase_started` only after preconditions pass (store connection, product loaded); guarantee exactly one terminal event per attempt — `purchase_success | purchase_cancelled | purchase_failed` — deduplicating late store callbacks against the attempt state; on app launch, reconcile any stale pending attempt as `purchase_failed` with `error_code: 'stale_unresolved'`. Split user-cancel out of `purchase_failed` using the **actual expo-iap cancel error code — read it from the installed SDK (it is `user-cancelled`-style, not `E_USER_CANCELLED`; verify in `node_modules/expo-iap`)**. `purchase_failed` keeps `error_code` for real errors.
  - `rewarded_ad_chosen_over_premium` — user picks the ad path on a gate offering both. Properties: `source`, `nth_time`. Revealed-preference "no" to the current offer; its trend is the price-sensitivity signal.
  - `premium_status_lost` — requires fixing the entitlement check first: make it **three-state** — `entitled | confirmed_absent | indeterminate` (store/network error). Current code wrongly treats failures as absence (`mobile/src/contexts/PremiumContext.tsx` sets premium false when connection/`getAvailablePurchases()` fails; `useIapPurchase.ts` marks a failed lookup as validated). **Only `confirmed_absent` may revoke premium or emit this event**; `indeterminate` keeps the last known state. Property: `days_since_purchase`. Also flips `is_premium`. Observes revocations only on next app open — accept the lag; do NOT add server notifications.
  - `export_sheet_abandoned` (sheet opened, no export in session); `prepayment_added`/`fgts_added` gain `recurrence` (`none | monthly | yearly | biennial`, for P2.1) and `months_from_start` bucket; `validation_warning_shown` (`warning_code`, from P0.6/P0.7); `chart_viewed` (`chart_type`) and `table_expanded` (first per session); `comparison_started` (once per session, P3.2); `bacen_rate_fetch_failed` (`series`, `error_kind`); `review_prompt_requested` (P1.5 — request only; the OS never reports display/rating back); `notification_optin_changed` (P2.5).

  **5. Privacy / data minimization (events AND person/super properties).** The current scenario context sends **raw principal** (see `calculator.tsx` scenario-tracking block, ~line 104), and `identifyUser()` currently pushes brand-profile **PII (name, email, phone, registration, website) into PostHog person properties** (see `mobile/src/types/brand-profile.ts` ~94 and `BrandProfileCard.tsx` ~133). The prohibition covers **event properties, super properties, AND person/identity properties**: no raw loan/property/payment amounts, no client names/brand data from professional exports, no email/phone/registration. Stop the `identifyUser` PII flow (brand profiles stay local — analytics only needs `has_brand_profile: true`). Add `[b] BLOCKED — owner action: delete previously collected person-property PII in PostHog (persons list → delete/redact)`. Document all of this in `TRACKING_PLAN.md`.

  **6. Dev observability.** Analytics is disabled when `__DEV__` — the acceptance below would be untestable as-is. Add a dry-run mode (e.g. `EXPO_PUBLIC_ANALYTICS_DRYRUN=1`): events go to console + an in-memory sink assertable from tests, network still disabled. Unit-test the contract against the sink.

  **7. Dashboards.** Three PostHog dashboards: (a) **Activation** — funnel `app_open → calculation_performed → scenario_saved OR export_clicked`, D7 retention on `app_open`; (b) **Monetization / purchase decision** — funnel `premium_paywall_viewed → paywall_purchase_cta_clicked → purchase_started → purchase_success` by `source`, plus `paywall_dismissed` rate and `nth_view` distribution, `purchase_cancelled` vs `purchase_failed`, `rewarded_ad_chosen_over_premium`, `premium_status_lost`, rewarded-export funnel; (c) **Feature adoption** — `calculation_performed` by `system`/`index_type`/`entry_mode`, `prepayment_added` by `recurrence`, comparison/professional usage. If no PostHog API access is available in the environment, create what you can via API and otherwise mark `[b] BLOCKED — owner action:` with the exact insight definitions ready to paste.
  Accept: typed contract compiles and rejects an undeclared event (negative type-test); dry-run sink shows super properties on every event and exactly one `app_open` per open; no raw amounts in any captured payload (test asserts on the sink); `TRACKING_PLAN.md` complete; dashboards created or handed off.
  - 2026-08-01 — BLOCKED — owner action: no PostHog projeto 389897, abrir Persons, localizar as propriedades históricas `name`, `email`, `phone`, `registration` e `website` originadas do perfil profissional, executar delete/redact e confirmar que não restaram valores dessas chaves. Parte automatizável entregue: contrato tipado, lifecycle, privacidade, dry-run, compra/entitlement e dashboards 1939113–1939115; evidência: 106 testes, typecheck e 21 fluxos Maestro Android-only verdes, três revisões adversariais Claude concluídas (tentativas finais via Opus e Sonnet após os últimos ajustes retornaram a mesma cota de sessão até 17:10). Discordâncias da revisão: mantido `export_upgrade` no card inline por ser valor obrigatório do enum do roadmap; não emitido terminal sintético `attempt_id=untracked` para preservar exatamente um terminal por tentativa.

- [b] **P0.2 Engine: first-installment date rule + first-period interest convention.**
  Verified: `currentDate` starts at `startDate` and `addMonths` applies after the row is pushed (index.ts ~175, 233), so start Jan 20 / dueDay 5 dates installment #1 on Jan 5 — before disbursement — and feeds negative day-fractions into CET (~458–461), understating it (reproduced: 16.98% on a case that should be higher).
  **Exact rule to implement (no ambiguity):** first due date = the first occurrence of `dueDay` that is **≥ 30 days after `startDate`**. Examples: start Jan 20, dueDay 5 → Mar 5 (Feb 5 is only 16 days out); start Jan 1, dueDay 5 → Feb 5 (35 days); start Jan 5, dueDay 5 → Feb 5 (31 days). Subsequent installments: `addMonths` from the first due date, day clamped as today.
  **First-period interest:** the engine charges one full monthly rate regardless of whether the first period is 16 or 44 days (~228, 321). Keep full-month for now as the documented convention (matches many BR contract summaries), and let the P0.8 bank fixture be the arbiter — if parity requires pro-rata over the actual first-period days, implement it there behind a scenario field, not silently.
  Accept: new tests for start-day before/equal/after dueDay; all `ScheduleRow.date >= startDate`; CET day-fractions non-negative. **This changes CET for most schedules, including existing fixtures** — update fixtures with documented old→new values; do not claim values are unchanged.
  - 2026-08-01 — BLOCKED — owner decision: confirmar se a regra explícita do primeiro vencimento (primeira ocorrência ≥ 30 dias) prevalece com o CET real do fixture caindo de 16,98% para 11,75% a.a., ou definir outra convenção de fluxo/primeiro período que sustente a afirmação do roadmap de que o CET corrigido deveria ser maior. Parte automatizável entregue: regra aplicada a PRICE/SAC, juros de primeiro período mantidos em um mês cheio, fixtures e testes old→new atualizados; 112 testes e build de marketing verdes, sem mudança de UI. A revisão Claude exata foi tentada e encontrou a cota geral da sessão até 17:10 (Opus e Sonnet também indisponíveis).

- [x] **P0.3 Engine: CET solver — structured result instead of garbage.**
      Verified: bracket loop caps at `high = 128` and returns ≈12800% when the root lies beyond (reproduced with extreme upfront costs); and `npv(0) >= 0` short-circuits to `0`.
      Fix with a **structured result**, distinguishing four cases: (a) exact/near-zero root — a genuine 0% CET (zero-rate no-fee loan) is **valid and must still display "0,00%"**; (b) negative root (net inflow scenarios, e.g. heavy FGTS subsidy) — report as such or suppress with an explanatory label; (c) no sign change in the searchable bracket — return "unavailable", never a number; (d) numerical non-convergence — same. Extend the summary type accordingly (breaking change: update mobile UI + all three exporters + the marketing site tiles; run the marketing build).
      Accept: tests for all four cases; UI/exports render "CET indisponível para este cenário" only for (c)/(d), keep 0,00% for (a); no code path can display >100% a.a. without a test proving it's real.
  - 2026-08-01 — Entregue resultado CET discriminado (`available` com raiz positiva/zero/negativa ou `unavailable` por ausência de troca de sinal/não convergência), faixa pesquisável limitada a -99%..100% a.a. e apresentação consistente no app, CSV/XLSX/PDF e marketing. Fluxos subsidiados usam o pagamento líquido do mutuário no CET, com regressão para FGTS parcial e pesado. Fixture real de exportação atualizado de 15,58% para 15,36% pela correção de datas de P0.2 e validado por leitura dos artefatos PDF/XLSX/CSV. Evidência: 120 testes mobile e 12 testes marketing verdes; 22 fluxos Maestro Android-only verdes, incluindo 0,00% e indisponível; revisão adversarial Claude exata concluída e achados reais tratados (semântica de `netPayment` documentada/testada e ramo morto removido); typecheck, lint, formatter e build de produção do marketing verdes.

- [x] **P0.4 Engine: cent-ledger reconciliation + final-installment true-up + numerical hardening.**
      (Moved before the prepayment fix: its acceptance depends on this ledger.) Verified nuances: rounded rows can under/over-amortize by cents while displayed balance hits zero; and extreme-but-allowed inputs (e.g. 10% a.m. × 360 months) leave a R$127 residual driven by floating-point instability in `calculatePricePayment`, not just rounding.
      Do: keep an exact internal ledger (integer cents or documented-epsilon floats); rows display rounded values but must reconcile: `opening balance + index corrections − ending balance == Σ row amortization` (row `amortization` **already includes** `fgtsAmortization` — do not double count) and last row balance exactly 0 with the last payment absorbing the residual. Harden `calculatePricePayment` across the supported domain (after P0.7 caps it).
      Accept: property-style test over a grid of (principal, rate, term) asserting both identities; extreme-domain test passes.
  - 2026-08-01 — Entregue ledger interno em centavos para PRICE/SAC, correção monetária e amortizações concorrentes, com true-up da última parcela e fórmula PRICE estável via `log1p`/`expm1`. A grade cobre principal/taxa/prazo nos dois sistemas, cenários indexados, prepayment + FGTS sem dupla contagem e 10% a.m. × 360 meses. Evidência: 127 testes mobile verdes; revisão adversarial Claude Sonnet concluída sem defeitos (também testou extremos adicionais); typecheck, lint, formatter e build de produção do marketing verdes. Sem mudança de UI, portanto Maestro não aplicável.

- [x] **P0.5 Engine: same-month prepayments — stale clamp + strategy hijack.**
      Verified: each same-month event clamps against a stale headroom (~252, 345 — two R$600 events on a R$1,000 balance recorded R$1,502 amortization), and one `reduce_term` event forces reduce_term semantics on all events that month including FGTS (~263, 356).
      Do: process events sequentially within the month, updating headroom after each; per-event strategy semantics with a documented deterministic rule where one row can't express both (recommend: apply reduce_payment events first, then reduce_term; emit a `validation_warning_shown`-backed warning when mixing). Depends on P0.4's ledger for the acceptance identity.
      Accept: failing tests from the verified repro; ledger identities from P0.4 hold with multiple same-month mixed-strategy events.
  - 2026-08-01 — Entregue processamento determinístico por evento: `reduce_payment` antes de `reduce_term`, depois data, origem (prepayment antes de FGTS) e id, sempre consumindo headroom cumulativo. Estratégias mistas preservam a semântica individual em PRICE/SAC/FGTS, mantêm a identidade do ledger e exibem aviso pt-BR com telemetria `validation_warning_shown`. O stale clamp já havia sido necessariamente corrigido pelo ledger de P0.4 e ganhou regressão explícita aqui. Evidência: 136 testes mobile verdes; revisão adversarial Claude concluída e lacuna de identidade mista corrigida; 23 fluxos Maestro Android-only verdes; typecheck, lint, formatter e build de produção do marketing verdes. Discordância documentada da revisão: mantida a reamortização mensal já testada para empréstimos indexados; P0.5 ordena os eventos dentro da linha, e a correção da linha seguinte recalcula pelo saldo/prazo contratual como antes.

- [ ] **P0.6 Engine: event timing + input validation.**
      Verified: prepayment/FGTS matching is month+year only, so an event dated Feb 28 applies to a Feb 5 installment — **before the event's own date** — and events outside the schedule window vanish silently; `validateScenario` never inspects events.
      Do: (a) define and implement the application rule: an event applies to the **first installment whose due date is ≥ the event date** (document it; test events dated before/on/after the monthly due date, and outside the term). (b) Extend `validateScenario`: errors for non-finite numbers (NaN/Infinity anywhere), invalid `Date`s, negative amounts, percentage events outside `(0, 100]`, non-integer/out-of-range `dueDay`, FGTS down payment ≥ principal; warnings for events outside the schedule window ("Amortização em MM/AAAA está fora do período do financiamento e foi ignorada"). (c) Surface warnings in the calculator validation panel.
      Accept: tests per rule; UI shows the out-of-window warning.

- [ ] **P0.7 Engine hardening: term cap, property-mode cost gating, zero-rate contract.**
      (a) Cap **normalized term months** (not raw `term`) at 600 and require a finite positive integer — reject with a clear pt-BR error. (b) Verified: `standard` mode charges ITBI (`index.ts` ~64); `registryFee` has the same problem — gate **both** ITBI and registry on `loanMode === 'property'`. (c) Zero interest is already supported and tested — keep it as an explicit regression contract; with P0.3, zero-rate must show CET 0,00%, not "indisponível".
      Accept: tests for all three.

- [ ] **P0.8 CET bank-parity fixtures — then constrained accuracy claims.**
      Gate for P0.2–P0.7. **Fixtures must be representable by the CURRENT cost model** (one balance-based `insuranceRate`, one balance-based `adminFeeRate`) — so at this stage: at minimum one SAC and one Price fixture from published real bank simulations **without insurance, or with insurance only if the source expresses it as a flat % of balance**; document source and date inside each fixture. A full Caixa fixture with separate MIP/DFI moves to P2.4's acceptance — do not attempt it here, it cannot pass. Assert schedule and CET parity within rounding tolerance. This is also the arbiter for P0.2's first-period-interest convention — if parity demands pro-rata first-period interest, implement it here.
      Marketing claims must be **constrained to the validated scenario classes** ("valores conferidos com simulações reais no sistema SAC/Price" + methodology note; insurance parity only claimable after P2.4) — no blanket "always matches your bank". Site copy task: see the P3.3 mapping. App Store description copy: `[b] BLOCKED — owner action` (store surfaces are owner-managed).
      Accept: fixtures green; claims copy drafted with its evidence scope stated.

- [ ] **P0.9 Premium price: single source of truth.**
      `mobile/src/lib/iap.ts` hardcodes fallback `R$ 24,90`; older conversion notes said "R$ 10". The store price is owner-controlled and not readable from the repo. Do: make all displayed prices come from the store product's localized price at runtime (expo-iap already provides it); the hardcoded fallback becomes a last-resort display used only when the store is unreachable — pick it to match the real store price. Determining that real price: `[b] BLOCKED — owner action: confirm current App Store Connect price for remove_ads`. Grep and fix any stale price copy.
      Accept: no screen shows a price that didn't come from the store product (or the confirmed fallback); test covers the fallback path.

---

## P1 — Monetization & conversion UX

Order matters: improve the paywall BEFORE adding more paywall exposure.

- [ ] **P1.1 Paywall screen revamp (benefits + framing).**
      104 views → 4 purchases (~4%) in Jul. Rework `mobile/app/(tabs)/premium.tsx` (and the sheet component added in P1.2/P1.3): (a) benefits checklist — sem anúncios, exportações ilimitadas sem marca d'água, PDF profissional com sua marca, cenários ilimitados; (b) one-time framing — "pague uma vez, use para sempre — sem assinatura" (this is the honest differentiator; do NOT quote competitor prices in-app and do not claim "objectively the best deal"); (c) price displayed from the store product (P0.9). Social proof slot activates once ratings grow (P1.5).
      Accept: conversion measurable per `source` (P0.1 events); copy pt-BR; snapshot/E2E of the screen.

- [ ] **P1.2 Turn the free-scenario-limit error into a paywall moment.**
      `scenario_save_blocked_free_limit` is firing — users hit `FREE_SCENARIO_LIMIT = 1` and get an error. Replace with a bottom-sheet paywall ("Salve cenários ilimitados no Premium") reusing P1.1's content. Fire `premium_paywall_viewed` with `source: 'scenario_limit'`.
      Accept: hitting the cap opens the sheet; events carry the source.

- [ ] **P1.3 Post-export paywall.**
      `export_success` is the strongest engagement event. After a free (watermarked) export succeeds, show watermarked vs. clean/professional side-by-side with the one-time price. `source: 'post_export'`; at most once per session; never for premium users.

- [ ] **P1.4 Rewarded-ad failure fallback — bounded courtesy grant.**
      Failures live in `mobile/src/hooks/useRewardedExport.ts` (+ `rewarded-export-state.ts`), not `exports/access.ts`. BR ad no-fill loses real users at the export gate. Do: distinguish failure kinds — **no-fill / load-timeout → grant the free (watermarked) export** with "Hoje é por nossa conta 🎁" + soft premium upsell; **user closed the ad early / cancelled → do NOT grant**. Persist a courtesy cap (e.g. max 2 granted failures per rolling 7 days, in AsyncStorage) so offline/ad-block abuse can't farm unlimited exports. Instrument exact failure codes on `rewarded_export_ad_failed` (`error_kind`).
      Accept: unit tests per failure kind and for the cap; simulated no-fill produces export + both events.

- [ ] **P1.5 Store-review prompt: tune the existing trigger policy.**
      A review prompt already exists — `mobile/src/hooks/useStoreReview.ts` (fires after export success, once, gated on ≥5 app opens). With only 2 lifetime ratings, the policy is too conservative or mistimed. Do: adjust the policy, don't rebuild — trigger after the 2nd `export_success` OR 2nd scenario save, whichever first; keep once-per-install; never within a session that showed an ad error or purchase failure. Analytics: event is `review_prompt_requested` (the expo-store-review API returns `Promise<void>` — the app **cannot observe** whether the OS displayed the prompt or the user rated; do not name or chart a prompt→rating conversion, it violates the self-contained rule. The only outcome signal is the lifetime ratings count, which is owner-observed, not a PostHog metric).
      Accept: unit tests on the policy state machine; dev force-trigger flag.

- [ ] **P1.6 Export funnel instrumentation + decision rule.**
      Two sub-parts, split on purpose. (a) _Now:_ ensure the funnel is fully measurable — `export_clicked` (already has premium info; verify) → gate outcome (`rewarded_*` / `export_blocked_premium`) → `export_success` / `export_sheet_abandoned` (new, P0.1). (b) _Later, decision rule (not "fix what the data shows"):_ after ≥100 post-release `export_clicked` events or 60 days, whichever first — if sheet abandonment > 30%, simplify the sheet to a single default format (PDF) with an "outros formatos" expander; if abandonment ≤ 30% but ad-gate drop > 40%, revise gate copy. Record the decision taken in the completion note.

- [ ] **P1.7 Onboarding: pre-fill a realistic example scenario.**
      First open currently shows empty inputs. Pre-fill a **static, versioned example** (constant in code with a `// example-rate reviewed 2026-08` comment): imóvel R$ 400.000, entrada 20%, taxa 11,5% a.a., 360 meses, SAC — labeled with a dismissible "exemplo" chip. **Never fetch anything to render this** (`bacen.ts` has no Selic/mortgage-rate series; do not add a network dependency to first paint). Editing any field clears the chip.
      Accept: first-open E2E shows populated results; no network on the first-paint path; chip clears on edit.

---

## P2 — New features (ordered by strength of real-user demand)

- [ ] **P2.1 Recurring prepayments — with usage-correct FGTS presets.**
      Strongest direct user-voice signal found (competitor App Store review): "É permitido, no Brasil, usar o FGTS para amortizar o saldo devedor, mas somente a cada 2 anos. A calculadora poderia ter a opção 'bianual'." Our `fgts_added` fired twice in 3 months.
      Do: recurrence as a **UI-level generator** (engine's event-array contract unchanged): amount + frequency (mensal / anual / a cada 2 anos) + start + strategy → expanded dated events, shown individually editable. **FGTS defaults are usage-specific** (per official FGTS rules — link the dated fgts.gov.br guidance in code comment and UI copy): biennial applies to **amortização/liquidação do saldo**; using FGTS to **pay installments** follows a different rule (up to 12 consecutive installments, ~80% of each) and must not get the biennial preset. Down-payment usage is one-off. Explainer copy per usage type.
      Accept: "R$ 10.000 a cada 2 anos via FGTS (amortização), reduzir prazo" produces the correct series; expander unit tests incl. usage-specific defaults; events carry `recurrence`.

- [ ] **P2.2 "Já tenho um financiamento" entry mode (existing contract).**
      Our dominant users are contract holders simulating prepayments; they know their current numbers, not the original loan's.
      **Exact required inputs (no alternatives, no ambiguity):** sistema (SAC/Price), saldo devedor atual (R$), taxa de juros atual (% a.a. or % a.m. — reuse `rateType`), **número de parcelas restantes** (integer), and **data da próxima parcela** (next due date). Convention: the entered saldo devedor is the balance **immediately after the last paid installment** (state this in the UI helper text). Optional: seguros/taxas mensais atuais, indexador. Do NOT offer "parcela atual" as an input in v1 — deriving state from the payment amount is underdetermined; show the computed parcela and let the user sanity-check against their boleto instead.
      Internally: fresh `Scenario` with principal = saldo devedor, term = parcelas restantes — **but with an existing-contract scheduling rule: installment #1 falls on the entered next due date, NOT on P0.2's ≥30-day new-disbursement rule** (a contract whose next parcela is due in 5 days must not skip it). Prepayment/FGTS simulation runs on top. Fire `calculation_performed` with `entry_mode: 'existing_contract'`.
      Accept: E2E mid-life contract + prepayment → interest saved + new payoff; unit test: existing-contract scenario equals the tail of the equivalent full schedule; computed parcela displayed for user verification.

- [ ] **P2.3 Loan portability comparison (depends on P2.2).**
      On top of an entered existing contract: "comparar com outra proposta". **Cash-flow spec (v1, nominal — no discounting, documented):** current path = remaining schedule of the entered contract (including its monthly insurance/fees if provided). New path = new `Scenario` with principal = current saldo devedor, new rate, new term. One-time portability costs (single "custos da portabilidade" field: registry/appraisal/fees) are **kept OUT of the monthly payment streams** and compared against savings — counted exactly once: **break-even month = first month where cumulative (current-path payments − new-path payments) ≥ portability costs** (report "sem break-even no prazo" if never). Outputs: total remaining cost of each path (new path total = Σ payments + portability costs), monthly payment delta, break-even month, and a plain pt-BR recommendation sentence. Fire `portability_compared`.
      Accept: unit test on break-even incl. the no-break-even case; E2E with two rates shows savings and break-even; disclaimer that seguros/fees at the new bank may differ.

- [ ] **P2.4 Split MIP/DFI insurance + admin fee (accurate parcela).**
      Top real-world complaint (incl. Reclame Aqui, about Caixa's own simulator): real installment > simulated because of obligatory insurance. Engine has a single `insuranceRate` (% of balance/month); reality: **DFI = % of property value (fixed/month), MIP = % of outstanding balance scaled by borrower age**.
      Do: add `dfiRate` and `mipRate` + borrower-age input. Age presets come from a **versioned rate table: constant tagged with bank/product/date + source URL, clearly labeled in the UI as "estimativa — confira sua apólice"**, always manually overridable. Saved scenarios: **schema-versioned migration** (add `schemaVersion` to stored scenarios if absent; v(n)→v(n+1) maps `insuranceRate` → `mipRate`, `dfiRate: 0`; migration unit-tested against fixtures of stored-scenario JSON). Update summary + all exporters ("Seguros: MIP + DFI"); keep `marketing/` compiling.
      Accept: P0.8 fixture extended to a real bank schedule with MIP/DFI; migration tests; UI labels presets as estimates.

- [ ] **P2.5 "Amortizar ou Investir?" comparator (Premium) — foreground re-engagement only.**
      The most-debated question in BR personal finance; natural next step after our most-used feature. Inputs: extra amount, vehicle preset (CDI/Tesouro Selic — rates entered by user or a static versioned preset; **`bacen.ts` has no Selic series — do not pretend it does**; adding SGS 11/4189 is optional scope, with cache+fallback like TR/IPCA), tax regime (IR regressivo table), horizon. Outputs: amortize path (interest saved, new payoff, equivalent annual return) vs. invest path (gross, tax, net), winner badge, flip threshold. Reuse the prepayment engine.
      **Re-engagement, v1 = foreground only:** on app open, if a cached reference rate changed since last open beyond a threshold, show an in-app banner "A taxa mudou — vale mais amortizar ou investir agora?" deep-linking here. **Push/background-fetch infrastructure is explicitly out of scope** (no notification deps exist in the app; background execution is unreliable without infra). If local scheduled notifications are ever added, that's a separate owner-approved item.
      Accept: unit tests both paths incl. IR regressivo brackets and flip threshold; banner E2E with a mocked rate change; Premium-gated, `source: 'amortizar_investir'`.

- [ ] **P2.6 FGTS rules helper (discoverability).**
      With P2.1 shipped: short explainer sheet on FGTS usage rules per usage type (linked from the FGTS section), mirroring the site guide `fgts-no-financiamento`, citing the dated official guidance. Content + UI only. Measure `fgts_added` before/after.

- [ ] **P2.7 Prepayment Optimization Assistant (Premium).**
      Depends on P2.1 (recurrence) and targets P2.2's users. Prepayment simulation is the dominant use case; the assistant inverts it — state a goal, get the plan.
      **Goals:** (1) _Quitar até uma data_ — minimum recurring extra (reduce*term) that ends the loan by the target date; (2) \_Minimizar juros com meu orçamento* — given one-off and/or recurring budget, the plan minimizing total interest, with one honest pt-BR paragraph explaining why earlier + reduce*term wins; (3) \_Reduzir a parcela para um teto* — prepayment (amount + timing, reduce_payment) bringing the installment under a cap, reporting the extra interest paid vs. goal 2 for the cash-flow relief.
      **Implementation:** pure module `mobile/packages/@loan-engine/calculations/src/optimizer.ts` (additive; marketing build unaffected) — bounded binary search over full engine runs (≤ ~40 iterations, respect P0.7 caps), output = `prepayments[]` series via the P2.1 expander + summary vs. base scenario.
      **UI/gating:** entry in the prepayment section ("Não sabe quanto amortizar? Deixa que a gente calcula") + from saved scenarios; result shows plan, before/after, "Salvar como cenário" (respects P1.2 limit paywall). Free users: goal picker visible, result blurred behind paywall `source: 'prepayment_optimizer'`. Events: `optimizer_opened` (`entry_point`), `optimizer_plan_generated` (`goal`, `budget_bucket`, `horizon_months`, `interest_saved_bucket`), `optimizer_plan_saved`.
      Accept: unit tests per goal incl. "goal unreachable" → clear pt-BR message (never a garbage plan); property test: generated plan re-run through the engine reproduces the promised payoff/interest within rounding; E2E goal-1 happy path through save; paywall + events verified via the dry-run sink.

---

## P3 — Growth & platform

> Android launch is intentionally NOT on this roadmap — Lucas handles it manually himself. Do not pick up Android release engineering, Play listing, or site Play-badge work.

- [ ] **P3.1 Add web/PostHog instrumentation to the marketing site (funnel visibility only).**
      The site sends zero PostHog events — we cannot see whether the web simulator drives the App Store clicks paid ads bring. Add PostHog JS: `$pageview` + `simulator_interacted`, **and emit `app_store_click` to PostHog too** — the existing one in `marketing/app/AppStoreLink.tsx` goes only to Vercel Analytics, which would leave the PostHog funnel missing its conversion step (keeping the Vercel emit alongside is fine). Funnel measurement, not web-product investment.

- [ ] **P3.2 Comparison tab & professional export: decide by rule, don't drift.**
      Usage near zero (12 comparison events, 4 pro exports in 3 months). (a) _Now:_ surface "Comparar condições" as a CTA after a scenario save, and add a once-per-session `comparison_started` event (fires on first comparison-tab interaction; `comparison_configuration_updated` fires per debounced change and is NOT an adoption metric — one user can emit many). (b) _Decision rule on distinct users:_ after ≥100 distinct users with ≥1 `scenario_saved` post-release or 90 days, whichever first — if the share of those users who also have ≥1 `comparison_started` is < 10%, fold comparison into the calculator screen and retire the tab; otherwise keep and consider the deeper comparator. Record the decision in the completion note.

- [ ] **P3.3 Marketing-site feature sync (recurring — one sub-item per shipped feature).**
      The site is the acquisition funnel: silent features convert no one. Update the site in the same release cycle as each feature.
      Surfaces & conventions (`marketing/`): landing copy `marketing/app/page.tsx` (pt-BR, benefit-first); app-features pitch under the web simulator `marketing/app/components/Simulator/UnlockCTA` (must always reflect current premium-worthy features); guides `marketing/app/guias/content.ts` (statically generated; sitemap auto-includes new slugs; follow existing entry structure + JSON-LD pattern; every guide ends with an app CTA). Verify `cd marketing && npm run build`. **App Store listing copy is owner-only** — when a change would also improve the store description, write the suggested copy in the completion note for Lucas instead of touching store surfaces.
      Per-feature mapping:
  - [ ] **P0.8 accuracy claim** → landing copy scoped to validated scenario classes + methodology note (e.g. section in the `o-que-e-cet` guide). Never before the fixtures pass.
  - [ ] **P2.1 recurring prepayments + FGTS presets** → UnlockCTA bullet; extend `fgts-no-financiamento` and `amortizar-prazo-ou-parcela` guides with a recurrence section (usage-correct rules) + app CTA.
  - [ ] **P2.2/P2.3 existing contract + portability** → new guide "Vale a pena amortizar (ou portar) meu financiamento atual?" + landing bullet "já tem um financiamento? simule amortização e portabilidade".
  - [ ] **P2.4 MIP/DFI** → new guide "Por que a parcela real fica maior que a simulada? (MIP, DFI e taxas)" — targets the #1 complaint; UnlockCTA bullet.
  - [ ] **P2.5 Amortizar ou Investir** → new guide "Amortizar o financiamento ou investir? Como decidir" + landing bullet; strongest SEO topic — write headings to match question phrasings.
  - [ ] **P2.7 Prepayment Optimization Assistant** → new guide "Qual a melhor estratégia para amortizar o financiamento?" (goal-based framing) + UnlockCTA bullet ("assistente que calcula seu melhor plano de amortização — Premium").
  - [ ] **P1.7 onboarding example** → no site work (internal UX). Listed to make the "no counterpart" decision explicit.
        Accept (per sub-item): site builds green; new pages in sitemap; pt-BR copy with app CTA; completion note records surfaces changed (+ any suggested store copy for Lucas).
