# Repository Guidelines

## Project Overview
- Expo 54 mobile app (iOS + Android only) for a SAC/Price loan calculator.
- PT-BR only, offline-first; no backend or sign-in.
- Freemium: ads for free users; one-time IAP (R$ 10,00) removes ads and unlocks exports (PDF/XLSX/CSV).
- Ignore automated content/social pipeline and any server/database persistence.

## Product Scope Highlights
- SAC and Price formulas:
  - Price: parcela fixa via fórmula PGTO.
  - SAC: amortização = principal / nº parcelas; juros = saldo anterior × taxa; saldo = saldo anterior – amortização.
- Inputs: principal, taxa (mensal/anual), prazo (meses/anos), data inicial, dia de vencimento.
- Optional: custos/seguros (taxa adm, abertura, seguro, IOF), ajuste de dia útil.
- Outputs: tabela de amortização, resumo (total pago/juros, 1ª/última parcela), gráficos (saldo, parcelas, composição).
- Prepayments: amortizações extras com estratégia reduzir prazo/parcela.
- Comparação SAC vs Price com cards lado a lado.
- Tabs: Calculadora, Comparar, Premium, Feedback (abre email padrão).

## Structure
- `calculadora-price-sac/` — Expo app source
- `EXPO_ROADMAP.md` — roadmap for mobile development
- `Tabela Price e SAC.xlsx` — original reference model
- `RELEASE_CHECKLIST.md` — passos de release (ads, IAP, stores)
- `maestro/` — testes de UI (flows principais)

## Tech Stack
- Expo 54, TypeScript, ESLint (flat config)
- Local storage only (no server persistence)

## Dev Commands (run in `calculadora-price-sac/`)
- `npm install`
- `npm run start`
- `npm run android`
- `npm run ios`
- `npm run lint`
- `npx tsc --noEmit`
- `npm test` (vitest)
- `npm run ui:maestro` (UI tests)
- `npm run ui:maestro:expo` (UI tests via Expo Go)

## Product Constraints
- Offline-first calculations and scenarios
- No user accounts
- Paid users only: PDF/XLSX/CSV export
- Ads shown wherever possible for free users

## Notes
- Use local storage for scenarios, settings, and premium state.
- Keep UI clear and simple with large touch targets.
- IAP SKU: `remove_ads` (iOS + Android).
- IAP fallback price label: `IAP_FALLBACK_PRICE` em `src/lib/iap.ts`.
- IAP não funciona no Expo Go (Store Client); só em builds de desenvolvimento/produção.
- AdMob IDs ficam em `app.json` e o banner usa `src/components/AdBanner.tsx`.
- Exportadores em `src/lib/exports/` (CSV/XLSX/PDF) e usam `expo-sharing`.
- EAS build: `eas.json` presente, `expo-constants` instalado, `react-native-worklets` fixado na versão do SDK.
- Sentry: inicializado em `src/lib/sentry.ts`, ativo só em produção quando `extra.sentryDsn` estiver definido.
