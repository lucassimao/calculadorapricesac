# UI Tests (Maestro)

## Requisitos
- App rodando no emulador/dispositivo (recomendado: dev build).
- Maestro instalado localmente.

## Como rodar
- Android:
  - `npm run ui:maestro:android`

Os flows usam `appId: com.lsimaocosta.calculadorapricesac`.

## Como criar novos testes
### 1) Estrutura básica do flow
Cada arquivo deve começar com o `appId` e lançar o app:
```yaml
appId: com.lsimaocosta.calculadorapricesac
---
- launchApp
```

### 2) Seletores recomendados
Use texto visível ou `accessibilityLabel` sempre que possível:
- `tapOn: "Valor do financiamento"`
- `assertVisible: "Resumo"`

Para rolar até um elemento:
```yaml
- scrollUntilVisible:
    element:
      text: "Resumo"
    centerElement: true
    visibilityPercentage: 10
```

Evite depender de `testID` para Android (nem sempre expõe `resource-id` no build),
exceto quando você já validou no `maestro` que o id aparece.

### 3) Fluxo com teclado
Inputs podem abrir o teclado e esconder a tab bar. Use `pressKey: Back` antes de tocar em tabs:
```yaml
- pressKey: Back
- tapOn: "Comparar"
```

### 4) Rolagem confiável
Em telas longas, sempre combine:
- `scrollUntilVisible` + `centerElement: true`
- `visibilityPercentage: 10` (ou menor se necessário)

### 5) Padrões usados neste app
- Preferir labels textuais dos campos:
  - "Valor do financiamento", "Taxa de juros", "Prazo", "Dia de vencimento"
- Para seções, usar o título visível:
  - "Parâmetros", "Resumo", "Amortizações Extras", "FGTS", "Exportar"

### 6) Criando um novo cenário de teste
Checklist:
1. Abrir app com `launchApp`.
2. Garantir navegação correta (tab "Calculadora" ou "Comparar").
3. Preencher inputs via texto/labels + `scrollUntilVisible`.
4. Asserções sempre após rolar até o trecho alvo.
5. Fechar teclado antes de mudar de aba.

## Dicas para depuração
- Os artifacts ficam em `~/.maestro/tests/<timestamp>/`.
- Se falhar, verifique o screenshot e ajuste o texto alvo.
- Se o elemento estiver fora da tela, adicione `scrollUntilVisible`.
