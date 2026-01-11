import { useMemo } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { G, Path, Rect } from 'react-native-svg';
import type { ScheduleRow } from '../types/loan';

interface LoanChartsProps {
  schedule: ScheduleRow[];
}

const sampleData = (rows: ScheduleRow[], maxPoints: number) => {
  if (rows.length <= maxPoints) return rows;
  const step = Math.ceil(rows.length / maxPoints);
  return rows.filter((_, index) => index % step === 0);
};

const createLinePath = (
  values: number[],
  width: number,
  height: number,
  padding: number,
  minZero = false
) => {
  if (values.length === 0) return '';
  const min = minZero ? 0 : Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const stepX = (width - padding * 2) / (values.length - 1 || 1);
  return values
    .map((value, index) => {
      const x = padding + index * stepX;
      const y =
        span === 0
          ? padding + (height - padding * 2) / 2
          : padding + (1 - (value - min) / span) * (height - padding * 2);
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');
};

export function LoanCharts({ schedule }: LoanChartsProps) {
  const { width } = useWindowDimensions();
  const chartWidth = Math.min(width - 64, 400);
  const chartHeight = 160;
  const padding = 10;

  const data = useMemo(() => {
    const rows = schedule.filter((row) => row.installmentNumber > 0);
    return sampleData(rows, 60);
  }, [schedule]);

  const balancePath = useMemo(
    () => createLinePath(data.map((row) => row.balance), chartWidth, chartHeight, padding, true),
    [data, chartWidth, chartHeight]
  );

  const paymentPath = useMemo(
    () => createLinePath(data.map((row) => row.payment), chartWidth, chartHeight, padding, true),
    [data, chartWidth, chartHeight]
  );

  const barData = useMemo(() => {
    const rows = sampleData(schedule.filter((row) => row.installmentNumber > 0), 24);
    const totals = rows.map((row) => row.interest + row.amortization);
    const maxTotal = Math.max(...totals, 1);
    return rows.map((row, index) => ({
      index,
      interest: row.interest,
      amortization: row.amortization,
      total: row.interest + row.amortization,
      maxTotal,
    }));
  }, [schedule]);

  const barWidth = chartWidth / Math.max(barData.length, 1);
  const trendThreshold = 0.05;
  const getTrendSubtitle = (values: number[], stableText: string, downText: string, upText: string) => {
    if (values.length < 2) return 'Sem dados suficientes para interpretar.';
    const first = values[0];
    const last = values[values.length - 1];
    if (first === 0) return stableText;
    const change = (last - first) / Math.abs(first);
    if (change <= -trendThreshold) return downText;
    if (change >= trendThreshold) return upText;
    return stableText;
  };

  const balanceSubtitle = useMemo(
    () =>
      getTrendSubtitle(
        data.map((row) => row.balance),
        'Saldo permanece estável, sem quedas relevantes.',
        'Saldo cai de forma consistente à medida que o principal é amortizado.',
        'Saldo cresce ao longo do tempo; revise prazo e taxa.'
      ),
    [data]
  );

  const paymentSubtitle = useMemo(
    () =>
      getTrendSubtitle(
        data.map((row) => row.payment),
        'Parcelas ficam estáveis ao longo do prazo.',
        'Parcelas tendem a cair conforme os juros diminuem.',
        'Parcelas sobem ao longo do tempo.'
      ),
    [data]
  );

  const compositionSubtitle = useMemo(() => {
    const rows = schedule.filter((row) => row.installmentNumber > 0);
    if (rows.length < 2) return 'Sem dados suficientes para interpretar.';
    const first = rows[0];
    const last = rows[rows.length - 1];
    const firstTotal = first.interest + first.amortization || 1;
    const lastTotal = last.interest + last.amortization || 1;
    const firstInterestShare = first.interest / firstTotal;
    const lastInterestShare = last.interest / lastTotal;
    if (lastInterestShare < firstInterestShare - 0.05) {
      return 'Juros perdem peso e a amortização ganha participação com o tempo.';
    }
    if (lastInterestShare > firstInterestShare + 0.05) {
      return 'Juros ganham participação ao longo do prazo.';
    }
    return 'Composição entre juros e amortização se mantém estável.';
  }, [schedule]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Gráficos</Text>

      <View style={styles.chartBlock} accessibilityRole="image" accessibilityLabel="Gráfico de saldo devedor">
        <Text style={styles.chartLabel}>Saldo Devedor</Text>
        <Svg width={chartWidth} height={chartHeight}>
          <Path d={balancePath} stroke="#EF4444" strokeWidth={2} fill="none" />
        </Svg>
        <Text style={styles.chartSubtitle}>{balanceSubtitle}</Text>
      </View>

      <View style={styles.chartBlock} accessibilityRole="image" accessibilityLabel="Gráfico das parcelas">
        <Text style={styles.chartLabel}>Parcelas</Text>
        <Svg width={chartWidth} height={chartHeight}>
          <Path d={paymentPath} stroke="#2563EB" strokeWidth={2} fill="none" />
        </Svg>
        <Text style={styles.chartSubtitle}>{paymentSubtitle}</Text>
      </View>

      <View style={styles.chartBlock} accessibilityRole="image" accessibilityLabel="Gráfico de juros versus amortização">
        <Text style={styles.chartLabel}>Juros vs Amortização</Text>
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#F97316' }]} />
            <Text style={styles.legendText}>Juros</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#22C55E' }]} />
            <Text style={styles.legendText}>Amortização</Text>
          </View>
        </View>
        <Svg width={chartWidth} height={chartHeight}>
          {barData.map((row) => {
            const totalHeight = (row.total / row.maxTotal) * (chartHeight - padding * 2);
            const interestHeight = (row.interest / row.maxTotal) * (chartHeight - padding * 2);
            const amortHeight = (row.amortization / row.maxTotal) * (chartHeight - padding * 2);
            const x = row.index * barWidth + padding / 2;
            const yBase = chartHeight - padding;
            return (
              <G key={row.index}>
                <Rect
                  x={x}
                  y={yBase - totalHeight}
                  width={barWidth - 4}
                  height={interestHeight}
                  fill="#F97316"
                />
                <Rect
                  x={x}
                  y={yBase - totalHeight + interestHeight}
                  width={barWidth - 4}
                  height={amortHeight}
                  fill="#22C55E"
                />
              </G>
            );
          })}
        </Svg>
        <Text style={styles.chartSubtitle}>{compositionSubtitle}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  chartBlock: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
  },
  chartLabel: {
    fontSize: 13,
    color: '#374151',
    marginBottom: 8,
  },
  chartSubtitle: {
    marginTop: 8,
    fontSize: 12,
    color: '#6B7280',
  },
  legend: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 12,
    color: '#6B7280',
  },
});
