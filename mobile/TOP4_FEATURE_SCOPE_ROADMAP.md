# Top 4 Feature Scope Roadmap

## Objective

Increase app growth and business performance by shipping the 4 highest-value features in the right order, with clear scope and measurable expected outcomes.

Primary metrics to improve:

- Impressions to product page conversion rate
- Product page views to downloads
- Sessions per active device
- Retention (D7/D30)
- Proceeds and proceeds per paying user

## Delivery Sequence

1. Offer Comparator (Assistente de Proposta)
2. Affordability Planner (Planejamento de Capacidade)
3. Subsidy/Eligibility Simulator
4. Prepayment Optimization Assistant

Rationale:

- Feature 1 and 2 maximize broad user value and acquisition fit.
- Feature 3 increases local relevance and practical impact for first-time buyers.
- Feature 4 is strongest for monetization and repeat usage.

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

## Summary

This sequence prioritizes:

1. decision support users immediately understand,
2. broader acquisition relevance,
3. local practical value,
4. strongest monetization leverage.
