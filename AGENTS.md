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
- `FIXES_ROADMAP.md` — bug fixes and improvements roadmap (all completed)
- `Tabela Price e SAC.xlsx` — original reference model
- `RELEASE_CHECKLIST.md` — passos de release (ads, IAP, stores)
- `maestro/` — testes de UI (flows principais)

## Architecture
- **Theme System**: `src/lib/theme.ts` provides light/dark mode via `useTheme()` hook. Colors are WCAG AA compliant.
- **Calculator Components**: `src/components/calculator/` contains extracted components:
  - `ScenarioSection.tsx` - Save/load/delete scenarios
  - `SystemSelector.tsx` - Price/SAC and loan mode toggles
  - `SummarySection.tsx` - Calculation results
  - `ExportSection.tsx` - PDF/XLSX/CSV export
  - `ValidationSection.tsx` - Error/warning banners
- **Utility Functions**: `src/lib/utils.ts` contains:
  - `formatDateBR()` - Brazilian date format (DD/MM/YYYY)
  - `parseLocalDate()` - Accepts both YYYY-MM-DD and DD/MM/YYYY
  - `parseCurrencyInput()` - Brazilian currency parsing
  - `parseNumberInput()` - Brazilian number format (comma decimal)

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

## IAP Implementation
- Self-contained: no external API for subscription validation
- Uses `expo-iap` for store integration
- Premium state stored locally in AsyncStorage
- Receipt validation on app launch via `getAvailablePurchases()`
- Revokes premium if no valid entitlement found (handles refunds)
- Platform-specific modal styling (iOS: centered, Android: bottom sheet)

## Recent Improvements (FIXES_ROADMAP.md - All Completed)
- **Date handling**: Fixed timezone issues, proper month overflow, Brazilian format
- **CET calculation**: Uses actual dates for accurate IRR/NPV
- **Dark mode**: Full theme support across all screens
- **Component extraction**: Calculator split into reusable components
- **Accessibility**: Proper labels and roles for screen readers
- **Ad placement**: Reduced from 9 to 4 strategic placements
