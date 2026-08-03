import { Alert, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Scenario } from '@loan-engine/loan';
import { MIP_RATE_TABLE } from '../../lib/insurance-rates';
import { useTheme } from '../../lib/theme';

interface InsuranceCostsSectionProps {
  borrowerAgeText: string;
  mipRateText: string;
  dfiRateText: string;
  adminFeeText: string;
  legacyAdminFeeRateText?: string;
  showDfi: boolean;
  showInsuranceTiming?: boolean;
  insuranceChargeTiming?: Scenario['insuranceChargeTiming'];
  isExistingContract?: boolean;
  propertyValueText?: string;
  onBorrowerAgeTextChange: (text: string) => void;
  onBorrowerAgeBlur?: () => void;
  onMipRateTextChange: (text: string) => void;
  onDfiRateTextChange: (text: string) => void;
  onAdminFeeTextChange: (text: string) => void;
  onLegacyAdminFeeRateTextChange?: (text: string) => void;
  onInsuranceChargeTimingChange?: (timing: NonNullable<Scenario['insuranceChargeTiming']>) => void;
  onApplyAgeEstimate: () => void;
  onPropertyValueTextChange?: (text: string) => void;
}

export function InsuranceCostsSection({
  borrowerAgeText,
  mipRateText,
  dfiRateText,
  adminFeeText,
  legacyAdminFeeRateText,
  showDfi,
  showInsuranceTiming = false,
  insuranceChargeTiming = 'monthly',
  isExistingContract = false,
  propertyValueText,
  onBorrowerAgeTextChange,
  onBorrowerAgeBlur,
  onMipRateTextChange,
  onDfiRateTextChange,
  onAdminFeeTextChange,
  onLegacyAdminFeeRateTextChange,
  onInsuranceChargeTimingChange,
  onApplyAgeEstimate,
  onPropertyValueTextChange,
}: InsuranceCostsSectionProps) {
  const { colors } = useTheme();
  const inputStyle = [
    styles.input,
    { color: colors.text, borderColor: colors.border, backgroundColor: colors.background },
  ];
  const openSource = (url: string) => {
    void Linking.openURL(url).catch(() => {
      Alert.alert('Não foi possível abrir a fonte', 'Tente novamente quando estiver conectado.');
    });
  };

  return (
    <View style={styles.fields} testID="insurance-cost-fields">
      <Text style={[styles.label, { color: colors.textSecondary }]}>Idade do proponente</Text>
      <TextInput
        value={borrowerAgeText}
        onChangeText={onBorrowerAgeTextChange}
        onBlur={onBorrowerAgeBlur}
        keyboardType="numeric"
        placeholder="28"
        placeholderTextColor={colors.textTertiary}
        accessibilityLabel="Idade do proponente"
        style={inputStyle}
        testID="input-borrower-age"
      />

      <Pressable
        onPress={onApplyAgeEstimate}
        accessibilityRole="button"
        accessibilityLabel="Aplicar taxa MIP estimada por idade"
        style={[styles.estimateButton, { borderColor: colors.primary }]}
        testID="btn-apply-mip-estimate"
      >
        <Text style={[styles.estimateButtonText, { color: colors.primary }]}>
          Aplicar taxa estimada
        </Text>
      </Pressable>
      <Text style={[styles.notice, { color: colors.textTertiary }]}>
        {MIP_RATE_TABLE.estimateNotice}. Referência: {MIP_RATE_TABLE.bank}, {MIP_RATE_TABLE.product}
        , {MIP_RATE_TABLE.referenceDate}; progressão etária {MIP_RATE_TABLE.ageProgressionVersion}.{' '}
        {isExistingContract
          ? 'No contrato existente, o preset altera somente a taxa; confira o boleto atual.'
          : 'Aplicar a estimativa altera somente a taxa; escolha abaixo a forma de cobrança descrita na sua apólice.'}
      </Text>
      <Pressable
        onPress={() => openSource(MIP_RATE_TABLE.sourceUrl)}
        accessibilityRole="link"
        accessibilityLabel="Abrir fonte da estimativa de MIP"
        style={styles.sourceLinkTarget}
      >
        <Text style={[styles.sourceLink, { color: colors.primary }]}>Ver taxa-base Itaú</Text>
      </Pressable>
      <Pressable
        onPress={() => openSource(MIP_RATE_TABLE.ageProgressionSourceUrl)}
        accessibilityRole="link"
        accessibilityLabel="Abrir fonte da progressão por faixa etária"
        style={styles.sourceLinkTarget}
      >
        <Text style={[styles.sourceLink, { color: colors.primary }]}>
          Ver progressão Brasilseg/BB
        </Text>
      </Pressable>

      <Text style={[styles.label, { color: colors.textSecondary }]}>
        MIP (% do saldo devedor ao mês)
      </Text>
      <TextInput
        value={mipRateText}
        onChangeText={onMipRateTextChange}
        keyboardType="numeric"
        placeholder="0,0202"
        placeholderTextColor={colors.textTertiary}
        accessibilityLabel="Taxa mensal de seguro MIP"
        accessibilityHint="Estimativa histórica por idade. Confira e substitua pela taxa da sua apólice."
        style={inputStyle}
        testID="input-mip-rate"
      />

      {showDfi ? (
        <>
          {isExistingContract && onPropertyValueTextChange ? (
            <>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Valor do imóvel para DFI (R$)
              </Text>
              <TextInput
                value={propertyValueText ?? ''}
                onChangeText={onPropertyValueTextChange}
                keyboardType="numeric"
                placeholder="R$ 300.000"
                placeholderTextColor={colors.textTertiary}
                accessibilityLabel="Valor do imóvel usado como base do DFI"
                style={inputStyle}
                testID="input-dfi-property-value"
              />
            </>
          ) : null}
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            DFI (% do valor do imóvel ao mês)
          </Text>
          <TextInput
            value={dfiRateText}
            onChangeText={onDfiRateTextChange}
            keyboardType="numeric"
            placeholder="0,01337"
            placeholderTextColor={colors.textTertiary}
            accessibilityLabel="Taxa mensal de seguro DFI"
            accessibilityHint="Confira e substitua pela taxa DFI da sua apólice."
            style={inputStyle}
            testID="input-dfi-rate"
          />
        </>
      ) : null}

      {showInsuranceTiming && onInsuranceChargeTimingChange ? (
        <>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Cobrança dos seguros</Text>
          <View
            style={styles.timingOptions}
            accessibilityRole="radiogroup"
            accessibilityLabel="Forma de cobrança dos seguros"
          >
            {(
              [
                ['monthly', 'Mensal (padrão)', 'btn-insurance-timing-monthly'],
                [
                  'prepaid_at_signing',
                  '2 competências na 1ª parcela',
                  'btn-insurance-timing-prepaid',
                ],
              ] as const
            ).map(([timing, label, testID]) => {
              const selected = insuranceChargeTiming === timing;
              return (
                <Pressable
                  key={timing}
                  onPress={() => onInsuranceChargeTimingChange(timing)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={label}
                  testID={testID}
                  style={[
                    styles.timingButton,
                    {
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected ? colors.primaryLight : colors.background,
                    },
                  ]}
                >
                  <Text style={[styles.timingButtonText, { color: colors.text }]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[styles.notice, { color: colors.textTertiary }]}>
            Use “2 competências na 1ª parcela” somente se a apólice cobrar uma competência da
            assinatura junto com a do primeiro vencimento; nessa opção, a última parcela não cobra
            seguro.
          </Text>
        </>
      ) : null}

      <Text style={[styles.label, { color: colors.textSecondary }]}>
        Tarifa administrativa (R$ ao mês)
      </Text>
      <TextInput
        value={adminFeeText}
        onChangeText={onAdminFeeTextChange}
        keyboardType="numeric"
        placeholder="R$ 25"
        placeholderTextColor={colors.textTertiary}
        accessibilityLabel="Tarifa administrativa mensal"
        style={inputStyle}
        testID="input-admin-fee"
      />

      {legacyAdminFeeRateText !== undefined && onLegacyAdminFeeRateTextChange ? (
        <>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Tarifa legada (% do saldo ao mês)
          </Text>
          <TextInput
            value={legacyAdminFeeRateText}
            onChangeText={onLegacyAdminFeeRateTextChange}
            keyboardType="numeric"
            placeholderTextColor={colors.textTertiary}
            accessibilityLabel="Tarifa administrativa legada sobre o saldo"
            accessibilityHint="Campo preservado de um cenário salvo na versão anterior. Informe uma tarifa fixa em reais para substituí-lo."
            style={inputStyle}
            testID="input-legacy-admin-fee-rate"
          />
          <Text style={[styles.notice, { color: colors.textTertiary }]}>
            Campo preservado de cenário antigo. Ele fica inativo enquanto houver uma tarifa fixa em
            reais e volta a valer se a tarifa fixa for apagada.
          </Text>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fields: { gap: 8 },
  label: { fontSize: 14, fontWeight: '600', marginTop: 4 },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  estimateButton: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  estimateButtonText: { fontSize: 14, fontWeight: '700' },
  notice: { fontSize: 12, lineHeight: 17 },
  sourceLink: { fontSize: 12, fontWeight: '700', textDecorationLine: 'underline' },
  sourceLinkTarget: { minHeight: 44, justifyContent: 'center', paddingVertical: 8 },
  timingOptions: { gap: 8 },
  timingButton: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 8,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  timingButtonText: { fontSize: 14, fontWeight: '600' },
});
