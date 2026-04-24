# Feature Roadmap

## Objective

Increase app growth and business performance by shipping only the next product features that are still planned for implementation. Completed work such as TR/IPCA correction, rewarded exports, ad gates, professional PDF export, brand profile, responsive amortization table, and marketing capture flows has been removed from this roadmap.

Primary metrics to improve:

- Product page views to downloads
- Sessions per active device
- Retention (D7/D30)
- Premium conversion and proceeds per paying user
- Export usage and professional-user repeat sessions

## Delivery Sequence

1. Offer Comparator (Assistente de Proposta)
2. Loan Portability (Portabilidade de Credito)
3. "Amortizar ou Investir?" Comparator (Premium)
4. Prepayment Optimization Assistant (Premium)
5. Affordability Planner (Planejamento de Capacidade)
6. Rent vs. Buy (Alugar ou Comprar)
7. Consorcio Calculator

---

## 1) Offer Comparator (Assistente de Proposta)

### Problem

Users need help deciding between bank offers, not only simulating one loan at a time.

### Scope (MVP)

- Guided flow to create and compare 2-3 offers.
- Offer inputs: loan system, principal, term, rate, upfront fees, monthly fees/insurance, and optional subsidy/benefit.
- Normalized result card per offer: total paid, total interest, total with costs, first/last installment, and CET estimate.
- Decision summary: best offer for lowest total cost, lowest monthly burden, and cash-flow stability.
- Export/share comparison summary after the core flow is stable.

### Out of Scope

- OCR/import from PDFs or screenshots.
- Automatic extraction from bank documents.
- Legal validation of contract clauses.

### Success Signals

- Higher sessions per active device from users comparing real offers.
- More export/share actions from comparison results.
- More premium upgrades if advanced comparisons become gated.

---

## 2) Loan Portability (Portabilidade de Credito)

### Problem

Existing loan holders do not know whether switching banks is worth it after factoring in remaining balance, new rate, and portability fees.

### Scope (MVP)

- Flow inside the comparison area or a dedicated portability screen.
- Current loan inputs: remaining balance, current rate, remaining term, and loan system.
- New offer inputs: new rate, term, and portability fees.
- Outputs: current remaining cost vs. new loan cost, break-even month, monthly savings, and recommendation.
- Reuse the existing amortization engine and summary logic.

### Out of Scope

- Automated retrieval of bank loan data.
- Legal/compliance advice on eligibility.
- Multi-bank optimization across many offers.

### Success Signals

- High engagement from existing loan holders during rate-change cycles.
- More repeat usage as users test new bank offers.

---

## 3) "Amortizar ou Investir?" Comparator (Premium)

### Problem

Brazilian users frequently need to decide whether spare cash should prepay the mortgage or be invested in Selic/CDI/Tesouro-style products. The app should make that tradeoff explicit.

### Scope (MVP)

- Premium-only flow attached to a scenario.
- Inputs: extra amount, investment vehicle preset, tax regime, and horizon.
- Outputs:
  - Amortize path: interest saved, new payoff date, equivalent annual return.
  - Invest path: gross balance, tax withheld, net balance at horizon.
  - Winner badge and net delta in BRL.
  - Sensitivity threshold for when the recommendation flips.
- Reuse the prepayment engine for the amortization path.

### Out of Scope

- Monte Carlo projections.
- Broker-specific fees.
- Multi-product portfolio allocation.

### Success Signals

- Premium conversion from a clear money-saving decision.
- Repeat usage as users adjust rates, horizon, and extra payment.

---

## 4) Prepayment Optimization Assistant (Premium)

### Problem

Users can add amortizations manually, but they still need help choosing the best strategy for their objective.

### Scope (MVP)

- Goals: pay off by target date, minimize total interest, or keep monthly payment under a cap.
- Inputs: monthly/annual/one-off extra payment budget and preferred strategy.
- Outputs: suggested prepayment plan, total interest savings, new payoff timeline, and installment impact.
- Save optimized plan as a scenario variant.

### Out of Scope

- Probabilistic cash-flow forecasting.
- Dynamic market-rate adaptive strategy.
- Multi-loan optimization.

### Success Signals

- Higher premium conversion and retention from advanced users.
- More saved scenarios and exports from optimized plans.

---

## 5) Affordability Planner (Planejamento de Capacidade)

### Problem

Many users start without knowing what they can safely afford.

### Scope (MVP)

- Planner mode with household income, existing debt, available down payment, target term, and max commitment ratio.
- Outputs: suggested max installment, max financed amount, property price range, and safety bands.
- Handoff action to use the recommended values in the simulator.
- Clear warnings for aggressive assumptions.

### Out of Scope

- Credit-score integration.
- Bank-specific approval probability.
- Full household financial planning.

### Success Signals

- More top-of-funnel relevance and installs.
- Higher retention among early-stage buyers adjusting goals.

---

## 6) Rent vs. Buy (Alugar ou Comprar)

### Problem

Users early in the property decision process need to compare buying vs. renting over a realistic planning horizon.

### Scope (MVP)

- Standalone flow with Buy and Rent paths.
- Buy inputs: property value, down payment, financing assumptions, appreciation, maintenance, and purchase fees.
- Rent inputs: monthly rent and expected annual rent growth.
- Shared inputs: planning horizon and opportunity-cost return.
- Outputs: total cost, net worth impact, break-even year, and cumulative cost chart.
- Disclaimers: estimates, not financial advice.

### Out of Scope

- Tax implications.
- Investment-property rental income scenarios.
- City/neighborhood-level appreciation data.

### Success Signals

- Broader acquisition from pre-decision users.
- Sharable results and better store-page differentiation.

---

## 7) Consorcio Calculator

### Problem

Consorcio is common in Brazil, but users need a clearer way to model fees and compare it against traditional financing.

### Scope (MVP)

- Standalone consorcio flow.
- Inputs: credit letter value, term, admin fee, reserve fund, and insurance.
- Outputs: monthly quota, total paid, total fees, and effective total cost.
- Comparison mode: consorcio vs. financing using the same value and term.
- Disclaimer that contemplation timing is probabilistic and not modeled.

### Out of Scope

- Bid strategy probability modeling.
- Administrator-specific rule engines.
- Second-hand quota market pricing.

### Success Signals

- New keyword surface for store discovery.
- Differentiation from generic financing calculators.

---

## Rollout Cadence

- Ship one feature release every 2-4 weeks.
- Reserve one hardening window after each feature.
- Review adoption, completion, export usage, and premium conversion before locking the next scope.
