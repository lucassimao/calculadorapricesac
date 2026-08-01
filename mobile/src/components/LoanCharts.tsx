import { useMemo, useState, type RefObject } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, {
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import type { ScheduleRow } from '@loan-engine/loan';
import { useTheme } from '../lib/theme';
import { formatCurrency } from '@loan-engine/calculations';
import {
  buildCompositionBars,
  createChartAreaPath,
  createChartLinePath,
  formatChartCurrency,
  formatCompactCurrency,
  sampleChartData,
  type ChartLayout,
} from '../lib/charts/loan-charting';

interface LoanChartsProps {
  schedule: ScheduleRow[];
  visibilityRefs?: {
    balance: RefObject<View | null>;
    payment: RefObject<View | null>;
    composition: RefObject<View | null>;
  };
}

export function LoanCharts({ schedule, visibilityRefs }: LoanChartsProps) {
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
  const verticalPadding = 24;
  const leftGutter = 58;
  const rightPadding = 24;
  const halfLayout: ChartLayout = useMemo(
    () => ({
      width: chartWidthHalf,
      height: chartHeight,
      verticalPadding,
      leftGutter,
      rightPadding,
    }),
    [chartWidthHalf, chartHeight],
  );
  const fullLayout: ChartLayout = useMemo(
    () => ({
      width: chartWidthFull,
      height: chartHeight,
      verticalPadding,
      leftGutter,
      rightPadding,
    }),
    [chartWidthFull, chartHeight],
  );

  const data = useMemo(() => {
    const rows = schedule.filter((row) => row.installmentNumber > 0);
    return sampleChartData(rows, 60);
  }, [schedule]);

  const balanceValues = useMemo(() => data.map((row) => row.balance), [data]);
  const paymentValues = useMemo(() => data.map((row) => row.payment), [data]);

  const balancePath = useMemo(
    () => createChartLinePath(balanceValues, halfLayout, true),
    [balanceValues, halfLayout],
  );

  const balanceAreaPath = useMemo(
    () => createChartAreaPath(balanceValues, halfLayout, true),
    [balanceValues, halfLayout],
  );

  const paymentPath = useMemo(
    () => createChartLinePath(paymentValues, halfLayout, true),
    [paymentValues, halfLayout],
  );

  const paymentAreaPath = useMemo(
    () => createChartAreaPath(paymentValues, halfLayout, true),
    [paymentValues, halfLayout],
  );

  const barData = useMemo(() => {
    const rows = schedule.filter((row) => row.installmentNumber > 0);
    return buildCompositionBars(rows, fullLayout, 20);
  }, [schedule, fullLayout]);

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    const rows = schedule.filter((row) => row.installmentNumber > 0);
    if (rows.length === 0) return null;
    const totalInterest = rows.reduce((sum, row) => sum + row.interest, 0);
    const totalPaid = rows.reduce((sum, row) => sum + row.payment, 0);
    const firstPayment = rows[0]?.payment ?? 0;
    const lastPayment = rows[rows.length - 1]?.payment ?? 0;
    const interestPercent = totalPaid > 0 ? (totalInterest / totalPaid) * 100 : 0;
    return {
      totalInterest,
      totalPaid,
      firstPayment,
      lastPayment,
      interestPercent,
    };
  }, [schedule]);

  // Dynamic themed styles
  const themedStyles = useMemo(
    () => ({
      title: { color: colors.text },
      chartBlock: { backgroundColor: colors.backgroundSecondary, borderColor: colors.border },
      chartLabel: { color: colors.text },
      chartSubtitle: { color: colors.textTertiary },
      legendText: { color: colors.textSecondary },
      statValue: { color: colors.text },
      statLabel: { color: colors.textTertiary },
    }),
    [colors],
  );

  const gridLineColor = colors.border;
  const gridLines = [0, 0.25, 0.5, 0.75, 1];

  return (
    <View
      style={styles.container}
      onLayout={(event) => setContainerWidth(event.nativeEvent.layout.width)}
      testID="section-charts"
    >
      <Text style={[styles.title, themedStyles.title]} testID="section-charts-title">
        Gráficos
      </Text>

      {/* Summary Stats Row */}
      {summaryStats && (
        <View style={[styles.statsRow, isTablet && styles.statsRowTablet]}>
          <View
            style={[
              styles.statCard,
              isTablet ? styles.statCardTablet : styles.statCardMobile,
              themedStyles.chartBlock,
            ]}
          >
            <Text style={[styles.statValue, themedStyles.statValue]}>
              {formatCurrency(summaryStats.totalPaid)}
            </Text>
            <Text style={[styles.statLabel, themedStyles.statLabel]}>Total Pago</Text>
          </View>
          <View
            style={[
              styles.statCard,
              isTablet ? styles.statCardTablet : styles.statCardMobile,
              themedStyles.chartBlock,
            ]}
          >
            <Text style={[styles.statValue, themedStyles.statValue, { color: colors.chartBar1 }]}>
              {formatCurrency(summaryStats.totalInterest)}
            </Text>
            <Text style={[styles.statLabel, themedStyles.statLabel]}>
              Total Juros ({summaryStats.interestPercent.toFixed(1)}%)
            </Text>
          </View>
          <View
            style={[
              styles.statCard,
              isTablet ? styles.statCardTablet : styles.statCardMobile,
              themedStyles.chartBlock,
            ]}
          >
            <Text style={[styles.statValue, themedStyles.statValue]}>
              {formatCurrency(summaryStats.firstPayment)}
            </Text>
            <Text style={[styles.statLabel, themedStyles.statLabel]}>1ª Parcela</Text>
          </View>
          <View
            style={[
              styles.statCard,
              isTablet ? styles.statCardTablet : styles.statCardMobile,
              themedStyles.chartBlock,
            ]}
          >
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
          ref={visibilityRefs?.balance}
          style={[styles.chartBlock, themedStyles.chartBlock, isTablet && styles.chartBlockHalf]}
          accessibilityRole="image"
          accessibilityLabel="Gráfico de saldo devedor"
        >
          <View style={styles.chartHeader}>
            <Text style={[styles.chartLabel, themedStyles.chartLabel]}>Saldo Devedor</Text>
            {balanceValues.length > 0 && (
              <Text style={[styles.chartValue, { color: colors.chartLine2 }]}>
                {formatChartCurrency(balanceValues[0])} →{' '}
                {formatChartCurrency(balanceValues[balanceValues.length - 1])}
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
                x1={halfLayout.leftGutter}
                y1={
                  halfLayout.verticalPadding +
                  ratio * (halfLayout.height - halfLayout.verticalPadding * 2)
                }
                x2={halfLayout.width - halfLayout.rightPadding}
                y2={
                  halfLayout.verticalPadding +
                  ratio * (halfLayout.height - halfLayout.verticalPadding * 2)
                }
                stroke={gridLineColor}
                strokeWidth={0.5}
                strokeDasharray="4,4"
              />
            ))}
            {/* Area fill */}
            <Path d={balanceAreaPath} fill="url(#balanceGradient)" />
            {/* Line */}
            <Path
              d={balancePath}
              stroke={colors.chartLine2}
              strokeWidth={2.5}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Y-axis labels */}
            {balanceValues.length > 0 && (
              <>
                <SvgText
                  x={halfLayout.leftGutter - 6}
                  y={halfLayout.verticalPadding + 4}
                  fontSize={9}
                  fill={colors.textTertiary}
                  textAnchor="end"
                >
                  {formatCompactCurrency(Math.max(...balanceValues))}
                </SvgText>
                <SvgText
                  x={halfLayout.leftGutter - 6}
                  y={halfLayout.height - halfLayout.verticalPadding}
                  fontSize={9}
                  fill={colors.textTertiary}
                  textAnchor="end"
                >
                  R$ 0
                </SvgText>
              </>
            )}
          </Svg>
        </View>

        {/* Payment Chart */}
        <View
          ref={visibilityRefs?.payment}
          style={[styles.chartBlock, themedStyles.chartBlock, isTablet && styles.chartBlockHalf]}
          accessibilityRole="image"
          accessibilityLabel="Gráfico das parcelas"
        >
          <View style={styles.chartHeader}>
            <Text style={[styles.chartLabel, themedStyles.chartLabel]}>Parcelas</Text>
            {paymentValues.length > 0 && (
              <Text style={[styles.chartValue, { color: colors.chartLine1 }]}>
                {formatChartCurrency(paymentValues[0])} →{' '}
                {formatChartCurrency(paymentValues[paymentValues.length - 1])}
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
                x1={halfLayout.leftGutter}
                y1={
                  halfLayout.verticalPadding +
                  ratio * (halfLayout.height - halfLayout.verticalPadding * 2)
                }
                x2={halfLayout.width - halfLayout.rightPadding}
                y2={
                  halfLayout.verticalPadding +
                  ratio * (halfLayout.height - halfLayout.verticalPadding * 2)
                }
                stroke={gridLineColor}
                strokeWidth={0.5}
                strokeDasharray="4,4"
              />
            ))}
            {/* Area fill */}
            <Path d={paymentAreaPath} fill="url(#paymentGradient)" />
            {/* Line */}
            <Path
              d={paymentPath}
              stroke={colors.chartLine1}
              strokeWidth={2.5}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Y-axis labels */}
            {paymentValues.length > 0 && (
              <>
                <SvgText
                  x={halfLayout.leftGutter - 6}
                  y={halfLayout.verticalPadding + 4}
                  fontSize={9}
                  fill={colors.textTertiary}
                  textAnchor="end"
                >
                  {formatCompactCurrency(Math.max(...paymentValues))}
                </SvgText>
                <SvgText
                  x={halfLayout.leftGutter - 6}
                  y={halfLayout.height - halfLayout.verticalPadding}
                  fontSize={9}
                  fill={colors.textTertiary}
                  textAnchor="end"
                >
                  R$ 0
                </SvgText>
              </>
            )}
          </Svg>
        </View>

        {/* Interest vs Amortization Chart */}
        <View
          ref={visibilityRefs?.composition}
          style={[styles.chartBlock, themedStyles.chartBlock, isTablet && styles.chartBlockFull]}
          accessibilityRole="image"
          accessibilityLabel="Gráfico de juros versus amortização"
          testID="chart-payment-composition"
        >
          <View style={styles.chartHeader}>
            <Text style={[styles.chartLabel, themedStyles.chartLabel]}>
              Composição das Parcelas
            </Text>
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
                x1={fullLayout.leftGutter}
                y1={
                  fullLayout.verticalPadding +
                  ratio * (fullLayout.height - fullLayout.verticalPadding * 2)
                }
                x2={fullLayout.width - fullLayout.rightPadding}
                y2={
                  fullLayout.verticalPadding +
                  ratio * (fullLayout.height - fullLayout.verticalPadding * 2)
                }
                stroke={gridLineColor}
                strokeWidth={0.5}
                strokeDasharray="4,4"
              />
            ))}
            {barData.map((row) => {
              return (
                <G key={row.index}>
                  {/* Interest bar (bottom) */}
                  <Rect
                    x={row.x}
                    y={row.yBase - row.interestHeight - row.amortizationHeight}
                    width={row.width}
                    height={row.interestHeight}
                    fill={colors.chartBar1}
                    rx={row.cornerRadius}
                    ry={row.cornerRadius}
                  />
                  {/* Amortization bar (top) */}
                  <Rect
                    x={row.x}
                    y={row.yBase - row.amortizationHeight}
                    width={row.width}
                    height={row.amortizationHeight}
                    fill={colors.chartBar2}
                    rx={row.cornerRadius}
                    ry={row.cornerRadius}
                  />
                </G>
              );
            })}
            {/* X-axis labels */}
            <SvgText
              x={fullLayout.leftGutter}
              y={fullLayout.height - 4}
              fontSize={9}
              fill={colors.textTertiary}
            >
              Início
            </SvgText>
            <SvgText
              x={fullLayout.width - fullLayout.rightPadding}
              y={fullLayout.height - 4}
              fontSize={9}
              fill={colors.textTertiary}
              textAnchor="end"
            >
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
