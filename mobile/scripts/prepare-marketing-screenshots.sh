#!/usr/bin/env bash
set -euo pipefail

MOBILE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CAPTURE_DIR="$MOBILE_DIR/../marketing/public/recursos/_captures"
RESOURCE_DIR="$MOBILE_DIR/../marketing/public/recursos"

if command -v magick >/dev/null 2>&1; then
  IMAGE_TOOL=(magick)
elif command -v convert >/dev/null 2>&1; then
  IMAGE_TOOL=(convert)
else
  echo 'ImageMagick is required (magick or convert).' >&2
  exit 1
fi

render() {
  local capture="$1"
  local slug="$2"
  local asset="$3"
  local source="$CAPTURE_DIR/$capture.png"
  local target="$RESOURCE_DIR/$slug/$asset.webp"

  if [[ ! -f "$source" ]]; then
    echo "Missing capture: $source" >&2
    exit 1
  fi

  mkdir -p "$RESOURCE_DIR/$slug"
  "${IMAGE_TOOL[@]}" "$source" -strip -quality 80 -define webp:method=6 "$target"

  local size
  size="$(stat -c '%s' "$target")"
  if ((size > 204800)); then
    echo "Asset exceeds 200 KB: $target ($size bytes)" >&2
    exit 1
  fi
}

# Capture sources are produced by maestro/screenshots/01_summary.yaml through
# 14_term_comparison.yaml. Use `npm run screenshots:marketing` to clear stale
# PNGs, run that scoped capture set on Android, and render the assets below.
render comparison simulador-sac-ou-price resumo
render summary-chart simulador-sac-ou-price graficos

render prepayment amortizacao-reduzir-prazo-ou-parcela resumo
render prepayment-summary amortizacao-reduzir-prazo-ou-parcela tabela

render fgts fgts-no-financiamento-simulador resumo
render fgts-summary fgts-no-financiamento-simulador tabela

render cet-summary cet-custo-real-financiamento resumo
render insurance cet-custo-real-financiamento tabela

render index-table financiamento-tr-ou-ipca tabela
render indexed financiamento-tr-ou-ipca graficos

render export exportar-simulacao-pdf-excel tabela
render export-professional exportar-simulacao-pdf-excel resumo

render saved-scenario salvar-e-comparar-cenarios resumo
render saved-comparison salvar-e-comparar-cenarios graficos

render payoff quitar-financiamento-antecipado resumo
render payoff-entry quitar-financiamento-antecipado tabela

render index-table-detail parcela-subiu-saldo-devedor-nao-diminui tabela
render index-summary-short parcela-subiu-saldo-devedor-nao-diminui graficos

render income-inputs renda-para-financiar-imovel resumo
render income renda-para-financiar-imovel graficos

render vehicle-parameters financiamento-de-veiculo-tabela-price resumo
render vehicle-summary financiamento-de-veiculo-tabela-price tabela

render term-360 juros-totais-financiamento-30-anos resumo
render term-240 juros-totais-financiamento-30-anos graficos

render insurance-guide parcela-real-maior-mip-dfi-taxas resumo
render amortize-invest amortizar-financiamento-ou-investir resultado

echo 'Marketing screenshots prepared.'
