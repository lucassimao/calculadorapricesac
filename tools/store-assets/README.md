# Store Assets (TS)

CLI em TypeScript para gerar assets de loja com Gemini:
- **Capas** (com screenshot embutida)
- **Feature banner**
- **Ícones**

Tudo em PT‑BR, sem i18n.

## Setup

1) Instale dependências:
```bash
cd tools/store-assets
npm install
```

2) Configure a chave:
```bash
export GEMINI_API_KEY="..."
```

3) Coloque os arquivos:
- Capturas (uma por slot, sem pasta de device):
  - `tools/store-assets/screenshots/pt-BR/{slot}.png`
- Frames (opcional):
  - `tools/store-assets/frames/iphone11.png`
  - `tools/store-assets/frames/pixel8pro.png`

Edite o copy em `tools/store-assets/store-copy/pt-BR.json` (capas). O banner gera texto livre no prompt.

## Comandos

Gerar capas (App Store + Play):
```bash
npm run start -- --action render --store all --slot all --attempts 2 --creative 2
```

Gerar guide/mask:
```bash
npm run start -- --action guide
```

Gerar feature graphic do Play (via Gemini, sem base):
```bash
npm run start -- --action banner --store all
```

Gerar ícones (via Gemini, sem base):
```bash
npm run start -- --action icon --store all
```
Gera `icon_try1.png`, `icon_try2.png`, etc em `tools/store-assets/.local/store-assets/icons/`.

## Saídas

`tools/store-assets/.local/store-assets/{store}/pt-BR/`

Play Feature Graphic sai em `tools/store-assets/.local/store-assets/play/pt-BR/banner.png`.

## Configuração

Arquivo `tools/store-assets/config.json`:
- `stores`: tamanhos finais de App Store/Play (capas).
- `banners`: tamanhos do banner por loja.
- `icons`: tamanhos do ícone por loja.
- `layout`: área de texto e screenshot na capa.
- `models`: gemini model + aspect/size.

## Notas

- O fluxo gera `guide`/`mask` e usa a captura pré‑composta (screenshot embutida).
- O Gemini recebe prompt + screenshot + guide (+ frame opcional).
- Ajuste tamanhos/slots conforme necessário.
