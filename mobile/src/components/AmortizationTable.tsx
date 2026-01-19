import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ScheduleRow } from '../types/loan';
import { formatCurrency } from '../lib/calculations';
import { useTheme } from '../lib/theme';

type ColumnKey =
  | 'installment'
  | 'date'
  | 'payment'
  | 'interest'
  | 'amortization'
  | 'balance'
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
        prepayment: acc.prepayment + (row.prepaymentAmount ?? 0),
        fgts: acc.fgts + (row.fgtsAmortization ?? 0) + (row.fgtsSubsidy ?? 0),
      }),
      { payment: 0, interest: 0, amortization: 0, prepayment: 0, fgts: 0 },
    );
  }, [schedule, totalSchedule]);

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
  const visibleColumns = columns.filter((col) => {
    if ((col === 'extra' || col === 'fgts') && !displayExtras) return false;
    return true;
  });

  const headerLabels: Record<ColumnKey, string> = {
    installment: '#',
    date: 'Data',
    payment: 'Parcela',
    interest: showCumulative ? 'Juros Acum.' : 'Juros',
    amortization: showCumulative ? 'Amort. Acum.' : 'Amort.',
    balance: 'Saldo',
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

  return (
    <View
      style={[styles.container, themedStyles.container]}
      accessible={true}
      accessibilityLabel="Tabela de amortização"
    >
      <View style={[styles.headerRow, themedStyles.headerRow]} accessibilityRole="header">
        {visibleColumns.map((col) => (
          <Text
            key={`header-${col}`}
            style={[
              styles.cell,
              themedStyles.cell,
              col === 'installment' ? styles.cellSmall : null,
              col === 'installment' ? styles.cellLeft : col !== 'date' ? styles.cellRight : null,
              col === 'extra' || col === 'fgts' ? styles.cellExtra : null,
            ]}
            accessibilityLabel={`Coluna ${headerLabels[col]}`}
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
                if (col === 'extra')
                  value = item.prepaymentAmount ? formatCurrency(item.prepaymentAmount) : '-';
                if (col === 'fgts') value = fgtsValue > 0 ? formatCurrency(fgtsValue) : '-';

                return (
                  <Text
                    key={`${item.installmentNumber}-${col}`}
                    style={[
                      styles.cell,
                      themedStyles.cell,
                      col === 'installment' ? styles.cellSmall : null,
                      col === 'installment'
                        ? styles.cellLeft
                        : col !== 'date'
                          ? styles.cellRight
                          : null,
                      col === 'extra' || col === 'fgts' ? styles.cellExtra : null,
                      (col === 'extra' && item.prepaymentAmount) ||
                      (col === 'fgts' && fgtsValue > 0)
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
            if (col === 'extra')
              value = totals.prepayment > 0 ? formatCurrency(totals.prepayment) : '-';
            if (col === 'fgts') value = totals.fgts > 0 ? formatCurrency(totals.fgts) : '-';
            return (
              <Text
                key={`footer-${col}`}
                style={[
                  styles.cell,
                  themedStyles.cell,
                  col === 'installment' ? styles.cellSmall : null,
                  col === 'installment'
                    ? styles.cellLeft
                    : col !== 'date'
                      ? styles.cellRight
                      : null,
                  col === 'extra' || col === 'fgts' ? styles.cellExtra : null,
                ]}
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
  },
  cellSmall: {
    flex: 0.5,
  },
  cellRight: {
    textAlign: 'right',
  },
  cellLeft: {
    textAlign: 'left',
  },
  cellExtra: {
    flex: 0.8,
    fontSize: 11,
  },
});
