import { StyleSheet, Text, View } from 'react-native';
import type { CorrectionIndexType, LoanSummary, Scenario } from '@loan-engine/loan';
import { formatCetResult, formatCurrency } from '@loan-engine/calculations';
import { formatCorrectionRate, formatInsuranceChargeTiming } from '../../lib/exports/formatters';
import { useTheme } from '../../lib/theme';

interface SummarySectionProps {
  summary: LoanSummary;
  principal: number;
  isPremium: boolean;
  isCalculating: boolean;
  indexType?: CorrectionIndexType;
  indexRate?: number;
  cetNotApplicable?: boolean;
  insuranceChargeTiming?: Scenario['insuranceChargeTiming'];
}

export function SummarySection({
  summary,
  principal,
  isPremium,
  isCalculating,
  indexType,
  indexRate,
  cetNotApplicable = false,
  insuranceChargeTiming,
}: SummarySectionProps) {
  const { colors } = useTheme();
  const hasTotalIndexCorrection = summary.totalIndexCorrection !== 0;

  return (
    <View
      style={[
        styles.section,
        { backgroundColor: colors.backgroundSecondary, borderColor: colors.border },
      ]}
    >
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]} testID="section-summary">
          Resumo
        </Text>
        {isCalculating && (
          <Text style={[styles.calculatingText, { color: colors.textTertiary }]}>
            calculando...
          </Text>
        )}
      </View>

      {isPremium && (
        <View style={[styles.premiumBadge, { backgroundColor: colors.successLight }]}>
          <Text style={[styles.premiumBadgeText, { color: colors.success }]}>Premium ativo</Text>
        </View>
      )}

      {summary.financedPrincipal !== principal && (
        <SummaryRow
          label="Principal Financiado"
          value={formatCurrency(summary.financedPrincipal)}
          colors={colors}
        />
      )}

      <SummaryRow label="Total Pago" value={formatCurrency(summary.totalPayment)} colors={colors} />

      {(summary.totalUpfrontCosts > 0 || summary.totalMonthlyCosts > 0) && (
        <>
          <SummaryRow
            label="Custos Iniciais"
            value={formatCurrency(summary.totalUpfrontCosts)}
            colors={colors}
          />
          <SummaryRow
            label="Custos Mensais"
            value={formatCurrency(summary.totalMonthlyCosts)}
            colors={colors}
          />
          {((summary.totalMipInsurance ?? 0) > 0 || (summary.totalDfiInsurance ?? 0) > 0) && (
            <>
              <SummaryRow
                label="Seguros: MIP + DFI (incluídos nos custos mensais)"
                value={formatCurrency(
                  (summary.totalMipInsurance ?? 0) + (summary.totalDfiInsurance ?? 0),
                )}
                colors={colors}
                testID="summary-insurance-mip-dfi"
              />
              {(summary.totalMipInsurance ?? 0) > 0 && (
                <SummaryRow
                  label="MIP (saldo devedor)"
                  value={formatCurrency(summary.totalMipInsurance ?? 0)}
                  colors={colors}
                />
              )}
              {(summary.totalDfiInsurance ?? 0) > 0 && (
                <SummaryRow
                  label="DFI (valor do imóvel)"
                  value={formatCurrency(summary.totalDfiInsurance ?? 0)}
                  colors={colors}
                />
              )}
              <SummaryRow
                label="Cobrança dos seguros"
                value={formatInsuranceChargeTiming(insuranceChargeTiming)}
                colors={colors}
              />
            </>
          )}
          {(summary.totalAdminFees ?? 0) > 0 && (
            <SummaryRow
              label="Tarifa administrativa (incluída nos custos mensais)"
              value={formatCurrency(summary.totalAdminFees ?? 0)}
              colors={colors}
            />
          )}
          <SummaryRow
            label="Total com Custos"
            value={formatCurrency(summary.totalPaymentWithCosts)}
            colors={colors}
          />
        </>
      )}

      {cetNotApplicable ? (
        <SummaryRow
          label="CET"
          value="Não se aplica ao saldo atual"
          colors={colors}
          testID="summary-cet-not-applicable"
        />
      ) : (
        <SummaryRow
          label="CET (a.a.)"
          value={formatCetResult(summary.cet)}
          colors={colors}
          testID="summary-cet"
        />
      )}

      {summary.propertyTotalCost > 0 && (
        <SummaryRow
          label="Custo Total do Imóvel"
          value={formatCurrency(summary.propertyTotalCost)}
          colors={colors}
        />
      )}

      {summary.totalFgtsUsed > 0 && (
        <SummaryRow
          label="FGTS Usado"
          value={formatCurrency(summary.totalFgtsUsed)}
          colors={colors}
        />
      )}

      {summary.totalPaymentNet !== summary.totalPayment && (
        <SummaryRow
          label="Total Pago Líquido"
          value={formatCurrency(summary.totalPaymentNet)}
          colors={colors}
        />
      )}

      {indexType && (
        <>
          <SummaryRow
            label="Índice de Correção"
            value={indexType}
            colors={colors}
            testID={`summary-index-type-${indexType.toLowerCase()}`}
          />
          <SummaryRow
            label="Taxa de Correção"
            value={formatCorrectionRate(indexRate)}
            colors={colors}
          />
          {hasTotalIndexCorrection && (
            <SummaryRow
              label="Correção Total"
              value={formatCurrency(summary.totalIndexCorrection)}
              colors={colors}
              testID="summary-total-index-correction"
            />
          )}
        </>
      )}

      <SummaryRow
        label="Total de Juros"
        value={formatCurrency(summary.totalInterest)}
        colors={colors}
      />
      <SummaryRow
        label="1ª Parcela"
        value={formatCurrency(summary.firstPayment)}
        colors={colors}
        testID="summary-first-payment"
      />
      <SummaryRow
        label="Última Parcela"
        value={formatCurrency(summary.lastPayment)}
        colors={colors}
      />
    </View>
  );
}

interface SummaryRowProps {
  label: string;
  value: string;
  colors: { textSecondary: string; text: string; borderLight: string };
  testID?: string;
}

function SummaryRow({ label, value, colors, testID }: SummaryRowProps) {
  const keepsValueOnOneLine = value.startsWith('R$');
  return (
    <View
      style={[styles.summaryRow, { borderBottomColor: colors.borderLight }]}
      accessible={Boolean(testID)}
      accessibilityLabel={testID ? `${label}: ${value}` : undefined}
      testID={testID}
      collapsable={false}
    >
      <Text
        style={[styles.summaryLabel, { color: colors.textSecondary }]}
        testID={testID ? `${testID}-label` : undefined}
      >
        {label}
      </Text>
      <Text
        style={[styles.summaryValue, { color: colors.text }]}
        testID={testID ? `${testID}-value` : undefined}
        numberOfLines={keepsValueOnOneLine ? 1 : undefined}
        adjustsFontSizeToFit={keepsValueOnOneLine || undefined}
        minimumFontScale={keepsValueOnOneLine ? 0.72 : undefined}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  calculatingText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  premiumBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  premiumBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  summaryLabel: {
    fontSize: 14,
    flex: 1,
    flexShrink: 1,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 0,
    maxWidth: '52%',
    textAlign: 'right',
  },
});
