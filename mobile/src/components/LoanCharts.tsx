import { useMemo, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, G, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import type { ScheduleRow } from '../types/loan';
import { useTheme } from '../lib/theme';
import { formatCurrency } from '../lib/calculations';

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

const createAreaPath = (
  values: number[],
  width: number,
  height: number,
  padding: number,
  minZero = false
) => {
  if (values.length === 0) return '';
  const linePath = createLinePath(values, width, height, padding, minZero);
  const stepX = (width - padding * 2) / (values.length - 1 || 1);
  const lastX = padding + (values.length - 1) * stepX;
  return `${linePath} L ${lastX} ${height - padding} L ${padding} ${height - padding} Z`;
};

const formatCompactCurrency = (value: number): string => {
  if (value >= 1000000) {
    return `R$ ${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `R$ ${(value / 1000).toFixed(0)}k`;
  }
  return `R$ ${value.toFixed(0)}`;
};

export function LoanCharts({ schedule }: LoanChartsProps) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [containerWidth, setContainerWidth] = useState(0);
  const isTablet = width >= 768;
  const availableWidth = containerWidth || Math.max(width - 64, 320);
  const gridGap = 12;
  const halfBlockWidth = isTablet ? (availableWidth - gridGap) / 2 : availableWidth;
  const fullBlockWidth = availableWidth;
  const chartWidthHalf = Math.max(halfBlockWidth - 24, 240);
  const chartWidthFull = Math.max(fullBlockWidth - 24, 240);
  const chartHeight = isTablet ? 200 : 160;
  const padding = 24;

  const data = useMemo(() => {
    const rows = schedule.filter((row) => row.installmentNumber > 0);
    return sampleData(rows, 60);
  }, [schedule]);

  const balanceValues = useMemo(() => data.map((row) => row.balance), [data]);
  const paymentValues = useMemo(() => data.map((row) => row.payment), [data]);

  const balancePath = useMemo(
    () => createLinePath(balanceValues, chartWidthHalf, chartHeight, padding, true),
    [balanceValues, chartWidthHalf, chartHeight]
  );

  const balanceAreaPath = useMemo(
    () => createAreaPath(balanceValues, chartWidthHalf, chartHeight, padding, true),
    [balanceValues, chartWidthHalf, chartHeight]
  );

  const paymentPath = useMemo(
    () => createLinePath(paymentValues, chartWidthHalf, chartHeight, padding, true),
    [paymentValues, chartWidthHalf, chartHeight]
  );

  const paymentAreaPath = useMemo(
    () => createAreaPath(paymentValues, chartWidthHalf, chartHeight, padding, true),
    [paymentValues, chartWidthHalf, chartHeight]
  );

  const barData = useMemo(() => {
    const rows = sampleData(schedule.filter((row) => row.installmentNumber > 0), 20);
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

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    const rows = schedule.filter((row) => row.installmentNumber > 0);
    if (rows.length === 0) return null;
    const totalInterest = rows.reduce((sum, row) => sum + row.interest, 0);
    const totalAmortization = rows.reduce((sum, row) => sum + row.amortization, 0);
    const totalPaid = totalInterest + totalAmortization;
    const firstPayment = rows[0]?.payment ?? 0;
    const lastPayment = rows[rows.length - 1]?.payment ?? 0;
    const interestPercent = totalPaid > 0 ? (totalInterest / totalPaid) * 100 : 0;
    return { totalInterest, totalAmortization, totalPaid, firstPayment, lastPayment, interestPercent };
  }, [schedule]);

  const barWidth = Math.max((chartWidthFull - padding * 2) / Math.max(barData.length, 1), 8);

  // Dynamic themed styles
  const themedStyles = useMemo(() => ({
    title: { color: colors.text },
    chartBlock: { backgroundColor: colors.backgroundSecondary, borderColor: colors.border },
    chartLabel: { color: colors.text },
    chartSubtitle: { color: colors.textTertiary },
    legendText: { color: colors.textSecondary },
    statValue: { color: colors.text },
    statLabel: { color: colors.textTertiary },
  }), [colors]);

  const gridLineColor = colors.border;
  const gridLines = [0, 0.25, 0.5, 0.75, 1];

  return (
    <View
      style={styles.container}
      onLayout={(event) => setContainerWidth(event.nativeEvent.layout.width)}
    >
      <Text style={[styles.title, themedStyles.title]}>Gráficos</Text>

      {/* Summary Stats Row */}
      {summaryStats && (
        <View style={[styles.statsRow, isTablet && styles.statsRowTablet]}>
          <View style={[styles.statCard, isTablet ? styles.statCardTablet : styles.statCardMobile, themedStyles.chartBlock]}>
            <Text style={[styles.statValue, themedStyles.statValue]}>
              {formatCurrency(summaryStats.totalPaid)}
            </Text>
            <Text style={[styles.statLabel, themedStyles.statLabel]}>Total Pago</Text>
          </View>
          <View style={[styles.statCard, isTablet ? styles.statCardTablet : styles.statCardMobile, themedStyles.chartBlock]}>
            <Text style={[styles.statValue, themedStyles.statValue, { color: colors.chartBar1 }]}>
              {formatCurrency(summaryStats.totalInterest)}
            </Text>
            <Text style={[styles.statLabel, themedStyles.statLabel]}>Total Juros ({summaryStats.interestPercent.toFixed(1)}%)</Text>
          </View>
          <View style={[styles.statCard, isTablet ? styles.statCardTablet : styles.statCardMobile, themedStyles.chartBlock]}>
            <Text style={[styles.statValue, themedStyles.statValue]}>
              {formatCurrency(summaryStats.firstPayment)}
            </Text>
            <Text style={[styles.statLabel, themedStyles.statLabel]}>1ª Parcela</Text>
          </View>
          <View style={[styles.statCard, isTablet ? styles.statCardTablet : styles.statCardMobile, themedStyles.chartBlock]}>
            <Text style={[styles.statValue, themedStyles.statValue]}>
              {formatCurrency(summaryStats.lastPayment)}
            </Text>
            <Text style={[styles.statLabel, themedStyles.statLabel]}>Última Parcela</Text>
          </View>
        </View>
      )}

      <View style={[styles.chartGrid, isTablet && styles.chartGridTablet]}>
        {/* Balance Chart */}
        <View
          style={[styles.chartBlock, themedStyles.chartBlock, isTablet && styles.chartBlockHalf]}
          accessibilityRole="image"
          accessibilityLabel="Gráfico de saldo devedor"
        >
          <View style={styles.chartHeader}>
            <Text style={[styles.chartLabel, themedStyles.chartLabel]}>Saldo Devedor</Text>
            {balanceValues.length > 0 && (
              <Text style={[styles.chartValue, { color: colors.chartLine2 }]}>
                {formatCompactCurrency(balanceValues[0])} → {formatCompactCurrency(balanceValues[balanceValues.length - 1])}
              </Text>
            )}
          </View>
          <Svg width={chartWidthHalf} height={chartHeight}>
            <Defs>
              <LinearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={colors.chartLine2} stopOpacity="0.3" />
                <Stop offset="100%" stopColor={colors.chartLine2} stopOpacity="0.05" />
              </LinearGradient>
            </Defs>
            {/* Grid lines */}
            {gridLines.map((ratio) => (
              <Line
                key={ratio}
                x1={padding}
                y1={padding + ratio * (chartHeight - padding * 2)}
                x2={chartWidthHalf - padding}
                y2={padding + ratio * (chartHeight - padding * 2)}
                stroke={gridLineColor}
                strokeWidth={0.5}
                strokeDasharray="4,4"
              />
            ))}
            {/* Area fill */}
            <Path d={balanceAreaPath} fill="url(#balanceGradient)" />
            {/* Line */}
            <Path d={balancePath} stroke={colors.chartLine2} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            {/* Y-axis labels */}
            {balanceValues.length > 0 && (
              <>
                <SvgText x={padding - 4} y={padding + 4} fontSize={9} fill={colors.textTertiary} textAnchor="end">
                  {formatCompactCurrency(Math.max(...balanceValues))}
                </SvgText>
                <SvgText x={padding - 4} y={chartHeight - padding} fontSize={9} fill={colors.textTertiary} textAnchor="end">
                  R$ 0
                </SvgText>
              </>
            )}
          </Svg>
        </View>

        {/* Payment Chart */}
        <View
          style={[styles.chartBlock, themedStyles.chartBlock, isTablet && styles.chartBlockHalf]}
          accessibilityRole="image"
          accessibilityLabel="Gráfico das parcelas"
        >
          <View style={styles.chartHeader}>
            <Text style={[styles.chartLabel, themedStyles.chartLabel]}>Parcelas</Text>
            {paymentValues.length > 0 && (
              <Text style={[styles.chartValue, { color: colors.chartLine1 }]}>
                {formatCompactCurrency(paymentValues[0])} → {formatCompactCurrency(paymentValues[paymentValues.length - 1])}
              </Text>
            )}
          </View>
          <Svg width={chartWidthHalf} height={chartHeight}>
            <Defs>
              <LinearGradient id="paymentGradient" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={colors.chartLine1} stopOpacity="0.3" />
                <Stop offset="100%" stopColor={colors.chartLine1} stopOpacity="0.05" />
              </LinearGradient>
            </Defs>
            {/* Grid lines */}
            {gridLines.map((ratio) => (
              <Line
                key={ratio}
                x1={padding}
                y1={padding + ratio * (chartHeight - padding * 2)}
                x2={chartWidthHalf - padding}
                y2={padding + ratio * (chartHeight - padding * 2)}
                stroke={gridLineColor}
                strokeWidth={0.5}
                strokeDasharray="4,4"
              />
            ))}
            {/* Area fill */}
            <Path d={paymentAreaPath} fill="url(#paymentGradient)" />
            {/* Line */}
            <Path d={paymentPath} stroke={colors.chartLine1} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            {/* Y-axis labels */}
            {paymentValues.length > 0 && (
              <>
                <SvgText x={padding - 4} y={padding + 4} fontSize={9} fill={colors.textTertiary} textAnchor="end">
                  {formatCompactCurrency(Math.max(...paymentValues))}
                </SvgText>
                <SvgText x={padding - 4} y={chartHeight - padding} fontSize={9} fill={colors.textTertiary} textAnchor="end">
                  {formatCompactCurrency(Math.min(...paymentValues))}
                </SvgText>
              </>
            )}
          </Svg>
        </View>

        {/* Interest vs Amortization Chart */}
        <View
          style={[styles.chartBlock, themedStyles.chartBlock, isTablet && styles.chartBlockFull]}
          accessibilityRole="image"
          accessibilityLabel="Gráfico de juros versus amortização"
        >
          <View style={styles.chartHeader}>
            <Text style={[styles.chartLabel, themedStyles.chartLabel]}>Composição das Parcelas</Text>
          </View>
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: colors.chartBar1 }]} />
              <Text style={[styles.legendText, themedStyles.legendText]}>Juros</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: colors.chartBar2 }]} />
              <Text style={[styles.legendText, themedStyles.legendText]}>Amortização</Text>
            </View>
          </View>
          <Svg width={chartWidthFull} height={chartHeight}>
            {/* Grid lines */}
            {gridLines.map((ratio) => (
              <Line
                key={ratio}
                x1={padding}
                y1={padding + ratio * (chartHeight - padding * 2)}
                x2={chartWidthFull - padding}
                y2={padding + ratio * (chartHeight - padding * 2)}
                stroke={gridLineColor}
                strokeWidth={0.5}
                strokeDasharray="4,4"
              />
            ))}
            {barData.map((row) => {
              const barH = chartHeight - padding * 2;
              const interestHeight = (row.interest / row.maxTotal) * barH;
              const amortHeight = (row.amortization / row.maxTotal) * barH;
              const x = padding + row.index * barWidth + 2;
              const yBase = chartHeight - padding;
              const cornerRadius = Math.min(3, (barWidth - 4) / 4);
              return (
                <G key={row.index}>
                  {/* Interest bar (bottom) */}
                  <Rect
                    x={x}
                    y={yBase - interestHeight - amortHeight}
                    width={Math.max(barWidth - 4, 4)}
                    height={interestHeight}
                    fill={colors.chartBar1}
                    rx={cornerRadius}
                    ry={cornerRadius}
                  />
                  {/* Amortization bar (top) */}
                  <Rect
                    x={x}
                    y={yBase - amortHeight}
                    width={Math.max(barWidth - 4, 4)}
                    height={amortHeight}
                    fill={colors.chartBar2}
                    rx={cornerRadius}
                    ry={cornerRadius}
                  />
                </G>
              );
            })}
            {/* X-axis labels */}
            <SvgText x={padding} y={chartHeight - 4} fontSize={9} fill={colors.textTertiary}>
              Início
            </SvgText>
            <SvgText x={chartWidthFull - padding} y={chartHeight - 4} fontSize={9} fill={colors.textTertiary} textAnchor="end">
              Fim
            </SvgText>
          </Svg>
          <Text style={[styles.chartSubtitle, themedStyles.chartSubtitle]}>
            No início, maior parte da parcela são juros. Com o tempo, a amortização domina.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statsRowTablet: {
    // On tablet, use a 2x2 grid layout to prevent overflow
    flexWrap: 'wrap',
  },
  statCard: {
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
  },
  statCardMobile: {
    flex: 1,
    minWidth: '45%',
  },
  statCardTablet: {
    width: '48%',
    flexGrow: 1,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  chartBlock: {
    borderRadius: 12,
    padding: 14,
    width: '100%',
    borderWidth: 1,
  },
  chartGrid: {
    gap: 12,
  },
  chartGridTablet: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  chartBlockHalf: {
    width: '48%',
  },
  chartBlockFull: {
    width: '100%',
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  chartLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  chartValue: {
    fontSize: 12,
    fontWeight: '500',
  },
  chartSubtitle: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 16,
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
    borderRadius: 3,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
