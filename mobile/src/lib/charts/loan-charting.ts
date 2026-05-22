import type { ScheduleRow } from '../../types/loan';
import { formatCurrency } from '../calculations';

export interface ChartLayout {
  width: number;
  height: number;
  verticalPadding: number;
  leftGutter: number;
  rightPadding: number;
}

export interface CompositionBar {
  index: number;
  interest: number;
  amortization: number;
  total: number;
  x: number;
  yBase: number;
  width: number;
  interestHeight: number;
  amortizationHeight: number;
  cornerRadius: number;
}

export function sampleChartData<T>(rows: T[], maxPoints: number) {
  if (rows.length <= maxPoints) return rows;
  if (maxPoints <= 1) return rows.slice(0, 1);

  const lastIndex = rows.length - 1;
  const sampledIndexes = new Set<number>();

  for (let pointIndex = 0; pointIndex < maxPoints; pointIndex += 1) {
    sampledIndexes.add(Math.round((pointIndex * lastIndex) / (maxPoints - 1)));
  }

  return [...sampledIndexes].sort((left, right) => left - right).map((index) => rows[index]);
}

export function createChartLinePath(values: number[], layout: ChartLayout, minZero = false) {
  if (values.length === 0) return '';
  const min = minZero ? 0 : Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const stepX =
    (layout.width - layout.leftGutter - layout.rightPadding) / (values.length - 1 || 1);

  return values
    .map((value, index) => {
      const x = layout.leftGutter + index * stepX;
      const y =
        span === 0
          ? layout.verticalPadding + (layout.height - layout.verticalPadding * 2) / 2
          : layout.verticalPadding +
            (1 - (value - min) / span) * (layout.height - layout.verticalPadding * 2);
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

export function createChartAreaPath(values: number[], layout: ChartLayout, minZero = false) {
  if (values.length === 0) return '';
  const linePath = createChartLinePath(values, layout, minZero);
  const stepX =
    (layout.width - layout.leftGutter - layout.rightPadding) / (values.length - 1 || 1);
  const lastX = layout.leftGutter + (values.length - 1) * stepX;

  return `${linePath} L ${lastX.toFixed(2)} ${layout.height - layout.verticalPadding} L ${
    layout.leftGutter
  } ${layout.height - layout.verticalPadding} Z`;
}

export function formatCompactCurrency(value: number) {
  if (value >= 1000000) {
    return `R$ ${(value / 1000000).toFixed(1)}M`;
  }

  if (value >= 1000) {
    return `R$ ${(value / 1000).toFixed(0)}k`;
  }

  return `R$ ${value.toFixed(0)}`;
}

export function formatChartCurrency(value: number) {
  return formatCurrency(value).replace(',00', '');
}

export function buildCompositionBars(
  rows: ScheduleRow[],
  layout: ChartLayout,
  maxPoints: number,
  barInset = 2,
): CompositionBar[] {
  const data = sampleChartData(rows, maxPoints);
  const totals = data.map((row) => row.interest + row.amortization);
  const maxTotal = Math.max(...totals, 1);
  const barWidth = Math.max(
    (layout.width - layout.leftGutter - layout.rightPadding) / Math.max(data.length, 1),
    8,
  );
  const barHeight = layout.height - layout.verticalPadding * 2;
  const yBase = layout.height - layout.verticalPadding;

  return data.map((row, index) => {
    const interestHeight = (row.interest / maxTotal) * barHeight;
    const amortizationHeight = (row.amortization / maxTotal) * barHeight;
    const width = Math.max(barWidth - barInset * 2, 4);

    return {
      index,
      interest: row.interest,
      amortization: row.amortization,
      total: row.interest + row.amortization,
      x: layout.leftGutter + index * barWidth + barInset,
      yBase,
      width,
      interestHeight,
      amortizationHeight,
      cornerRadius: Math.min(3, width / 4),
    };
  });
}
