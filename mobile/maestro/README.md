# UI Tests (Maestro)

## Requisitos

- App rodando no emulador/dispositivo (recomendado: dev build).
- Maestro instalado localmente.
- Emulador Android visivel. Evite headless para esses flows, porque parte da suite depende de rolagem e layout real.

## Emulador recomendado

A suite foi estabilizada no AVD `Small_Phone_360x640`:

- Device: `pixel_2`
- Target: Android 14 / API 34
- System image: `google_apis_playstore/x86_64`

Para criar do zero:

```bash
export ANDROID_HOME="$HOME/ProgrammingTools/Android"

"$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" \
  "platform-tools" \
  "emulator" \
  "platforms;android-34" \
  "system-images;android-34;google_apis_playstore;x86_64"

echo no | "$ANDROID_HOME/cmdline-tools/latest/bin/avdmanager" create avd \
  --name Small_Phone_360x640 \
  --package "system-images;android-34;google_apis_playstore;x86_64" \
  --device "pixel_2"
```

Para iniciar visivel:

```bash
npm run avd:maestro:cold
```

Esse comando usa o AVD visivel com `-gpu swiftshader`, `-no-boot-anim`, `-no-audio`, `-netfast`, `-no-snapshot-load` e `-no-snapshot-save`.

Se `swiftshader` falhar no host local, teste o fallback:

```bash
GPU_MODE=software npm run avd:maestro:cold
```

`-gpu swiftshader_indirect` foi usado antes como workaround para falhas de host GPU/Mesa, mas o modo esta deprecated no emulador atual. Nao use `-no-window`.

Com o emulador aberto, instale o dev build se necessario:

```bash
npm run avd:maestro:prepare
```

O prepare espera o boot, desbloqueia o emulador, desabilita animacoes do Android e instala o dev build se ele ainda nao estiver instalado.

Para acelerar boots repetidos, crie um snapshot depois do prepare:

```bash
npm run avd:maestro:snapshot
```

Depois, inicie pelo snapshot:

```bash
npm run avd:maestro:fast
```

O snapshot acelera o boot do emulador, mas o runner continua limpando os dados do app antes de cada flow com `adb shell pm clear`, entao os testes continuam isolados.

Em outro terminal, inicie o Metro para dev client:

```bash
npx expo start --dev-client --host localhost --port 8081
```

## Como rodar

- Suite principal:
  - `npm run ui:maestro:android`
- Suite de readback/export:
  - `npm run ui:maestro:readback`
- Tudo:
  - `npm run ui:maestro:all`

O runner executa os arquivos `.yaml` em ordem lexicografica e limpa os dados do app antes de cada flow:

```bash
bash scripts/run-maestro-suite.sh all
```

Nao use `maestro test maestro` como comando canonico local em um unico device. Ele pode intercalar flows stateful e produzir falsos negativos. Use o runner sequencial acima.

Os flows usam `appId: com.lsimaocosta.calculadorapricesac`.

## Como criar novos testes

### 1) Estrutura básica do flow

Cada arquivo deve começar com o `appId` e, quando possível, reutilizar o helper de bootstrap:

```yaml
appId: com.lsimaocosta.calculadorapricesac
---
- runFlow: helpers/launch_dev_client.yaml
```

O helper centraliza:

- `killApp`
- `openLink` para o dev client
- waits opcionais do onboarding (`Continue` / `Go home`)
- uma asserção de tela carregada via `id`

A limpeza de estado deve acontecer no runner antes de cada flow. Nao coloque `clearState` no helper de launch: alguns flows reiniciam o app no meio do teste e precisam preservar estado dentro do proprio flow.

### 2) Seletores recomendados

Prefira `testID` em componentes React Native e use `id` no Maestro para se ancorar em elementos estáveis:

```yaml
- assertVisible:
    id: 'input-scenario-name'
- tapOn:
    id: 'btn-seed-export-extras-dev'
```

Use texto ou `accessibilityLabel` apenas quando o elemento for realmente estável e não houver ambiguidade:

- `tapOn: { id: "tab-premium" }`
- `assertVisible: "Exportar Simulação"`

Para rolar até um elemento:

```yaml
- repeat:
    while:
      true: ${output.targetVisible == false}
    times: 8
    commands:
      - swipe:
          start: 50%, 85%
          end: 50%, 35%
      - runFlow:
          when:
            visible:
              id: 'btn-seed-export-extras-dev'
          commands:
            - evalScript: ${output.targetVisible = true}
```

Quando `scrollUntilVisible` ficar instável em listas longas ou fragments, prefira o padrão acima com `repeat + swipe + id`.

### 3) Fluxo com teclado

Inputs podem abrir o teclado e esconder a tab bar. Use `pressKey: Back` antes de tocar em tabs:

```yaml
- pressKey: Back
- tapOn: 'Comparar'
```

### 4) Rolagem confiável

Em telas longas, sempre combine:

- `id` estável no alvo
- `repeat + swipe` para casos mais teimosos
- `scrollUntilVisible` só quando o container responde bem

### 5) Padrões usados neste app

- Bootstrap comum:
  - `helpers/launch_dev_client.yaml`
- Seed de extras para export:
  - `helpers/seed_export_extras_dev.yaml`
- IDs já expostos no app:
  - `input-scenario-name`
  - `input-principal`
  - `input-prepayment-amount`
  - `input-fgts-amount`
  - `btn-add-prepayment`
  - `btn-add-fgts`
  - `btn-seed-export-extras-dev`
- Labels exclusivas das tabs:
  - `tab-calculator`
  - `tab-comparison`
  - `tab-export`
  - `tab-premium`
  - `tab-feedback`

### 6) Criando um novo cenário de teste

Checklist:

1. Abrir app com `killApp` + `openLink`.
2. Garantir navegação correta (tab "Calculadora" ou "Comparar").
3. Preencher inputs via texto/labels + `scrollUntilVisible`.
4. Asserções sempre após rolar até o trecho alvo.
5. Fechar teclado antes de mudar de aba.

### 7) Testes de anúncios em dev

Os flows de anúncios usam o modo stub interno do app para evitar depender do criativo real do AdMob:

- `08_rewarded_export_success_stub.yaml`
- `09_rewarded_export_cancel_stub.yaml`
- `10_rewarded_export_error_stub.yaml`
- `11_interstitial_stub.yaml`
- `12_app_open_stub.yaml`
- `13_premium_bypass_ads.yaml`
- `14_premium_skips_ad_gates.yaml`
- `15_premium_feedback_whatsapp.yaml`
- `16_app_open_warm_resume_no_show.yaml`
- `17_free_feedback_upsell.yaml`
- `18_tr_ipca_correction.yaml`

Ative os toggles de dev na aba `Premium`:

- `Ativar ads stub (dev)`
- `Ativar interstitial stub (dev)`
- `Ativar app open stub (dev)`

## Dicas para depuração

- Os artifacts ficam em `~/.maestro/tests/<timestamp>/`.
- Se falhar, verifique o screenshot e ajuste o texto alvo.
- Se o elemento estiver fora da tela, adicione `scrollUntilVisible`.
