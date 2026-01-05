import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View, Pressable, Alert } from 'react-native';
import { useIAP } from 'expo-iap';
import type { PrepaymentEvent, Scenario } from '../../src/types/loan';
import { calculateLoanSummary, formatCurrency, generateAmortizationSchedule, validateScenario } from '../../src/lib/calculations';
import { AmortizationTable } from '../../src/components/AmortizationTable';
import { LoanCharts } from '../../src/components/LoanCharts';
import { loadScenarios, saveScenarios } from '../../src/lib/storage/scenarios';
import { AdBanner } from '../../src/components/AdBanner';
import { usePremium } from '../../src/hooks/usePremium';
import { exportCsv } from '../../src/lib/exports/csv';
import { exportPdf } from '../../src/lib/exports/pdf';
import { exportXlsx } from '../../src/lib/exports/xlsx';

const DEFAULT_SCENARIO: Scenario = {
  id: 'default',
  name: 'Cenário Principal',
  system: 'PRICE',
  principal: 300000,
  rate: 1.2,
  rateType: 'monthly',
  term: 360,
  termUnit: 'months',
  startDate: new Date(),
  dueDay: 5,
  prepayments: [],
};

const MAX_TABLE_ROWS = 24;

function parseCurrencyInput(value: string): number {
  if (!value.trim()) return 0;
  const cleaned = value
    .replace(/\s/g, '')
    .replace(/R\$/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const parsed = Number.parseFloat(cleaned);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function parseNumberInput(value: string): number {
  const parsed = Number.parseFloat(value.replace(',', '.'));
  return Number.isNaN(parsed) ? 0 : parsed;
}

export default function CalculatorScreen() {
  const [scenario, setScenario] = useState<Scenario>(DEFAULT_SCENARIO);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [principalText, setPrincipalText] = useState('300000');
  const [rateText, setRateText] = useState('1,2');
  const [termText, setTermText] = useState('360');
  const [startDateText, setStartDateText] = useState(new Date().toISOString().slice(0, 10));
  const [dueDayText, setDueDayText] = useState('5');
  const [showCumulative, setShowCumulative] = useState(false);
  const [showAllRows, setShowAllRows] = useState(false);
  const { isPremium, loading: premiumLoading, markPremium } = usePremium();
  const { requestPurchase, restorePurchases, availablePurchases } = useIAP({
    onPurchaseSuccess: async () => {
      await markPremium(true);
      Alert.alert('Premium ativado', 'Anúncios removidos e exportação liberada.');
    },
    onPurchaseError: () => {
      Alert.alert('Erro', 'Não foi possível concluir a compra.');
    },
  });
  const [newPrepayment, setNewPrepayment] = useState<Partial<PrepaymentEvent>>({
    amount: 0,
    type: 'fixed_amount',
    strategy: 'reduce_term',
    date: new Date(),
  });

  useEffect(() => {
    loadScenarios()
      .then((loaded) => setScenarios(loaded))
      .catch(() => {});
  }, []);

  const schedule = useMemo(() => generateAmortizationSchedule(scenario), [scenario]);
  const scheduleForTable = useMemo(
    () => (showAllRows ? schedule : schedule.slice(0, MAX_TABLE_ROWS + 1)),
    [schedule, showAllRows]
  );
  const summary = useMemo(() => calculateLoanSummary(schedule), [schedule]);
  const validation = useMemo(() => validateScenario(scenario), [scenario]);
  const totalInstallments = Math.max(schedule.length - 1, 0);

  const persistScenarios = async (nextScenarios: Scenario[]) => {
    setScenarios(nextScenarios);
    await saveScenarios(nextScenarios);
  };

  const handleSaveScenario = async () => {
    if (!scenario.name.trim()) {
      Alert.alert('Nome obrigatório', 'Informe um nome para o cenário.');
      return;
    }
    const existingIndex = scenarios.findIndex((item) => item.id === scenario.id);
    const nextList = [...scenarios];
    if (existingIndex >= 0) {
      nextList[existingIndex] = scenario;
    } else {
      const newId = Date.now().toString();
      nextList.unshift({ ...scenario, id: newId });
      setScenario((prev) => ({ ...prev, id: newId }));
    }
    await persistScenarios(nextList);
  };

  const handleLoadScenario = (target: Scenario) => {
    setScenario(target);
    setPrincipalText(String(target.principal));
    setRateText(String(target.rate).replace('.', ','));
    setTermText(String(target.term));
    setStartDateText(target.startDate.toISOString().slice(0, 10));
    setDueDayText(String(target.dueDay));
  };

  const handleAddPrepayment = () => {
    if (!newPrepayment.amount || !newPrepayment.date) {
      Alert.alert('Amortização incompleta', 'Informe data e valor.');
      return;
    }
    const next: PrepaymentEvent = {
      id: Date.now().toString(),
      amount: newPrepayment.amount,
      date: new Date(newPrepayment.date),
      type: newPrepayment.type as PrepaymentEvent['type'],
      strategy: newPrepayment.strategy as PrepaymentEvent['strategy'],
      description: newPrepayment.description,
    };
    setScenario((prev) => ({
      ...prev,
      prepayments: [...(prev.prepayments ?? []), next],
    }));
    setNewPrepayment({
      amount: 0,
      type: 'fixed_amount',
      strategy: 'reduce_term',
      date: new Date(),
    });
  };

  const handleRemovePrepayment = (id: string) => {
    setScenario((prev) => ({
      ...prev,
      prepayments: (prev.prepayments ?? []).filter((p) => p.id !== id),
    }));
  };

  const handlePurchase = async () => {
    try {
      if (isPremium) {
        Alert.alert('Premium ativo', 'Você já removeu os anúncios.');
        return;
      }
      await requestPurchase({
        type: 'in-app',
        request: {
          ios: { sku: 'remove_ads' },
          android: { skus: ['remove_ads'] },
        },
      });
    } catch {
      Alert.alert('Erro', 'Não foi possível concluir a compra.');
    }
  };

  const handleRestore = async () => {
    try {
      await restorePurchases();
      await new Promise((resolve) => setTimeout(resolve, 200));
      if (availablePurchases.length > 0) {
        await markPremium(true);
        Alert.alert('Restaurado', 'Compra restaurada com sucesso.');
      } else {
        Alert.alert('Nada para restaurar', 'Nenhuma compra encontrada.');
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível restaurar a compra.');
    }
  };

  const handleExport = async (format: 'pdf' | 'xlsx' | 'csv') => {
    if (!isPremium) {
      Alert.alert('Premium', 'Exportação disponível apenas para assinantes.');
      return;
    }
    try {
      if (format === 'pdf') {
        await exportPdf(scenario, summary, schedule);
      } else if (format === 'xlsx') {
        await exportXlsx(schedule, scenario);
      } else {
        await exportCsv(schedule, scenario);
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível exportar o arquivo.');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Calculadora Price & SAC</Text>
      {!premiumLoading && <AdBanner enabled={!isPremium} />}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Cenário</Text>
        <Text style={styles.label}>Nome do cenário</Text>
        <TextInput
          value={scenario.name}
          onChangeText={(text) => setScenario((prev) => ({ ...prev, name: text }))}
          style={styles.input}
          placeholder="Cenário Principal"
          accessibilityLabel="Nome do cenário"
        />
        <View style={styles.rowWrap}>
          <Pressable
            style={styles.primaryButton}
            onPress={handleSaveScenario}
            accessibilityRole="button"
            accessibilityLabel="Salvar cenário"
          >
            <Text style={styles.primaryButtonText}>Salvar cenário</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => handleLoadScenario({ ...DEFAULT_SCENARIO, id: Date.now().toString() })}
            accessibilityRole="button"
            accessibilityLabel="Criar novo cenário"
          >
            <Text style={styles.secondaryButtonText}>Novo</Text>
          </Pressable>
        </View>
        {scenarios.length > 0 && (
          <View style={styles.list}>
            {scenarios.map((item) => (
              <Pressable
                key={item.id}
                style={styles.listItem}
                onPress={() => handleLoadScenario(item)}
                accessibilityRole="button"
                accessibilityLabel={`Carregar cenário ${item.name}`}
              >
                <Text style={styles.listTitle}>{item.name}</Text>
                <Text style={styles.listSubtitle}>
                  {item.system} • {formatCurrency(item.principal)}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sistema</Text>
        <View style={styles.toggleRow}>
          {(['PRICE', 'SAC'] as const).map((system) => (
            <Pressable
              key={system}
              onPress={() => setScenario((prev) => ({ ...prev, system }))}
              style={[
                styles.toggleButton,
                scenario.system === system && styles.toggleButtonActive,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: scenario.system === system }}
              accessibilityLabel={`Selecionar sistema ${system}`}
            >
              <Text
                style={[
                  styles.toggleButtonText,
                  scenario.system === system && styles.toggleButtonTextActive,
                ]}
              >
                {system}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Parâmetros</Text>

        <Text style={styles.label}>Valor do Financiamento (R$)</Text>
        <TextInput
          value={principalText}
          onChangeText={(text) => {
            setPrincipalText(text);
            setScenario((prev) => ({ ...prev, principal: parseCurrencyInput(text) }));
          }}
          keyboardType="numeric"
          style={styles.input}
          placeholder="300000 ou 300.000,00"
          accessibilityLabel="Valor do financiamento"
        />

        <Text style={styles.label}>Taxa de Juros</Text>
        <View style={styles.rowWrap}>
          <TextInput
            value={rateText}
            onChangeText={(text) => {
              setRateText(text);
              setScenario((prev) => ({ ...prev, rate: parseNumberInput(text) }));
            }}
            keyboardType="numeric"
            style={[styles.input, styles.inputFlex]}
            placeholder="1,2"
            accessibilityLabel="Taxa de juros"
          />
          <View style={styles.toggleRow}>
            {(['monthly', 'annual'] as const).map((rateType) => (
              <Pressable
                key={rateType}
                onPress={() => setScenario((prev) => ({ ...prev, rateType }))}
                style={[
                  styles.chip,
                  scenario.rateType === rateType && styles.chipActive,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: scenario.rateType === rateType }}
                accessibilityLabel={`Taxa ${rateType === 'monthly' ? 'ao mês' : 'ao ano'}`}
              >
                <Text
                  style={[
                    styles.chipText,
                    scenario.rateType === rateType && styles.chipTextActive,
                  ]}
                >
                  {rateType === 'monthly' ? 'a.m.' : 'a.a.'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Text style={styles.label}>Prazo</Text>
        <View style={styles.rowWrap}>
          <TextInput
            value={termText}
            onChangeText={(text) => {
              setTermText(text);
              const parsed = Number.parseInt(text || '0', 10);
              setScenario((prev) => ({ ...prev, term: Number.isNaN(parsed) ? 0 : parsed }));
            }}
            keyboardType="numeric"
            style={[styles.input, styles.inputFlex]}
            placeholder="360"
            accessibilityLabel="Prazo"
          />
          <View style={styles.toggleRow}>
            {(['months', 'years'] as const).map((termUnit) => (
              <Pressable
                key={termUnit}
                onPress={() => setScenario((prev) => ({ ...prev, termUnit }))}
                style={[
                  styles.chip,
                  scenario.termUnit === termUnit && styles.chipActive,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: scenario.termUnit === termUnit }}
                accessibilityLabel={`Prazo em ${termUnit === 'months' ? 'meses' : 'anos'}`}
              >
                <Text
                  style={[
                    styles.chipText,
                    scenario.termUnit === termUnit && styles.chipTextActive,
                  ]}
                >
                  {termUnit === 'months' ? 'Meses' : 'Anos'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Text style={styles.label}>Data de Início (YYYY-MM-DD)</Text>
        <TextInput
          value={startDateText}
          onChangeText={(text) => {
            setStartDateText(text);
            const parsed = new Date(text);
            if (!Number.isNaN(parsed.getTime())) {
              setScenario((prev) => ({ ...prev, startDate: parsed }));
            }
          }}
          style={styles.input}
          placeholder="2026-01-05"
          accessibilityLabel="Data de início"
        />

        <Text style={styles.label}>Dia de Vencimento</Text>
        <TextInput
          value={dueDayText}
          onChangeText={(text) => {
            setDueDayText(text);
            const parsed = Number.parseInt(text || '0', 10);
            if (!Number.isNaN(parsed)) {
              setScenario((prev) => ({ ...prev, dueDay: parsed }));
            }
          }}
          keyboardType="numeric"
          style={styles.input}
          placeholder="5"
          accessibilityLabel="Dia de vencimento"
        />
      </View>

      {(validation.errors.length > 0 || validation.warnings.length > 0) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Validação</Text>
          {validation.errors.map((error, index) => (
            <Text key={`err-${index}`} style={styles.errorText}>
              {error}
            </Text>
          ))}
          {validation.warnings.map((warning, index) => (
            <Text key={`warn-${index}`} style={styles.warningText}>
              {warning}
            </Text>
          ))}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Plano Premium</Text>
        <Text style={styles.label}>
          Remova anúncios e libere exportações por R$ 5,00 (pagamento único).
        </Text>
        <View style={styles.rowWrap}>
          <Pressable
            style={[styles.primaryButton, isPremium && styles.primaryButtonDisabled]}
            onPress={handlePurchase}
            accessibilityRole="button"
            accessibilityLabel="Remover anúncios"
          >
            <Text style={styles.primaryButtonText}>
              {isPremium ? 'Premium ativo' : 'Remover anúncios'}
            </Text>
          </Pressable>
          <Pressable
            style={styles.secondaryButton}
            onPress={handleRestore}
            accessibilityRole="button"
            accessibilityLabel="Restaurar compra"
          >
            <Text style={styles.secondaryButtonText}>Restaurar</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Resumo</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total Pago</Text>
          <Text style={styles.summaryValue}>{formatCurrency(summary.totalPayment)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total de Juros</Text>
          <Text style={styles.summaryValue}>{formatCurrency(summary.totalInterest)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>1ª Parcela</Text>
          <Text style={styles.summaryValue}>{formatCurrency(summary.firstPayment)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Última Parcela</Text>
          <Text style={styles.summaryValue}>{formatCurrency(summary.lastPayment)}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Gráficos</Text>
        <LoanCharts schedule={schedule} />
      </View>

      <View style={styles.section}>
        <View style={styles.row}>
          <Text style={styles.sectionTitle}>Tabela de Amortização</Text>
          <Pressable
            style={styles.chip}
            onPress={() => setShowCumulative((prev) => !prev)}
            accessibilityRole="button"
            accessibilityLabel={showCumulative ? 'Ocultar acumulado' : 'Mostrar acumulado'}
          >
            <Text style={styles.chipText}>{showCumulative ? 'Ocultar Acum.' : 'Mostrar Acum.'}</Text>
          </Pressable>
        </View>
        {totalInstallments > MAX_TABLE_ROWS && (
          <View style={styles.tableMetaRow}>
            <Text style={styles.tableMetaText}>
              Mostrando {showAllRows ? totalInstallments : MAX_TABLE_ROWS} de {totalInstallments} parcelas
            </Text>
            <Pressable
              style={styles.chip}
              onPress={() => setShowAllRows((prev) => !prev)}
              accessibilityRole="button"
              accessibilityLabel={showAllRows ? 'Mostrar menos parcelas' : 'Mostrar todas as parcelas'}
            >
              <Text style={styles.chipText}>{showAllRows ? 'Mostrar menos' : 'Mostrar todas'}</Text>
            </Pressable>
          </View>
        )}
        <AmortizationTable
          schedule={scheduleForTable}
          totalSchedule={schedule}
          showCumulative={showCumulative}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Amortizações Extras</Text>
        <Text style={styles.label}>Data (YYYY-MM-DD)</Text>
        <TextInput
          value={newPrepayment.date?.toISOString().slice(0, 10)}
          onChangeText={(text) => {
            const parsed = new Date(text);
            if (!Number.isNaN(parsed.getTime())) {
              setNewPrepayment((prev) => ({ ...prev, date: parsed }));
            }
          }}
          style={styles.input}
          accessibilityLabel="Data da amortização extra"
        />
        <Text style={styles.label}>Valor (R$)</Text>
        <TextInput
          value={newPrepayment.amount ? String(newPrepayment.amount) : ''}
          onChangeText={(text) => {
            const parsed = parseCurrencyInput(text);
            setNewPrepayment((prev) => ({ ...prev, amount: parsed }));
          }}
          keyboardType="numeric"
          style={styles.input}
          accessibilityLabel="Valor da amortização extra"
        />
        <View style={styles.row}>
          <Pressable
            style={[styles.chip, newPrepayment.type === 'fixed_amount' && styles.chipActive]}
            onPress={() => setNewPrepayment((prev) => ({ ...prev, type: 'fixed_amount' }))}
            accessibilityRole="button"
            accessibilityState={{ selected: newPrepayment.type === 'fixed_amount' }}
            accessibilityLabel="Amortização por valor fixo"
          >
            <Text style={styles.chipText}>Valor fixo</Text>
          </Pressable>
          <Pressable
            style={[styles.chip, newPrepayment.type === 'percentage' && styles.chipActive]}
            onPress={() => setNewPrepayment((prev) => ({ ...prev, type: 'percentage' }))}
            accessibilityRole="button"
            accessibilityState={{ selected: newPrepayment.type === 'percentage' }}
            accessibilityLabel="Amortização por porcentagem do saldo"
          >
            <Text style={styles.chipText}>% do saldo</Text>
          </Pressable>
        </View>
        <View style={styles.row}>
          <Pressable
            style={[styles.chip, newPrepayment.strategy === 'reduce_term' && styles.chipActive]}
            onPress={() => setNewPrepayment((prev) => ({ ...prev, strategy: 'reduce_term' }))}
            accessibilityRole="button"
            accessibilityState={{ selected: newPrepayment.strategy === 'reduce_term' }}
            accessibilityLabel="Reduzir prazo"
          >
            <Text style={styles.chipText}>Reduzir prazo</Text>
          </Pressable>
          <Pressable
            style={[styles.chip, newPrepayment.strategy === 'reduce_payment' && styles.chipActive]}
            onPress={() => setNewPrepayment((prev) => ({ ...prev, strategy: 'reduce_payment' }))}
            accessibilityRole="button"
            accessibilityState={{ selected: newPrepayment.strategy === 'reduce_payment' }}
            accessibilityLabel="Reduzir parcela"
          >
            <Text style={styles.chipText}>Reduzir parcela</Text>
          </Pressable>
        </View>
        <Text style={styles.label}>Descrição (opcional)</Text>
        <TextInput
          value={newPrepayment.description ?? ''}
          onChangeText={(text) => setNewPrepayment((prev) => ({ ...prev, description: text }))}
          style={styles.input}
          placeholder="13º salário, bônus..."
          accessibilityLabel="Descrição da amortização extra"
        />
        <Pressable
          style={styles.primaryButton}
          onPress={handleAddPrepayment}
          accessibilityRole="button"
          accessibilityLabel="Adicionar amortização extra"
        >
          <Text style={styles.primaryButtonText}>Adicionar amortização</Text>
        </Pressable>

        {(scenario.prepayments ?? []).length > 0 && (
          <View style={styles.list}>
            {(scenario.prepayments ?? []).map((payment) => (
              <View key={payment.id} style={styles.listItemRow}>
                <View>
                  <Text style={styles.listTitle}>
                    {payment.date.toLocaleDateString('pt-BR')} • {formatCurrency(payment.amount)}
                  </Text>
                  <Text style={styles.listSubtitle}>
                    {payment.strategy === 'reduce_term' ? 'Reduzir prazo' : 'Reduzir parcela'}
                  </Text>
                </View>
                <Pressable
                  onPress={() => handleRemovePrepayment(payment.id)}
                  accessibilityRole="button"
                  accessibilityLabel="Remover amortização"
                  hitSlop={8}
                >
                  <Text style={styles.deleteText}>Remover</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Exportar</Text>
        <View style={styles.row}>
          <Pressable
            style={[styles.primaryButton, !isPremium && styles.primaryButtonDisabled]}
            onPress={() => handleExport('pdf')}
            accessibilityRole="button"
            accessibilityLabel="Exportar PDF"
          >
            <Text style={styles.primaryButtonText}>PDF</Text>
          </Pressable>
          <Pressable
            style={[styles.primaryButton, !isPremium && styles.primaryButtonDisabled]}
            onPress={() => handleExport('xlsx')}
            accessibilityRole="button"
            accessibilityLabel="Exportar XLSX"
          >
            <Text style={styles.primaryButtonText}>XLSX</Text>
          </Pressable>
          <Pressable
            style={[styles.primaryButton, !isPremium && styles.primaryButtonDisabled]}
            onPress={() => handleExport('csv')}
            accessibilityRole="button"
            accessibilityLabel="Exportar CSV"
          >
            <Text style={styles.primaryButtonText}>CSV</Text>
          </Pressable>
        </View>
      </View>

      {!premiumLoading && <AdBanner enabled={!isPremium} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 32,
    backgroundColor: '#F7F7F7',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16,
    color: '#1F2937',
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  label: {
    fontSize: 14,
    color: '#374151',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    alignItems: 'center',
  },
  inputFlex: {
    flex: 1,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  toggleButton: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  toggleButtonActive: {
    borderColor: '#2563EB',
    backgroundColor: '#DBEAFE',
  },
  toggleButtonText: {
    color: '#374151',
    fontWeight: '600',
  },
  toggleButtonTextActive: {
    color: '#1D4ED8',
  },
  chip: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
  },
  chipActive: {
    borderColor: '#2563EB',
    backgroundColor: '#DBEAFE',
  },
  chipText: {
    color: '#374151',
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#1D4ED8',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    rowGap: 6,
  },
  summaryLabel: {
    color: '#374151',
  },
  summaryValue: {
    fontWeight: '600',
    color: '#111827',
  },
  primaryButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    minHeight: 44,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    minHeight: 44,
  },
  secondaryButtonText: {
    color: '#374151',
    fontWeight: '600',
  },
  list: {
    gap: 8,
  },
  listItem: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 10,
  },
  listItemRow: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  listSubtitle: {
    fontSize: 12,
    color: '#6B7280',
  },
  deleteText: {
    color: '#DC2626',
    fontWeight: '600',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
  },
  warningText: {
    color: '#D97706',
    fontSize: 13,
  },
  tableMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  tableMetaText: {
    color: '#6B7280',
    fontSize: 12,
  },
});
