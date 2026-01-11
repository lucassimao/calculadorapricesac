import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ScheduleRow } from '../types/loan';
import { formatCurrency } from '../lib/calculations';

interface AmortizationTableProps {
  schedule: ScheduleRow[];
  showCumulative?: boolean;
  totalSchedule?: ScheduleRow[];
  showExtras?: boolean;
}

export function AmortizationTable({
  schedule,
  showCumulative = false,
  totalSchedule,
  showExtras = false,
}: AmortizationTableProps) {
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
      { payment: 0, interest: 0, amortization: 0, prepayment: 0, fgts: 0 }
    );
  }, [schedule, totalSchedule]);

  // Check if there are any extras to show
  const hasExtras = useMemo(() => {
    return schedule.some(
      (row) =>
        (row.prepaymentAmount && row.prepaymentAmount > 0) ||
        (row.fgtsAmortization && row.fgtsAmortization > 0) ||
        (row.fgtsSubsidy && row.fgtsSubsidy > 0)
    );
  }, [schedule]);

  const displayExtras = showExtras && hasExtras;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={[styles.cell, styles.cellSmall]}>#</Text>
        <Text style={styles.cell}>Data</Text>
        <Text style={[styles.cell, styles.cellRight]}>Parcela</Text>
        <Text style={[styles.cell, styles.cellRight]}>
          {showCumulative ? 'Juros Acum.' : 'Juros'}
        </Text>
        <Text style={[styles.cell, styles.cellRight]}>
          {showCumulative ? 'Amort. Acum.' : 'Amort.'}
        </Text>
        <Text style={[styles.cell, styles.cellRight]}>Saldo</Text>
        {displayExtras && (
          <>
            <Text style={[styles.cell, styles.cellRight, styles.cellExtra]}>Extra</Text>
            <Text style={[styles.cell, styles.cellRight, styles.cellExtra]}>FGTS</Text>
          </>
        )}
      </View>

      <View>
        {rows.map((item, index) => {
          const interestValue = showCumulative ? item.cumulativeInterest : item.interest;
          const amortValue = showCumulative ? item.cumulativeAmortization : item.amortization;
          const fgtsValue = (item.fgtsAmortization ?? 0) + (item.fgtsSubsidy ?? 0);
          return (
            <View key={item.installmentNumber} style={[styles.row, index % 2 === 0 ? styles.rowAlt : null]}>
              <Text style={[styles.cell, styles.cellSmall]}>{item.installmentNumber}</Text>
              <Text style={styles.cell}>{item.date.toLocaleDateString('pt-BR')}</Text>
              <Text style={[styles.cell, styles.cellRight]}>{formatCurrency(item.payment)}</Text>
              <Text style={[styles.cell, styles.cellRight]}>{formatCurrency(interestValue)}</Text>
              <Text style={[styles.cell, styles.cellRight]}>{formatCurrency(amortValue)}</Text>
              <Text style={[styles.cell, styles.cellRight]}>{formatCurrency(item.balance)}</Text>
              {displayExtras && (
                <>
                  <Text style={[styles.cell, styles.cellRight, styles.cellExtra, item.prepaymentAmount ? styles.cellHighlight : null]}>
                    {item.prepaymentAmount ? formatCurrency(item.prepaymentAmount) : '-'}
                  </Text>
                  <Text style={[styles.cell, styles.cellRight, styles.cellExtra, fgtsValue > 0 ? styles.cellHighlight : null]}>
                    {fgtsValue > 0 ? formatCurrency(fgtsValue) : '-'}
                  </Text>
                </>
              )}
            </View>
          );
        })}
        <View style={styles.footerRow}>
          <Text style={[styles.cell, styles.cellSmall]}>Tot.</Text>
          <Text style={styles.cell}>-</Text>
          <Text style={[styles.cell, styles.cellRight]}>{formatCurrency(totals.payment)}</Text>
          <Text style={[styles.cell, styles.cellRight]}>{formatCurrency(totals.interest)}</Text>
          <Text style={[styles.cell, styles.cellRight]}>{formatCurrency(totals.amortization)}</Text>
          <Text style={[styles.cell, styles.cellRight]}>-</Text>
          {displayExtras && (
            <>
              <Text style={[styles.cell, styles.cellRight, styles.cellExtra]}>
                {totals.prepayment > 0 ? formatCurrency(totals.prepayment) : '-'}
              </Text>
              <Text style={[styles.cell, styles.cellRight, styles.cellExtra]}>
                {totals.fgts > 0 ? formatCurrency(totals.fgts) : '-'}
              </Text>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  rowAlt: {
    backgroundColor: '#FAFAFA',
  },
  footerRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 6,
    backgroundColor: '#E5E7EB',
  },
  cell: {
    flex: 1,
    fontSize: 12,
    color: '#374151',
  },
  cellSmall: {
    flex: 0.5,
  },
  cellRight: {
    textAlign: 'right',
  },
  cellExtra: {
    flex: 0.8,
    fontSize: 11,
  },
  cellHighlight: {
    color: '#059669',
    fontWeight: '600',
  },
});
