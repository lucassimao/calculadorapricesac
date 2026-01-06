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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Gráficos</Text>

      <View style={styles.chartBlock} accessibilityRole="image" accessibilityLabel="Gráfico de saldo devedor">
        <Text style={styles.chartLabel}>Saldo Devedor</Text>
        <Svg width={chartWidth} height={chartHeight}>
          <Path d={balancePath} stroke="#EF4444" strokeWidth={2} fill="none" />
        </Svg>
      </View>

      <View style={styles.chartBlock} accessibilityRole="image" accessibilityLabel="Gráfico das parcelas">
        <Text style={styles.chartLabel}>Parcelas</Text>
        <Svg width={chartWidth} height={chartHeight}>
          <Path d={paymentPath} stroke="#2563EB" strokeWidth={2} fill="none" />
        </Svg>
      </View>

      <View style={styles.chartBlock} accessibilityRole="image" accessibilityLabel="Gráfico de juros versus amortização">
        <Text style={styles.chartLabel}>Juros vs Amortização</Text>
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
});
