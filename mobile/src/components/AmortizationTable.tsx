import { useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import type { ScheduleRow } from '@loan-engine/loan';
import { formatCurrency } from '@loan-engine/calculations';
import { useTheme } from '../lib/theme';

type ColumnKey =
  | 'installment'
  | 'date'
  | 'payment'
  | 'interest'
  | 'amortization'
  | 'balance'
  | 'correction'
  | 'extra'
  | 'fgts';

interface AmortizationTableProps {
  schedule: ScheduleRow[];
  showCumulative?: boolean;
  totalSchedule?: ScheduleRow[];
  showExtras?: boolean;
  columns?: ColumnKey[];
}

export function AmortizationTable({
  schedule,
  showCumulative = false,
  totalSchedule,
  showExtras = false,
  columns = [
    'installment',
    'date',
    'payment',
    'interest',
    'amortization',
    'balance',
    'extra',
    'fgts',
  ],
}: AmortizationTableProps) {
  const { colors } = useTheme();
  const [tableWidth, setTableWidth] = useState(0);

  const rows = useMemo(() => {
    const filtered = schedule.filter((row) => row.installmentNumber > 0);
    let cumulativeInterest = 0;
    let cumulativeAmortization = 0;
    return filtered.map((row) => {
      cumulativeInterest += row.interest;
      cumulativeAmortization += row.amortization;
      return {
        ...row,
        cumulativeInterest,
        cumulativeAmortization,
      };
    });
  }, [schedule]);

  const totals = useMemo(() => {
    const source = (totalSchedule ?? schedule).filter((row) => row.installmentNumber > 0);
    return source.reduce(
      (acc, row) => ({
        payment: acc.payment + row.payment,
        interest: acc.interest + row.interest,
        amortization: acc.amortization + row.amortization,
        correction: acc.correction + (row.indexCorrection ?? 0),
        prepayment: acc.prepayment + (row.prepaymentAmount ?? 0),
        fgts: acc.fgts + (row.fgtsAmortization ?? 0) + (row.fgtsSubsidy ?? 0),
      }),
      { payment: 0, interest: 0, amortization: 0, correction: 0, prepayment: 0, fgts: 0 },
    );
  }, [schedule, totalSchedule]);

  const hasCorrection = useMemo(
    () => schedule.some((row) => row.indexCorrection !== undefined),
    [schedule],
  );

  // Check if there are any extras to show
  const hasExtras = useMemo(() => {
    return schedule.some(
      (row) =>
        (row.prepaymentAmount && row.prepaymentAmount > 0) ||
        (row.fgtsAmortization && row.fgtsAmortization > 0) ||
        (row.fgtsSubsidy && row.fgtsSubsidy > 0),
    );
  }, [schedule]);

  const displayExtras = showExtras && hasExtras;
  const columnsWithCorrection =
    hasCorrection && !columns.includes('correction')
      ? columns.flatMap((col) => (col === 'balance' ? (['correction', col] as const) : [col]))
      : columns;
  const availableColumns = columnsWithCorrection.filter((col) => {
    if ((col === 'extra' || col === 'fgts') && !displayExtras) return false;
    return true;
  });

  const responsiveColumns = useMemo(() => {
    const width = tableWidth || 360;
    const allowedColumns =
      width < 330
        ? ['installment', 'payment', 'balance']
        : width < 430
          ? ['installment', 'date', 'payment', 'balance']
          : width < 620
            ? ['installment', 'date', 'payment', 'interest', 'amortization', 'balance']
            : width < 760
              ? [
                  'installment',
                  'date',
                  'payment',
                  'interest',
                  'amortization',
                  'correction',
                  'balance',
                ]
              : [
                  'installment',
                  'date',
                  'payment',
                  'interest',
                  'amortization',
                  'correction',
                  'balance',
                  'extra',
                  'fgts',
                ];

    return availableColumns.filter((col) => allowedColumns.includes(col));
  }, [availableColumns, tableWidth]);

  const visibleColumns = responsiveColumns.length > 0 ? responsiveColumns : availableColumns;

  const headerLabels: Record<ColumnKey, string> = {
    installment: '#',
    date: 'Data',
    payment: 'Parcela',
    interest: showCumulative ? 'Juros Acum.' : 'Juros',
    amortization: showCumulative ? 'Amort. Acum.' : 'Amort.',
    balance: 'Saldo',
    correction: 'Correção',
    extra: 'Extra',
    fgts: 'FGTS',
  };

  // Dynamic themed styles
  const themedStyles = useMemo(
    () => ({
      container: { borderColor: colors.border },
      headerRow: { backgroundColor: colors.backgroundTertiary },
      row: { backgroundColor: colors.background },
      rowAlt: { backgroundColor: colors.rowAlt },
      footerRow: { backgroundColor: colors.backgroundTertiary },
      cell: { color: colors.textSecondary },
      cellHighlight: { color: colors.successDark },
    }),
    [colors],
  );

  const handleLayout = (event: LayoutChangeEvent) => {
    const nextWidth = Math.round(event.nativeEvent.layout.width);
    setTableWidth((currentWidth) =>
      Math.abs(currentWidth - nextWidth) > 1 ? nextWidth : currentWidth,
    );
  };

  const getCellStyle = (col: ColumnKey) => [
    styles.cell,
    themedStyles.cell,
    col === 'installment' ? styles.cellInstallment : null,
    col === 'date' ? styles.cellDate : null,
    col === 'payment' || col === 'balance' ? styles.cellPrimaryMoney : null,
    col === 'interest' || col === 'amortization' ? styles.cellSecondaryMoney : null,
    col === 'correction' || col === 'extra' || col === 'fgts' ? styles.cellExtra : null,
    col === 'installment' ? styles.cellLeft : col !== 'date' ? styles.cellRight : null,
  ];

  return (
    <View
      style={[styles.container, themedStyles.container]}
      accessibilityLabel="Tabela de amortização"
      onLayout={handleLayout}
    >
      <View style={[styles.headerRow, themedStyles.headerRow]} accessibilityRole="header">
        {visibleColumns.map((col) => (
          <Text
            key={`header-${col}`}
            style={[...getCellStyle(col), styles.headerCell]}
            accessibilityLabel={`Coluna ${headerLabels[col]}`}
            testID={`table-header-${col}`}
          >
            {headerLabels[col]}
          </Text>
        ))}
      </View>

      <View accessibilityLabel="Dados da tabela">
        {rows.map((item, index) => {
          const interestValue = showCumulative ? item.cumulativeInterest : item.interest;
          const amortValue = showCumulative ? item.cumulativeAmortization : item.amortization;
          const fgtsValue = (item.fgtsAmortization ?? 0) + (item.fgtsSubsidy ?? 0);
          return (
            <View
              key={item.installmentNumber}
              style={[styles.row, index % 2 === 0 ? themedStyles.rowAlt : themedStyles.row]}
              accessibilityLabel={`Parcela ${item.installmentNumber}`}
            >
              {visibleColumns.map((col) => {
                let value: string | number = '-';
                if (col === 'installment') value = item.installmentNumber;
                if (col === 'date') value = item.date.toLocaleDateString('pt-BR');
                if (col === 'payment') value = formatCurrency(item.payment);
                if (col === 'interest') value = formatCurrency(interestValue);
                if (col === 'amortization') value = formatCurrency(amortValue);
                if (col === 'balance') value = formatCurrency(item.balance);
                if (col === 'correction') value = formatCurrency(item.indexCorrection ?? 0);
                if (col === 'extra')
                  value = item.prepaymentAmount ? formatCurrency(item.prepaymentAmount) : '-';
                if (col === 'fgts') value = fgtsValue > 0 ? formatCurrency(fgtsValue) : '-';

                return (
                  <Text
                    key={`${item.installmentNumber}-${col}`}
                    style={[
                      ...getCellStyle(col),
                      (col === 'extra' && item.prepaymentAmount) ||
                      (col === 'fgts' && fgtsValue > 0) ||
                      (col === 'correction' && item.indexCorrection)
                        ? themedStyles.cellHighlight
                        : null,
                    ]}
                    accessibilityLabel={`${headerLabels[col]}: ${value}`}
                  >
                    {value}
                  </Text>
                );
              })}
            </View>
          );
        })}
        <View style={[styles.footerRow, themedStyles.footerRow]} accessibilityLabel="Totais">
          {visibleColumns.map((col) => {
            let value: string | number = '-';
            if (col === 'installment') value = 'Tot.';
            if (col === 'payment') value = formatCurrency(totals.payment);
            if (col === 'interest') value = formatCurrency(totals.interest);
            if (col === 'amortization') value = formatCurrency(totals.amortization);
            if (col === 'correction') value = formatCurrency(totals.correction);
            if (col === 'extra')
              value = totals.prepayment > 0 ? formatCurrency(totals.prepayment) : '-';
            if (col === 'fgts') value = totals.fgts > 0 ? formatCurrency(totals.fgts) : '-';
            return (
              <Text
                key={`footer-${col}`}
                style={[...getCellStyle(col), styles.footerCell]}
                accessibilityLabel={`Total ${headerLabels[col]}: ${value}`}
              >
                {value}
              </Text>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  footerRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  cell: {
    flex: 1,
    fontSize: 12,
    paddingHorizontal: 3,
  },
  headerCell: {
    fontSize: 11,
  },
  footerCell: {
    fontWeight: '500',
  },
  cellInstallment: {
    flex: 0.45,
  },
  cellDate: {
    flex: 0.95,
  },
  cellPrimaryMoney: {
    flex: 1.25,
  },
  cellSecondaryMoney: {
    flex: 1.1,
  },
  cellRight: {
    textAlign: 'right',
  },
  cellLeft: {
    textAlign: 'left',
  },
  cellExtra: {
    flex: 0.95,
    fontSize: 11,
  },
});
