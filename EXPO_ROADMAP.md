# Expo Mobile Roadmap (iOS + Android)

This roadmap plans a **PT-BR, offline-first** Expo app for the SAC/Price loan calculator.
Scope excludes automated content/social pipeline and any backend persistence. All data
is stored locally on-device.

---

## 0) Decisions Needed (blockers)
- **App name**: Calculadora Price & SAC ✅
- **Ad network**: AdMob (Android + iOS) ✅
- **In‑app purchase**: one‑time purchase “Remove Ads” ✅
- **Charts**: include in v1 ✅
- **Export UX**: share sheet + “Save to Files” ✅

---

## 1) Product Goals (mobile‑optimized)
- **Fast, clear simulations** for SAC and Price.
- **Offline-first**: no network required for calculator, scenarios, or exports.
- **Freemium**:
  - **Free**: full calculations + ads.
  - **Paid (R$ 5,00 one‑time)**: remove ads + enable exports (PDF/XLSX/CSV).
- **No login**. No server‑side persistence.

---

## Spreadsheet Parity (Tabela Price e SAC.xlsx)
Ensure the mobile app reproduces the spreadsheet’s core calculations:

### Shared setup
- **Inputs**:
  - Financiamento (principal) = `H1`
  - Taxa ao mês = `H2`
  - Número de parcelas (n) = `A14`
- **Linha 0 (A2–E2)**:
  - Parcela = 0
  - Juros = 0
  - Amortização = 0
  - Pagamento = 0
  - Saldo Devedor = `H1`

### Price (Tabela Price)
- **Pagamento fixo**: `PMT(taxa, n, -saldo_inicial)`
  - In Excel: `D3 = PMT(H2, A14, -E2)`
  - `D4 = D3` (pagamento constante)
- **Juros**: `B = taxa * saldo_anterior`  
  - `B3 = H2 * E2`
- **Amortização**: `C = pagamento - juros`  
  - `C3 = D3 - B3`
- **Saldo Devedor**: `E = saldo_anterior - amortização`  
  - `E3 = E2 - C3`
- **Totais**:
  - Total Juros = `SUM(B2:B15)`
  - Total Pago = `SUM(D2:D15)`

### SAC (Sistema de Amortização Constante)
- **Amortização fixa**: `C = principal / n`  
  - `C3 = H1 / A14`
  - `C4 = C3` (constante)
- **Juros**: `B = taxa * saldo_anterior`
  - `B3 = H2 * E2`
- **Pagamento**: `D = amortização + juros`
  - `D3 = C3 + B3`
- **Saldo Devedor**: `E = saldo_anterior - amortização`
  - `E3 = E2 - C3`
- **Totais**:
  - Total Juros = `SUM(B2:B15)`
  - Total Pago = `SUM(D2:D15)`

### Implementation notes
- Use the spreadsheet’s **full‑precision math** for internal calculations; round to cents only for display/export.
- Preserve the **row 0** semantics (saldo inicial at parcela 0) to match totals.

---

## Progress Log
- 2026-01-05: Expo app created at `calculadora-price-sac/` with TypeScript template.
- 2026-01-05: ESLint configured (flat config) and `lint` script added.
- 2026-01-05: Lint and typecheck pass (`npm run lint`, `npx tsc --noEmit`).
- 2026-01-05: Repo cleaned (removed legacy `webapp/` and `video.md`).
- 2026-01-05: Added `AGENTS.md` documenting project context.
- 2026-01-05: Expo Router tabs scaffolded (Calculadora / Comparar).
- 2026-01-05: Core domain types + calculation engine ported to mobile.
- 2026-01-05: Basic calculator and comparison screens implemented.
- 2026-01-05: Phase 1 complete (lint + typecheck passing).
- 2026-01-05: Phase 2 complete (scenarios, prepayments, amortization table, charts, validation).
- 2026-01-05: Phase 3 complete (ads, premium gating, IAP remove-ads flow, export gated).
- 2026-01-05: Phase 4 complete (PDF/XLSX/CSV exports with share sheet).
- 2026-01-05: Phase 5 started (acessibilidade, ajustes mobile, otimizações de tabela).
- 2026-01-05: Phase 6 Sprint A/B iniciado (custos, modo imobiliário, UI e validações).

---

## Tech Stack (decisions)
- Expo 54 (latest)
- TypeScript
- ESLint

---

## Recommended Libraries
- **Navigation**: Expo Router (recommended for Expo projects; built on React Navigation) citeturn4search2turn1search8
- **Storage**: `@react-native-async-storage/async-storage` for local persistence citeturn3search4turn3search5
- **Charts**: `react-native-svg` + `react-native-svg-charts` (SVG-based charts) citeturn2search1turn3search2
- **Ads (AdMob)**: `react-native-google-mobile-ads` (Expo’s AdMob module is deprecated) citeturn4search4turn4search3
- **IAP**: `expo-iap` (Expo-compatible IAP library) citeturn0search0turn0search6

---

## 2) UX Principles (PT‑BR, clear and simple)
- **Touch targets**: buttons/inputs at least **44pt (iOS)** and **48dp (Android)**; keep spacing to reduce mis-taps. citeturn1search4turn1search0
- **Forms**: always show labels; validation messages should be visible and readable. citeturn1search3
- **Legibility**: keep text large enough and high contrast. citeturn1search4
- **Spacing**: avoid crowded layouts; group related inputs and controls. citeturn1search4turn1search1

---

## 3) Monetization & Ads (policy‑safe)
**Ad policy‑safe behaviors** to implement:
- **No interstitials on app load or exit**, and only show them at natural breaks. citeturn2search1
- **Avoid repeated interstitials**; don’t show one after every action. citeturn2search1
- **Reserve fixed ad space** so ads don’t shift content and cause accidental taps. citeturn2search3
- **Don’t show ads on “dead‑end” screens** (empty states, error pages, purchase confirmation). citeturn2search3
- **Interstitials must be clearly labeled and easily dismissible** on iOS. citeturn2search2

Ads only appear for free users; paid users see no ads and can export.

Implementation notes (v1):
- **IAP**: one‑time “Remove Ads” (non‑consumable), restore purchases flow on iOS/Android.
- **Premium state**: store locally; re‑validate via store APIs when “Restore” is used.
- **Ad placements**: banner in results screen, table screen, and comparison screen; interstitial only after explicit user action (e.g., export attempt while free) and never on cold start.

---

## 4) Data & Local Storage
- **Local only**: scenarios, settings, and prepayments stored on device.
- No sensitive data expected, but **avoid storing secrets in plaintext** if any appear later. citeturn0search0

---

## 5) Feature Roadmap

### Phase 1 — Foundation (Week 1–2)
**Goal:** Expo app skeleton + core calculation engine ported.

Checklist:
- [x] Create Expo app (TypeScript, iOS/Android only)
- [x] Configure ESLint (flat config) + lint script
- [x] Port domain types (`Scenario`, `ScheduleRow`, `LoanSummary`, `PrepaymentEvent`)
- [x] Port calculation logic:
  - SAC/Price formulas
  - Schedule generation
  - Summary totals
  - Validation rules
- [x] Basic UI shell (tabs: Calculadora, Comparar)
- [x] Input form (principal, rate, term, start date, due day)

Status: ✅ Complete

Exit Criteria:
- Calculator produces correct schedule and summary offline.

---

### Phase 2 — Core UX + Scenarios (Week 3–4)
**Goal:** Core experience usable end‑to‑end.

Checklist:
- [x] Summary cards (total paid, total interest, first/last payment)
- [x] Amortization table (paged or virtualized list)
- [x] Charts (saldo, parcelas, composição)
- [x] SAC vs Price comparison view
- [x] Scenario save/load/duplicate (local storage)
- [x] Prepayment events (local only, no server)
- [x] Validation & smart suggestions (e.g. rate type)

Status: ✅ Complete

Exit Criteria:
- Users can create and compare scenarios, and persist locally.

---

### Phase 3 — Ads + Premium (Week 5)
**Goal:** Freemium model live.

Checklist:
- [x] Integrate ad SDK (banner + optional interstitial)
- [x] Implement “Remove Ads” IAP (one‑time R$ 5,00)
- [x] Gate exports behind premium
- [x] “Upgrade” UX and paywall messaging

Exit Criteria:
- Free users see ads; paid users do not; premium state persists locally.

---

### Phase 4 — Exports (Week 6)
**Goal:** Export schedule & summary to files.

Checklist:
- [x] CSV export
- [x] XLSX export
- [x] PDF export (summary + table)
- [x] Share sheet flow for iOS/Android

Exit Criteria:
- Paid users can export PDF/XLSX/CSV offline.

---

### Phase 5 — Polish & Release (Week 7–8)
**Goal:** Production‑ready release.

Checklist:
- [x] Accessibility pass (touch targets, labels)
- [x] UI cleanup for small screens
- [x] Performance pass (large schedules, prepayment)
- [ ] Store assets (screenshots, description in PT‑BR)
- [ ] Store submission (iOS + Android)

Exit Criteria:
- App approved in both stores.

---

### Phase 6 — Market‑Inspired Enhancements (Post‑v1)
**Goal:** Add features found in comparable apps/simuladores.

Checklist:
- [ ] CET (Custo Efetivo Total) com detalhamento de custos no resumo
- [ ] Entradas de custos típicos (IOF, taxas, seguros, tarifa administrativa)
- [ ] Entrada + valor do imóvel → calcular automaticamente valor financiado
- [ ] Custos do imóvel no resumo (ITBI + taxas cartorárias)
- [ ] Modo financiamento imobiliário (campos/labels dedicados)
- [ ] FGTS opcional (entrada/amortização/parcelas)
- [ ] FGTS: opções de uso (liquidação, amortização, pagamento parcial de parcelas)
- [ ] Comparador rápido de condições (juros/prazo/entrada lado a lado)
- [ ] Exportar relatório com resumo de custos adicionais

Exit Criteria:
- Recursos habilitados e testados com cenários imobiliários reais.

---

#### Phase 6 — Detailed Breakdown (inputs, cálculos, UX, aceite)
1) CET + detalhamento de custos  
Inputs: taxas fixas, taxas percentuais, seguros e IOF.  
Cálculo: custo total anualizado (CET) e total pago com custos.  
UX: card de “CET” no resumo + seção “Custos” com total e itens.  
Aceite: CET aparece no resumo e bate com valores do cenário + custos exibidos.

2) Entradas de custos típicos  
Inputs: IOF, seguro MIP/DFI, tarifa administrativa, taxa de abertura.  
Cálculo: incluir custos no fluxo de parcelas e no resumo.  
UX: bloco “Custos” com toggle por item; ajuda rápida.  
Aceite: custos podem ser ativados/desativados e refletem no total pago.

3) Entrada + valor do imóvel  
Inputs: valor do imóvel e valor de entrada.  
Cálculo: valor financiado = imóvel – entrada.  
UX: campo de entrada em modo imobiliário e pré‑preenchimento do principal.  
Aceite: mudar entrada recalcula principal e atualiza tabela.

4) Custos do imóvel (ITBI + cartório)  
Inputs: ITBI (%) + cartório (fixo ou %).  
Cálculo: custo total imóvel = entrada + financiamento + custos.  
UX: resumo com custo total do imóvel + breakdown.  
Aceite: custos aparecem no resumo e no PDF.

5) Modo financiamento imobiliário  
Inputs: habilitar “Imobiliário” para mostrar campos específicos.  
Cálculo: mesmas fórmulas, mas com custos e entrada aplicados.  
UX: toggle “Imobiliário” no topo do cenário.  
Aceite: layout simplificado para uso imobiliário e campos extras só nesse modo.

6) FGTS opcional + usos  
Inputs: valor FGTS, data, uso (entrada/amortização/parcela).  
Cálculo: aplica redução no principal ou parcela conforme estratégia.  
UX: seção “FGTS” com presets e instruções.  
Aceite: cronograma reflete o uso escolhido e resumo ajusta total pago.

7) Comparador rápido de condições  
Inputs: até 3 cenários com juros/prazo/entrada.  
Cálculo: mesma base, apenas visual comparativo.  
UX: grid com cartão comparativo e ranking por “custo total”.  
Aceite: diferença percentual e valor absoluto exibidos.

8) Exportar relatório com custos adicionais  
Inputs: usar dados já calculados (sem novos inputs).  
Cálculo: incluir CET, custos e custo total do imóvel.  
UX: PDF/XLSX/CSV com seção “Custos” no topo.  
Aceite: export contém custos e CET e mantém formato atual.

#### Phase 6 — Task Breakdown (ordem sugerida)
**Sprint A (Cálculos + dados base)**
- Task A1: Modelar novos campos de custos (IOF, seguros, tarifa adm, taxa abertura, ITBI, cartório, entrada, valor imóvel).
- Task A2: Implementar cálculo de principal via entrada + valor do imóvel.
- Task A3: Calcular custos totais + custo total do imóvel.
- Task A4: Implementar cálculo de CET e exibir no summary model.
- Task A5: Atualizar testes unitários do engine (novos campos e cenários).

**Sprint B (UX + modo imobiliário)**
- Task B1: Criar toggle “Modo imobiliário” e ajustar labels.
- Task B2: UI de custos típicos com inputs e toggles.
- Task B3: UI de entrada + valor do imóvel (auto‑calc principal).
- Task B4: Resumo com CET + custos (cards adicionais).

**Sprint C (FGTS + comparador)**
- Task C1: Modelar FGTS (valor, data, uso).
- Task C2: Aplicar FGTS no cronograma (entrada/amortização/parcela).
- Task C3: UI de FGTS com presets.
- Task C4: Comparador rápido (até 3 condições).

**Sprint D (Exports + polimento)**
- Task D1: Incluir CET + custos no PDF.
- Task D2: Incluir CET + custos no XLSX/CSV.
- Task D3: Ajustar textos de ajuda e validações.
- Task D4: Atualizar docs e checklist final.

## 6) Risks & Mitigations
- **Ads policy violations** → follow AdMob + App Store ad rules (see Section 3). citeturn2search1turn2search2turn2search3
- **Large schedules** → use list virtualization + pagination.
- **File export on iOS** → verify share sheet behavior with expo-file-system + expo-sharing.
- **No backend** → handle data loss (backup/export + import).

---

## 7) Optional Backlog (Post‑launch)
- Charts (saldo devedor + composição de parcelas)
- Tutorials / onboarding
- Theme presets (clean light theme + high contrast)
- Multi‑scenario comparison grid

---

## 8) MVP Feature Summary (v1)
- SAC/Price calculator with amortization table
- Charts (saldo devedor + composição de parcelas)
- Scenario management (local)
- Prepayments (local)
- Comparison view
- Ads for free users
- Export (paid only): PDF/XLSX/CSV with share sheet + “Save to Files”
- Offline‑first, PT‑BR only
