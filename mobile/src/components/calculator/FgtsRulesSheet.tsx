import { useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FGTS_RULES_REVIEWED_LABEL, FGTS_RULES_SOURCE } from '../../lib/recurring-events';
import { useTheme } from '../../lib/theme';

type FgtsRulesSheetProps = {
  visible: boolean;
  onClose: () => void;
  showDownPayment?: boolean;
};

type RuleCardProps = {
  title: string;
  children: string;
  testID: string;
};

function RuleCard({ title, children, testID }: RuleCardProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[styles.ruleCard, { backgroundColor: colors.background, borderColor: colors.border }]}
      testID={testID}
    >
      <Text style={[styles.ruleTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.ruleText, { color: colors.textSecondary }]}>{children}</Text>
    </View>
  );
}

export function FgtsRulesSheet({ visible, onClose, showDownPayment = true }: FgtsRulesSheetProps) {
  const { colors } = useTheme();

  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay} testID="fgts-rules-sheet">
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          testID="fgts-rules-backdrop"
        />
        <View
          style={[styles.sheet, { backgroundColor: colors.backgroundSecondary }]}
          accessibilityViewIsModal
        >
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={[styles.eyebrow, { color: colors.primary }]}>REGRAS POR FINALIDADE</Text>
              <Text style={[styles.title, { color: colors.text }]}>Como usar o FGTS</Text>
            </View>
            <Pressable
              style={styles.closeButton}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Fechar regras do FGTS"
              hitSlop={8}
              testID="btn-close-fgts-rules"
            >
              <Text style={[styles.closeText, { color: colors.textSecondary }]}>×</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={[styles.intro, { color: colors.textSecondary }]}>
              Escolha a finalidade antes de programar o uso. Cada modalidade segue uma regra de
              frequência diferente.
            </Text>

            {showDownPayment ? (
              <RuleCard title="Entrada" testID="fgts-rule-down-payment">
                Uso único na contratação para compor a entrada e reduzir o valor financiado.
              </RuleCard>
            ) : null}
            <RuleCard title="Amortização ou liquidação" testID="fgts-rule-amortization">
              Abate o saldo devedor para reduzir prazo ou parcela. Entre utilizações, respeite o
              intervalo mínimo de 2 anos.
            </RuleCard>
            <RuleCard title="Pagamento de prestações" testID="fgts-rule-installment">
              Pode cobrir até 80% de 12 prestações consecutivas. É uma sequência mensal, não um uso
              bienal.
            </RuleCard>

            <View style={[styles.conditions, { backgroundColor: colors.primaryLight }]}>
              <Text style={[styles.conditionsTitle, { color: colors.text }]}>
                Principais condições
              </Text>
              <Text style={[styles.conditionText, { color: colors.textSecondary }]}>
                • Ter tempo mínimo de trabalho sob o regime do FGTS, somando os períodos.{`\n`}• Não
                possuir outro imóvel residencial no mesmo município ou região.{`\n`}• Usar em imóvel
                residencial urbano enquadrado nas regras vigentes do SFH.
              </Text>
            </View>

            <Text style={[styles.disclaimer, { color: colors.textTertiary }]}>
              Regras e limites podem mudar. Confirme seu enquadramento com o banco antes de contar
              com o recurso.
            </Text>
            <Pressable
              style={styles.sourceButton}
              onPress={() => void Linking.openURL(FGTS_RULES_SOURCE)}
              accessibilityRole="link"
              accessibilityLabel={`Ver orientação oficial do FGTS, consultada em ${FGTS_RULES_REVIEWED_LABEL}`}
              testID="fgts-rules-sheet-source"
            >
              <Text style={[styles.sourceText, { color: colors.primary }]}>
                Ver orientação oficial do FGTS, consultada em {FGTS_RULES_REVIEWED_LABEL}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export function FgtsRulesHelper({ showDownPayment = true }: { showDownPayment?: boolean }) {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);

  return (
    <>
      <Pressable
        style={styles.triggerButton}
        onPress={() => setVisible(true)}
        accessibilityRole="button"
        accessibilityLabel="Entenda as regras do FGTS por tipo de uso"
        testID="btn-open-fgts-rules"
      >
        <Text style={[styles.triggerText, { color: colors.primary }]}>
          Entenda as regras do FGTS por tipo de uso
        </Text>
      </Pressable>
      <FgtsRulesSheet
        visible={visible}
        onClose={() => setVisible(false)}
        showDownPayment={showDownPayment}
      />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: 'rgba(15, 23, 42, 0.48)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '88%',
    paddingTop: 18,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  headerCopy: {
    flex: 1,
    gap: 3,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
  },
  closeButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  closeText: {
    fontSize: 30,
    lineHeight: 32,
  },
  content: {
    gap: 12,
    paddingBottom: 32,
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  intro: {
    fontSize: 14,
    lineHeight: 20,
  },
  ruleCard: {
    borderRadius: 14,
    borderWidth: 1,
    gap: 5,
    padding: 14,
  },
  ruleTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  ruleText: {
    fontSize: 13,
    lineHeight: 19,
  },
  conditions: {
    borderRadius: 14,
    gap: 6,
    padding: 14,
  },
  conditionsTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  conditionText: {
    fontSize: 13,
    lineHeight: 20,
  },
  disclaimer: {
    fontSize: 12,
    lineHeight: 18,
  },
  sourceButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  sourceText: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  triggerButton: {
    alignItems: 'flex-start',
    justifyContent: 'center',
    minHeight: 44,
  },
  triggerText: {
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
