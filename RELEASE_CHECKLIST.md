# Checklist de Release (iOS + Android)

Este documento reúne os passos necessários antes de publicar a Calculadora Price & SAC.

## 1) Contas e serviços de terceiros
- **Apple Developer Program** ativo.
- **Google Play Console** ativo.
- **Google AdMob** (ads):
  - Criar o app iOS e Android no AdMob.
  - Gerar **App IDs** (iOS/Android) e **Ad Unit IDs** (banner).
  - Substituir IDs de teste.
- **In‑App Purchase** (remover anúncios):
  - Criar o produto **não‑consumível** com SKU `remove_ads` em **App Store Connect** e **Play Console**.
  - Definir preço **R$ 10,00** (one‑time).
  - IAP não funciona no Expo Go; testar em build instalada.

## 2) IDs e configurações no projeto
### AdMob (obrigatório para release)
Trocar IDs de teste em:
- `app.json`:
  - `plugins -> react-native-google-mobile-ads -> iosAppId / androidAppId`
- `src/components/AdBanner.tsx`:
  - Substituir o `unitId` de teste por um **Ad Unit ID** real (banner).

### IAP (obrigatório para release)
SKU já usado no app:
- iOS: `remove_ads`
- Android: `remove_ads`

Confirme que o SKU publicado nas lojas corresponde a esse identificador.

## 3) Variáveis de ambiente
Atualmente **não há variáveis de ambiente obrigatórias**; os IDs estão hardcoded.

Se quiser parametrizar:
- Criar `app.config.js` e usar `process.env.EXPO_PUBLIC_*`.
Exemplo de nomes sugeridos:
- `EXPO_PUBLIC_ADMOB_ANDROID_APP_ID`
- `EXPO_PUBLIC_ADMOB_IOS_APP_ID`
- `EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID`
- `EXPO_PUBLIC_SENTRY_DSN`

Depois, ler essas variáveis no `app.config.js` e no `AdBanner.tsx`.
Para Sentry, ler em `app.config.js` e expor como `extra.sentryDsn`.

## 4) Versão, ícones e assets
- Atualizar `expo.version` (semver) em `app.json`.
- Garantir ícones/splash em `assets/` com dimensões corretas.
- Conferir nome e slug do app.
- Confirmar `android.package` em `app.json` (ex.: `com.lsimaocosta.calculadorapricesac`).

## 5) Qualidade e validações
Rodar antes do build:
- `npm run lint`
- `npx tsc --noEmit`
- `npm test`

Conferir:
- Cálculos (Price/SAC + amortizações extras).
- Exportação (PDF/XLSX/CSV) apenas para premium.
- Ads exibindo em telas gratuitas.
- Feedback: tab abre cliente de email com `lucas@lucassimao.com`.
- Sentry: garantir DSN em `extra.sentryDsn` e confirmar coleta em produção.

## 6) Build e publicação
Se usar EAS:
- Configurar `eas.json` (produção).
- Rodar builds de produção para iOS/Android.

Submissão:
- **iOS**: App Store Connect (metadata, screenshots, compliance).
- **Android**: Play Console (metadata, políticas, Data Safety).

## 7) EAS Build (setup obrigatório)
- Projeto EAS vinculado (ver `extra.eas.projectId` no `app.json`).
- Chaves Android geradas no EAS (keystore remoto).
- `react-dom` travado em `19.1.0` para evitar conflito de peer deps no build local.
- `expo-constants` instalado (peer dependency do `expo-router`).
- `react-native-worklets` na versão compatível do SDK 54 (`0.5.1`).
- **Sem** `googleMobileAdsAppId` em `expo.ios` e `expo.android` (o schema do Expo não aceita).
- Build local: `eas build -p android --local`
- Build remoto: `eas build -p android` / `eas build -p ios`

## 8) Políticas e compliance
- **Privacidade**: publicar política de privacidade (ads + compra).
- **Data Safety (Play)**: declarar coleta/uso (ads + diagnóstico).
- **App Privacy (iOS)**: declarar dados usados para ads e analytics (se aplicável).

---

### Observação sobre o warning do AdMob
Durante o build, o `react-native-google-mobile-ads` pode avisar sobre `android_app_id` fora do schema.
Como usamos o **Expo config plugin**, esse warning pode ser ignorado.

### Pontos críticos antes do go‑live
- IDs reais de AdMob no plugin do `app.json`.
- Ad Unit ID real no `AdBanner.tsx`.
- SKU `remove_ads` criado e aprovado nas duas lojas.
- Versão atualizada e builds testados.
