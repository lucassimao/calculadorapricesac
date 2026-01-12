# Calculadora SAC & Price

App Expo (iOS + Android) para simular financiamento com sistemas SAC e Price. Offline-first e sem backend.

## Ads (toggle temporario)

Ads podem ser desativados via config e reativados por OTA:

- Flag: `extra.adsDisabled` em `app.config.js`.
- Comportamento: `src/components/AdBanner.tsx` retorna `null` quando `adsDisabled` e `true`.
- OTA: reativar ads mudando o valor e publicando EAS Update (mesmo runtime).
- Alterar App IDs do AdMob requer novo build nativo.

## In-App Purchase (IAP)

SKU usado no app: `remove_ads` (one-time).

### App Store Connect (iOS)

1) App Store Connect → In-App Purchases → Create.
2) Type: **Non-Consumable** (remover ads + liberar exportacao).
3) Reference Name: algo legivel (ex.: "Remover anuncios").
4) Product ID: `remove_ads` (mesmo do app).
5) Preco: R$ 10,00 (ou tier equivalente).
6) Enviar para revisao com uma build que referencie o SKU.

### Google Play Console (Android)

1) Play Console → Monetize → Products → In-app products.
2) Create product → **Managed product** (one-time).
3) Product ID: `remove_ads` (mesmo do app).
4) Ativar e publicar junto com a release.

## Store assets (capas/screenhots)

Ferramenta: `tools/store-assets/` (usa Gemini + screenshots locais).

### App Store

- Tamanho usado: **1284 x 2778** (iPhone 6.5").
- Gemini nao suporta 9:19.5. A geracao e feita em **9:16** (2K) e a imagem final e **padded** para 1284x2778 sem cortar a UI.

### Google Play

- Screenshots: 1080x1920 (9:16), PNG 24-bit sem alpha.
- Feature graphic: **1024 x 500**.

### Comandos

```bash
cd tools/store-assets
npm run start -- --action guide --store appstore --overwrite
npm run start -- --action render --store appstore --slot all --attempts 2 --creative 2 --overwrite
npm run start -- --action render --store play --slot all --attempts 2 --creative 2 --overwrite
npm run start -- --action banner --store play --attempts 2 --overwrite
```
