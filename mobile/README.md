# Calculadora SAC & Price

App Expo (iOS + Android) para simular financiamento com sistemas SAC e Price. Offline-first e sem backend.

## OTA (EAS Update)

Configuracao atual:

- `updates.url` ja aponta para o projeto EAS correto em `app.config.js`.
- `runtimeVersion` usa `policy: "appVersion"`.
- Canais definidos em `eas.json`:
  - `development` -> `development`
  - `preview` -> `preview`
  - `internal` -> `preview`
  - `production` -> `production`

Regras de uso:

- OTA so deve ser usado para mudancas compativeis com o runtime nativo ja instalado.
- Se houver mudanca nativa, plugin novo, remocao/adicao de biblioteca nativa, ou mudanca que exija novo runtime, faca nova build antes de publicar update.
- Com `runtimeVersion: "appVersion"`, publicar OTA para uma build existente exige manter a mesma `expo.version`.

Comandos:

```bash
cd mobile
npm run ota:preview -- --message "Descricao da mudanca"
npm run ota:production -- --message "Descricao da mudanca"
```

Checklist antes de `ota:production`:

1. Confirmar que nao houve mudanca nativa.
2. Rodar testes relevantes.
3. Publicar no canal `preview` primeiro, quando fizer sentido.
4. Fechar e reabrir a build duas vezes para validar que o update foi baixado e aplicado.

## Ads (toggle temporario)

Ads podem ser desativados via config e reativados por OTA:

- Flag: `extra.adsDisabled` em `app.config.js`.
- Comportamento: `src/components/AdBanner.tsx` retorna `null` quando `adsDisabled` e `true`.
- OTA: reativar ads mudando o valor e publicando EAS Update (mesmo runtime).
- Alterar App IDs do AdMob requer novo build nativo.

## In-App Purchase (IAP)

SKU usado no app: `remove_ads` (one-time).

### App Store Connect (iOS)

1. App Store Connect → In-App Purchases → Create.
2. Type: **Non-Consumable** (remover ads + liberar exportacao).
3. Reference Name: algo legivel (ex.: "Remover anuncios").
4. Product ID: `remove_ads` (mesmo do app).
5. Preco: R$ 10,00 (ou tier equivalente).
6. Enviar para revisao com uma build que referencie o SKU.

### Google Play Console (Android)

1. Play Console → Monetize → Products → In-app products.
2. Create product → **Managed product** (one-time).
3. Product ID: `remove_ads` (mesmo do app).
4. Ativar e publicar junto com a release.

## Product Analytics (PostHog)

O app suporta analytics de comportamento via PostHog.

### Configuracao

Defina as variaveis de ambiente antes de build/update:

- `POSTHOG_API_KEY` (obrigatoria para habilitar tracking)
- `POSTHOG_HOST` (opcional, padrao: `https://us.i.posthog.com`)

As chaves sao lidas de `expo.extra` em `app.config.js`.
Sem `POSTHOG_API_KEY`, o tracking fica desativado (no-op).

### Eventos principais instrumentados

- `app_open`
- `app_open_ad_shown`
- `interstitial_shown`
- `export_sheet_opened`
- `export_upgrade_clicked`
- `premium_entry_clicked`
- `scenario_new_started`
- `scenario_saved`
- `scenario_loaded`
- `scenario_deleted`
- `scenario_save_blocked_free_limit`
- `scenario_limit_upgrade_clicked`
- `prepayment_added`
- `prepayment_removed`
- `fgts_added`
- `fgts_removed`
- `export_clicked`
- `export_success`
- `export_failed`
- `export_blocked_premium`
- `professional_export_profile_ready`
- `professional_export_profile_incomplete`
- `professional_export_client_modal_opened`
- `professional_export_client_modal_cancelled`
- `professional_export_started`
- `professional_profile_logo_selected`
- `professional_profile_logo_removed`
- `professional_profile_saved`
- `professional_profile_save_blocked_incomplete`
- `professional_profile_save_failed`
- `rewarded_export_requested`
- `rewarded_export_ad_opened`
- `rewarded_export_ad_reward_earned`
- `rewarded_export_ad_cancelled`
- `rewarded_export_ad_failed`
- `rewarded_export_unlocked`
- `premium_paywall_viewed`
- `premium_status_viewed`
- `premium_status_sync_requested`
- `purchase_started`
- `purchase_success`
- `purchase_failed`
- `purchase_store_unavailable`
- `purchase_restore_started`
- `purchase_restore_success`
- `purchase_restore_empty`
- `purchase_restore_failed`
- `comparison_configuration_updated`
- `feedback_email_clicked`
- `feedback_email_opened`
- `feedback_email_failed`
- `feedback_email_copied`
- `feedback_whatsapp_clicked`
- `feedback_whatsapp_opened`
- `feedback_whatsapp_failed`

### Propriedades mais relevantes

Os eventos principais de cenário, exportação e compra carregam propriedades para análise de uso e monetização:

- `source`
- `format`
- `access`
- `table_only`
- `is_premium`
- `rewarded_available`
- `system`
- `loan_mode`
- `rate_type`
- `term_unit`
- `term_value`
- `term_months`
- `effective_installments`
- `prepayment_count`
- `fgts_event_count`
- `store_connected`
- `store_ready`
- `price_label`
- `professional`
- `professional_client_name`
- `professional_profile_name_or_company`
- `professional_profile_registration`
- `professional_profile_phone`
- `professional_profile_email`
- `professional_profile_website`
- `professional_profile_complete`
- `professional_profile_has_logo`
- `professional_profile_contact_field_count`

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
