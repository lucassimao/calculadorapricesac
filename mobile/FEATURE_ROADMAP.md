# Feature Scope Roadmap

## Objective

Increase app growth and business performance by shipping the highest-value features in the right order, with clear scope and measurable expected outcomes.

Primary metrics to improve:

- Impressions to product page conversion rate
- Product page views to downloads
- Sessions per active device
- Retention (D7/D30)
- Proceeds and proceeds per paying user

## Delivery Sequence

1. TR/IPCA Monetary Correction (Correção Monetária)
2. Offer Comparator (Assistente de Proposta)
3. Loan Portability (Portabilidade de Crédito)
4. Affordability Planner (Planejamento de Capacidade)
5. Subsidy/Eligibility Simulator
6. Prepayment Optimization Assistant
7. Rent vs. Buy (Alugar ou Comprar)
8. Consórcio Calculator
9. "Amortizar ou Investir?" Comparator (Premium)
10. Stress Test / Teste de Estresse (Premium)
11. Renda Comprometida Dashboard (Premium)
12. Branded PDF Reports — Modo Profissional (Premium)

Rationale:

- Feature 1 is a correctness gap: users with real indexed loans get wrong numbers today. Ship first, highest trust impact, relatively contained scope.
- Feature 2 drives acquisition by solving the most immediate real-world decision (choosing between bank offers).
- Feature 3 is a thin wrapper on the existing comparison screen and is highly actionable during rate cycles.
- Feature 4 and 5 broaden the top-of-funnel for buyers who haven't started yet.
- Feature 6 is the strongest monetization lever (premium-worthy, repeat sessions).
- Feature 7 captures a broader pre-decision audience and is highly shareable.
- Feature 8 is a niche differentiator that no tool does well.
- Features 9–12 are premium-only candidates discovered from Brazilian finance forum research. Recommended priority within this group: 9 → 10 → 12; 11 overlaps with the Affordability Planner (#4) and may be folded in instead of shipped separately.

---

## 1) Offer Comparator (Assistente de Proposta)

### Problem

Users need help deciding between bank offers, not only simulating one loan at a time.

### Scope (MVP)

- New guided flow to create and compare 2-3 offers.
- Offer inputs:
  - Loan system (SAC/Price)
  - Principal, term, rate type, rate
  - Upfront fees
  - Monthly fees/insurance
  - Any known subsidy/benefit applied
- Normalized result card per offer:
  - Total paid
  - Total interest
  - Total with costs
  - First and last installment
  - CET estimate
- Decision summary:
  - Best offer for lowest total cost
  - Best offer for lowest monthly burden
  - Best offer for cash-flow stability
- Export/share of comparison summary (existing export system can be reused later).

### Out of Scope (for MVP)

- OCR/import from PDF or screenshots.
- Automatic extraction from bank documents.
- Full legal validation of contract clauses.

### Sequence of Work

1. Define canonical offer data model and required fields.
2. Define comparison ranking rules and tie-breakers.
3. Design guided input UX and output cards.
4. Add comparison summary and recommendation logic.
5. Add instrumentation events for usage and completion.
6. Run internal validation with real sample offers.

### Expected Results

- Higher conversion from product page to install (clear value proposition).
- Higher active sessions from users comparing real decisions.
- Better user satisfaction and referrals.

---

## 2) Affordability Planner (Planejamento de Capacidade)

### Problem

Many users start without knowing what they can safely afford.

### Scope (MVP)

- New planner mode with user budget inputs:
  - Household net income
  - Existing monthly debt obligations
  - Available down payment
  - Target term
  - Conservative max commitment ratio
- Outputs:
  - Suggested max monthly installment
  - Suggested max financed amount
  - Suggested property price range
  - Safety indicator bands (safe / attention / risk)
  - Optional simulation handoff (“usar no simulador”)
- Include warnings for aggressive assumptions.

### Out of Scope (for MVP)

- Credit-score integration.
- Bank-specific approval probability.
- Full household financial planning.

### Sequence of Work

1. Define affordability formula and assumptions policy.
2. Define UX for fast onboarding and clear warnings.
3. Implement output ranges and scenario handoff.
4. Add guardrails for invalid/edge input cases.
5. Instrument adoption and conversion events.
6. Validate with sample user profiles.

### Expected Results

- More top-of-funnel relevance and installs.
- More repeat sessions as users adjust goals.
- Better retention from users in early decision stage.

---

## 3) Subsidy/Eligibility Simulator

### Problem

First-time buyers often depend on subsidy eligibility to make financing viable.

### Scope (MVP)

- Eligibility estimation flow based on user profile inputs:
  - Household income range
  - Property type/location (high-level)
  - First-home profile questions (as applicable)
- Outputs:
  - Estimated eligibility status (likely/possible/unlikely)
  - Estimated subsidy range (not exact)
  - Impact on financed amount and installment
  - Disclaimer: result is an estimate, not official approval
- One-click apply estimate to simulation scenario.

### Out of Scope (for MVP)

- Official government API integration.
- Legal/official eligibility guarantee.
- Full municipality-level policy edge cases.

### Sequence of Work

1. Define policy assumptions and update strategy.
2. Build rule engine for eligibility ranges.
3. Design transparent result UX with disclaimers.
4. Integrate estimate into existing simulation flow.
5. Add monitoring to detect assumption drift.
6. Run legal/compliance review of wording.

### Expected Results

- Better acquisition by solving a highly practical need.
- Higher engagement from first-time buyers.
- Strong differentiation vs generic loan calculators.

---

## 4) Prepayment Optimization Assistant

### Problem

Users know they can prepay, but not the best strategy for their objective.

### Scope (MVP)

- Optimization goals:
  - Pay off by target date
  - Reduce total interest as much as possible
  - Keep monthly payment under target cap
- Inputs:
  - Extra payment budget (monthly, annual, one-off)
  - Preferred strategy (reduce term / reduce payment / auto-recommend)
- Outputs:
  - Suggested prepayment plan
  - Savings in total interest
  - New payoff timeline
  - Impact on first/last installments
- Save optimized plan as scenario variant.

### Out of Scope (for MVP)

- Probabilistic cash-flow forecasting.
- Dynamic market-rate adaptive strategy.
- Multi-loan optimization.

### Sequence of Work

1. Define optimization objective functions.
2. Implement deterministic solver for strategy suggestions.
3. Add UX to compare baseline vs optimized plan.
4. Integrate with scenario save/load and exports.
5. Add Premium gating strategy if desired.
6. Validate with known benchmark cases.

### Expected Results

- Higher paid conversion and proceeds (premium-worthy value).
- Higher session depth from scenario experimentation.
- Improved retention among advanced users.

---

## Suggested Rollout Cadence

- Release 1: Offer Comparator
- Release 2: Affordability Planner
- Release 3: Subsidy/Eligibility Simulator
- Release 4: Prepayment Optimization Assistant

Recommended release pattern:

- 1 feature release every 2-3 weeks
- 1 week hardening/bugfix after each release
- Review metrics before locking next scope

## Success Criteria per Release

- Adoption: % active users who use new feature
- Completion: % users who finish the new flow
- Outcome: lift in downloads, sessions/device, retention, proceeds

## Risks and Mitigations

- Risk: policy assumptions become outdated
  - Mitigation: version assumptions, keep change log, show update date
- Risk: too much complexity in UI
  - Mitigation: step-by-step flows and progressive disclosure
- Risk: trust issues for estimates
  - Mitigation: transparent assumptions and clear disclaimers
- Risk: scope creep
  - Mitigation: strict MVP out-of-scope enforcement per release

---

## 6) Loan Portability (Portabilidade de Crédito)

### Problem

When interest rates drop, existing loan holders don't know if switching banks is worth it after factoring in fees and remaining balance.

### Scope (MVP)

- New "Portabilidade" mode inside the comparison tab (or as a dedicated flow).
- Inputs for the current loan:
  - Remaining balance
  - Current rate and remaining term
  - Loan system (SAC/PRICE)
- Inputs for the new offer:
  - New rate
  - Any portability fees (tariff, ITBI if applicable)
- Outputs:
  - Side-by-side: total remaining cost on current loan vs. new loan
  - Break-even month (when savings exceed fees)
  - Monthly savings from switching
  - Recommendation: worth it / not worth it
- Reuses existing `generateAmortizationSchedule` and `calculateLoanSummary`.

### Out of Scope (for MVP)

- Automated retrieval of current loan data from banks.
- Legal/compliance advice on portability eligibility rules.
- Multi-bank optimization (pick best of N offers).

### Sequence of Work

1. Define portability comparison data model (current loan + new offer).
2. Implement break-even calculation (month when cumulative savings exceed fees).
3. Design side-by-side result UI with recommendation.
4. Add export of portability summary.
5. Instrument usage events.

### Expected Results

- High engagement from existing loan holders during rate-change cycles.
- Strong word-of-mouth for actionable money-saving insight.

---

## 7) Rent vs. Buy (Alugar ou Comprar)

### Problem

Users early in the property decision process don't know whether buying is financially better than renting over their planning horizon.

### Scope (MVP)

- Standalone flow with two paths: Buy and Rent.
- Buy inputs: property value, down payment, mortgage rate/term/system, property appreciation rate, maintenance cost rate, ITBI/cartório fees.
- Rent inputs: current monthly rent, expected annual rent growth rate.
- Common inputs: planning horizon (years), investment return rate (opportunity cost of down payment).
- Outputs:
  - Total cost of buying vs. renting over the horizon
  - Net worth impact (equity built vs. investment growth of down payment)
  - Break-even year
  - Chart: cumulative cost over time for each path
- Clear disclaimers: estimates, not financial advice.

### Out of Scope (for MVP)

- Tax implications (IRPF on capital gains).
- Rental income scenarios (investment property).
- City/neighborhood-level appreciation data.

### Sequence of Work

1. Define the financial model and assumptions policy.
2. Implement year-by-year cost projection for both paths.
3. Design inputs UX with sensible Brazilian defaults (appreciation ~5% a.a., Selic as opportunity cost).
4. Build result screen with break-even and net-worth comparison.
5. Add disclaimers and assumptions transparency.
6. Instrument usage and completion events.

### Expected Results

- Broad top-of-funnel reach (pre-decision users).
- Highly shareable results ("I should buy in X years").
- Strong store page differentiation.

---

## 8) Consórcio Calculator

### Problem

Consórcio is one of the most popular ways to buy property in Brazil, but no calculator tool models it well. Users can't compare it against traditional financing.

### Scope (MVP)

- Standalone consórcio flow:
  - Credit letter value (valor da carta)
  - Number of months (prazo)
  - Admin fee rate (taxa de administração) — total and monthly breakdown
  - Fundo de reserva rate
  - Seguro rate (if applicable)
- Outputs:
  - Monthly installment (quota)
  - Total paid over the term
  - Total fees paid
  - Effective total cost
- Comparison mode: consórcio vs. financing side-by-side
  - Same credit letter value, same term
  - Show which costs less in total, and in monthly burden
  - Note: consórcio has no interest but has waiting time (addressed by disclaimer)
- Disclaimer: contemplation timing is probabilistic and not modeled.

### Out of Scope (for MVP)

- Lance (bid) strategies and probability modeling.
- Administrator-specific rules and fee structures.
- Second-hand quota market pricing.

### Sequence of Work

1. Define the consórcio cost model (quota, admin fee, fundo de reserva, seguro).
2. Build monthly installment and total cost calculation.
3. Design input/output UI, clearly separated from the mortgage calculator.
4. Add comparison mode against an equivalent financing scenario.
5. Add disclaimers about contemplation timing.
6. Instrument usage events.

### Expected Results

- Unique differentiation — no competing app models consórcio vs. financing well.
- Captures users who are undecided between consórcio and financing.
- New keyword surface area for store search.

---

## Summary

This sequence prioritizes:

1. correctness for existing loan holders (indexed loans),
2. decision support users immediately understand (offer comparison, portability),
3. broader acquisition relevance (affordability, rent vs. buy),
4. local practical value (subsidies, consórcio),
5. strongest monetization leverage (prepayment optimization).

---

## 5) TR/IPCA Monetary Correction (Correção Monetária)

### Problem

Many Brazilian mortgages (especially Caixa SFH/SFI) use a monetary correction index — TR or IPCA — applied monthly to the outstanding balance. Users with these loans cannot model them accurately today, and the app gives wrong numbers for any indexed loan.

### Scope (MVP)

- New optional fields on a scenario: correction index type (TR / IPCA / none) and monthly index rate.
- When an index is selected, automatically fetch the latest rate from the BACEN API (series 226 for TR, series 433 for IPCA) and pre-fill the field with the reference date shown.
- If offline or API unavailable, leave the field empty with a prompt for manual entry.
- Fetched rate is cached for the session; user can always override.
- Math: at the start of each period, correct the balance upward by `balance × indexRate_monthly`. After correction, recalculate the period's payment/amortization quota normally (PRICE recalculates PMT; SAC recalculates fixed amortization — both use remaining term).
- New `indexCorrection` column in the amortization table and exports (CSV/XLSX/PDF) when an index is active.
- Summary section shows index type and rate used.

### Integration points

- `mobile/src/types/loan.ts` — add `indexType?: 'TR' | 'IPCA'` and `indexRate?: number` to `Scenario`; add `indexCorrection?: number` to `ScheduleRow`.
- `mobile/src/lib/calculations.ts` — add balance correction step inside the PRICE and SAC loops.
- `mobile/src/lib/bacen.ts` (new) — `fetchLatestTR()` and `fetchLatestIPCA()` using BACEN open data API.
- `mobile/src/components/calculator/ScenarioSection.tsx` — add correction index picker and rate input after existing rate fields.
- `mobile/src/lib/exports/` — add `indexCorrection` column and summary line in CSV, XLSX, PDF.

### Out of Scope (for MVP)

- Historical rate time series (full month-by-month actual values from BACEN).
- Automatic split between historical and projected periods.
- TR/IPCA forecasting or projection curves.

### Sequence of Work

1. Add `indexType` and `indexRate` to `Scenario` type and `indexCorrection` to `ScheduleRow`.
2. Implement `bacen.ts` with fetch + session cache + graceful fallback.
3. Update `generateAmortizationSchedule` to apply balance correction each period.
4. Add correction picker and rate input to `ScenarioSection`.
5. Add `indexCorrection` column to all three export formats.
6. Add unit tests for corrected PRICE and SAC schedules.
7. Validate output against a known Caixa SFH amortization statement.

### Expected Results

- Existing loan holders can model their actual loan for the first time.
- Broader accuracy increases trust and word-of-mouth.
- Differentiates the app from generic calculators that ignore correction indices.

---

## 9) "Amortizar ou Investir?" Comparator (Premium)

### Problem

The single most-debated topic in Brazilian personal-finance forums (r/investimentos, r/financaspessoaisbrasil, InvestNews) is whether to use spare cash to prepay the mortgage or invest it at Selic/CDI/Tesouro IPCA+. Existing loan holders have no tool that compares the after-tax return of investing against the guaranteed "return" of cutting mortgage interest.

### Scope (MVP)

- New premium-only flow attached to a saved scenario.
- Inputs:
  - Extra monthly amount available
  - Investment vehicle preset (Selic, CDI %, Tesouro IPCA+, custom annual rate)
  - Tax regime (IR regressivo table by holding period, isento for LCI/LCA)
  - Horizon (months) — defaults to remaining loan term
- Outputs:
  - Path A — Amortize: total interest saved, new payoff date, equivalent annual return
  - Path B — Invest: gross balance, IR withheld, net balance at horizon
  - Net delta in R$ and as a clear winner badge
  - Sensitivity bar: how much Selic would need to change to flip the decision
- Reuses existing prepayment engine for Path A.
- Premium gating: full numeric output and export require subscription; free users see a teaser ("Você economizaria R$ X,XXX amortizando — desbloqueie para ver a comparação completa").

### Out of Scope (for MVP)

- Stochastic projections (Monte Carlo on Selic path).
- Custodial fees per broker.
- Tax-loss harvesting strategies.
- Multi-product portfolio split (e.g., 60% Tesouro, 40% CDB).

### Sequence of Work

1. Define the comparator data model and tax-regime tables.
2. Implement after-tax investment projection (regressive IR table for renda fixa).
3. Reuse prepayment engine to compute interest-saved path.
4. Build result UI with winner badge and sensitivity bar.
5. Wire premium gating and teaser state.
6. Add export of the comparison summary (PDF/CSV).
7. Instrument paywall view, paywall conversion, and feature usage events.

### Expected Results

- Strong paid conversion: directly answers the #1 forum question.
- High repeat usage as users adjust Selic or extra amount.
- Sharable winner cards drive word-of-mouth.

---

## 10) Stress Test / Teste de Estresse (Premium)

### Problem

Brazilian indexed loans (TR/IPCA) and household budgets are vulnerable to rate shocks, income loss, and inflation spikes. Users committing to a 30-year loan have no way to see how their installment behaves under adverse scenarios before signing.

### Scope (MVP)

- New premium-only "Teste de Estresse" tab on a saved scenario.
- Predefined shock scenarios (toggleable):
  - Selic +2pp / +4pp shock (for post-fixado contracts)
  - IPCA spike (e.g., +5pp annualized for 12 months)
  - Income loss (-20% / -40% for N months)
  - Combined adverse scenario (rate + income)
- Outputs per scenario:
  - New peak installment value and month
  - Months at risk (installment > 30% of declared income)
  - Worst-case total cost vs. baseline
  - Risk gauge: green / yellow / red
- Recommendation card: suggested emergency reserve months for the chosen scenario.
- Requires income input (reused from Affordability Planner if present).

### Out of Scope (for MVP)

- Custom user-defined shock parameters (only presets in MVP).
- Probability-weighted scenario blending.
- Historical back-testing against real Selic/IPCA series.

### Sequence of Work

1. Define stress scenario presets and shock application math.
2. Reuse `generateAmortizationSchedule` with overridden index/rate paths.
3. Implement risk-gauge thresholds and emergency-reserve recommendation.
4. Build comparison UI (baseline vs. stressed schedule).
5. Wire premium gating with free-tier teaser (single shock preview).
6. Add export of stress-test report.
7. Instrument scenario selection and conversion events.

### Expected Results

- Premium-worthy depth that no Brazilian calculator offers.
- Builds trust by showing risks transparently before commitment.
- Repeat sessions as users tune scenarios and reserves.

---

## 11) Renda Comprometida Dashboard (Premium)

### Problem

Users juggle multiple monthly obligations (mortgage, car, credit card, school) and lack a single view of total debt-to-income ratio across the loan's life. Banks evaluate this; users currently can't.

> Note: significant overlap with Feature 4 (Affordability Planner). Likely better folded into the Planner as a premium tab than shipped standalone. Kept here as a candidate for evaluation.

### Scope (MVP)

- Premium-only dashboard mode.
- Inputs:
  - Household net income
  - Other monthly obligations (free-form list with amount + remaining months)
  - Linked mortgage scenario
- Outputs:
  - Current debt-to-income (DTI) ratio
  - DTI trajectory over time (line chart) as obligations end and the mortgage installment evolves (especially for SAC and indexed loans)
  - Months above bank-recommended thresholds (30% / 40%)
  - Suggested actions: extend term, prepay specific debt first, etc.

### Out of Scope (for MVP)

- Account aggregation / Open Finance integration.
- Credit-bureau score modeling.
- Automatic categorization of expenses.

### Sequence of Work

1. Decide whether to ship standalone or fold into Affordability Planner (#4).
2. If standalone: define obligations data model and persistence.
3. Implement DTI trajectory calculation across the loan lifetime.
4. Build dashboard UI with chart and threshold bands.
5. Wire premium gating.
6. Instrument adoption and threshold-breach events.

### Expected Results

- Higher perceived value of premium for users with multiple obligations.
- Stickiness: users return monthly to update obligations and re-check DTI.
- Caveat: ROI uncertain due to overlap with #4 — validate with prototype before full build.

---

## 12) Branded PDF Reports — Modo Profissional (Premium)

### Problem

Brokers, real-estate agents, and independent financial planners use the app to model loans for clients but currently can only export the generic PDF. They want to deliver a polished, branded document that reinforces their professional identity.

### Scope (MVP)

- Premium-only "Modo Profissional" toggle on the export dialog.
- Brand profile (saved per user):
  - Logo upload
  - Name / company / CRECI or CFP registration
  - Phone, email, website
  - Optional brand color (single accent color)
- Output: enhanced PDF with:
  - Header: logo + professional info
  - Cover page: client name (optional), scenario summary, generation date
  - Existing schedule and summary sections, restyled with the accent color
  - Footer on every page with professional contact and a small disclaimer
- Reuses existing `exportPdf` infrastructure; adds brand-aware HTML template variant.

### Out of Scope (for MVP)

- Multiple saved brand profiles per user.
- Custom typography or full theme editor.
- White-label app distribution.
- Branded CSV/XLSX (only PDF in MVP).

### Sequence of Work

1. Design brand profile data model and storage (local; no backend dependency).
2. Build brand profile editor UI inside Premium settings.
3. Add `professional` option to `PdfOptions` and a second HTML template that consumes the brand profile.
4. Add cover page and header/footer rendering with logo embed (base64).
5. Wire premium gating and "Profissional" badge on the export sheet.
6. Instrument professional-export usage and brand-profile completion events.

### Expected Results

- Captures broker / agent segment with clear willingness to pay.
- Each client report exported is implicit marketing for the app.
- Higher LTV from professional users (active across many sessions per month).
