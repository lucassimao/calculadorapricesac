# Repository Guidelines

## Project Overview

- Expo 56 mobile app (iOS + Android only) for a SAC/Price loan calculator.
- PT-BR only, offline-first; no backend or sign-in.
- Freemium: ads for free users; a one-time IAP removes ads and unlocks exports (PDF/XLSX/CSV). The UI uses the store-localized price, with the owner-confirmed fallback from `src/lib/iap.ts` only when the store is unreachable.
- Premium users can also configure a professional brand profile and generate branded PDF reports.
- Ignore automated content/social pipeline and any server/database persistence.

## Product Scope Highlights

- SAC and Price formulas:
  - Price: parcela fixa via fórmula PGTO.
  - SAC: amortização = principal / nº parcelas; juros = saldo anterior × taxa; saldo = saldo anterior – amortização.
- Inputs: principal, taxa (mensal/anual), prazo (meses/anos), data inicial, dia de vencimento.
- Optional: custos/seguros (taxa adm, abertura, seguro, IOF), ajuste de dia útil.
- Optional monetary correction: TR/IPCA inputs and BACEN lookup.
- Outputs: tabela de amortização, resumo (total pago/juros, 1ª/última parcela), gráficos (saldo, parcelas, composição).
- Prepayments: amortizações extras com estratégia reduzir prazo/parcela.
- Comparação SAC vs Price com cards lado a lado.
- Tabs: Calculadora, Comparar, Exportar, Premium, Feedback.

## Structure

- `mobile/` — Expo app source
- `FEATURE_ROADMAP.md` — active future product roadmap
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
- **Premium Components**: `src/components/premium/` contains the professional brand profile form.
- **Utility Functions**: `src/lib/utils.ts` contains:
  - `formatDateBR()` - Brazilian date format (DD/MM/YYYY)
  - `parseLocalDate()` - Accepts both YYYY-MM-DD and DD/MM/YYYY
  - `parseCurrencyInput()` - Brazilian currency parsing
  - `parseNumberInput()` - Brazilian number format (comma decimal)
  - `maskCurrencyInput()` - Live currency formatting with R$ prefix (e.g., "R$ 300.000")

## Tech Stack

- Expo 56, TypeScript, ESLint (flat config)
- Local storage only (no server persistence)

## Dev Commands (run in `mobile/`)

- `npm install`
- `npm run start`
- `npm run android`
- `npm run ios`
- `npm run lint`
- `npx tsc --noEmit`
- `npm test` (vitest)
- `npm run ui:maestro:android` (top-level UI tests)
- `npm run ui:maestro:readback` (export readback UI tests)
- `npm run ui:maestro:all` (full Maestro suite)

## Product Constraints

- Offline-first calculations and scenarios
- No user accounts
- Paid users: PDF/XLSX/CSV export, professional PDF export, no ads
- Free users: ads plus rewarded export unlocks where supported

## Notes

- Use local storage for scenarios, settings, and premium state.
- Keep UI clear and simple with large touch targets.
- IAP SKU: `remove_ads` (iOS + Android).
- IAP fallback price label: `IAP_FALLBACK_PRICE` em `src/lib/iap.ts`.
- IAP não funciona no Expo Go (Store Client); só em builds de desenvolvimento/produção.
- AdMob IDs ficam em `app.config.js` e o banner usa `src/components/AdBanner.tsx`.
- Exportadores em `src/lib/exports/` (CSV/XLSX/PDF) e usam `expo-sharing`.
- Perfil profissional em `src/lib/storage/brand-profile.ts`; nao persistir segredo ou imagem fora do storage local.
- EAS build: `eas.json` presente, `expo-constants` instalado, `react-native-worklets` fixado na versão do SDK.
- Sentry: inicializado em `src/lib/sentry.ts`, ativo só em produção quando `extra.sentryDsn` estiver definido.

## IAP Implementation

- Self-contained: no external API for subscription validation
- Uses `expo-iap` for store integration
- Premium state stored locally in AsyncStorage
- Receipt validation on app launch via `getAvailablePurchases()`
- Revokes premium if no valid entitlement found (handles refunds)
- Platform-specific modal styling (iOS: centered, Android: bottom sheet)

## Responsive Design

- **Breakpoint**: 768px (iPad Mini/iPad portrait)
- **Tablet Layout**: Two-column layout with inputs on left, results on right
- **Mobile Layout**: Single column, optimized for phones
- **Amortization Table**: 4 columns on mobile, 6 columns on tablet (adds Juros + Amort.)
- **Charts**: Side-by-side on tablet, stacked on mobile
- **Container**: Max-width 1400px with increased padding on tablets

## Recent Improvements

- **Date handling**: Fixed timezone issues, proper month overflow, Brazilian format
- **CET calculation**: Uses actual dates for accurate IRR/NPV
- **Dark mode**: Full theme support across all screens
- **Component extraction**: Calculator split into reusable components
- **Accessibility**: Proper labels and roles for screen readers
- **Ad placement**: Reduced to strategic placements and natural breaks
- **iOS Date Picker**: Auto-closes after selection (matches Android behavior)
- **Currency Input Masking**: Live formatting with R$ prefix and thousands separators
- **Enhanced Charts**: Summary stats row, gradient fills, grid lines, value labels
- **Professional PDF**: Branded export with professional profile, client name, and premium gating
- **Responsive Table**: Amortization columns adapt to phone/tablet width
