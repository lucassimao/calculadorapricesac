# UI Tests (Maestro)

## Requisitos
- App em execução (Expo Go ou build nativo)
- Maestro instalado localmente

## Como rodar
Defina o `APP_ID` conforme o app em execução:
- Expo Go (Android): `host.exp.exponent`
- Dev build (Android/iOS): use o bundle id do app

Exemplo:
```bash
APP_ID=host.exp.exponent maestro test maestro
```

## Observações
- Os testes assumem que o app inicia na aba **Calculadora**.
- Alguns fluxos usam rolagem para alcançar seções abaixo.
