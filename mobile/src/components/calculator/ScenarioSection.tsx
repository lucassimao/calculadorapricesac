import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Scenario } from '../../types/loan';
import { formatCurrency } from '../../lib/calculations';
import { useTheme } from '../../lib/theme';

interface ScenarioSectionProps {
  scenario: Scenario;
  scenarios: Scenario[];
  onNameChange: (name: string) => void;
  onSave: () => void;
  onNew: () => void;
  onLoad: (scenario: Scenario) => void;
  onDelete: (id: string, name: string) => void;
}

export function ScenarioSection({
  scenario,
  scenarios,
  onNameChange,
  onSave,
  onNew,
  onLoad,
  onDelete,
}: ScenarioSectionProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.section,
        { backgroundColor: colors.backgroundSecondary, borderColor: colors.border },
      ]}
      testID="section-scenarios"
    >
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Cenário</Text>
      <Text style={[styles.label, { color: colors.textSecondary }]}>Nome do cenário</Text>
      <TextInput
        value={scenario.name}
        onChangeText={onNameChange}
        style={[
          styles.input,
          { backgroundColor: colors.background, borderColor: colors.border, color: colors.text },
        ]}
        placeholder="Cenário Principal"
        placeholderTextColor={colors.textTertiary}
        accessibilityLabel="Nome do cenário"
        testID="input-scenario-name"
      />
      <View style={styles.rowWrap}>
        <Pressable
          style={styles.primaryButton}
          onPress={onSave}
          testID="btn-save-scenario"
          accessibilityRole="button"
          accessibilityLabel="Salvar cenário"
        >
          <Text style={styles.primaryButtonText}>Salvar cenário</Text>
        </Pressable>
        <Pressable
          style={[styles.secondaryButton, { borderColor: colors.border }]}
          onPress={onNew}
          testID="btn-new-scenario"
          accessibilityRole="button"
          accessibilityLabel="Criar novo cenário"
        >
          <Text style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>Novo</Text>
        </Pressable>
      </View>
      {scenarios.length > 0 && (
        <View style={styles.list}>
          {scenarios.map((item, index) => (
            <View
              key={item.id}
              style={[styles.listItemRow, { borderBottomColor: colors.borderLight }]}
            >
              <Pressable
                style={styles.listItemContent}
                onPress={() => onLoad(item)}
                testID={`scenario-item-${index}`}
                accessibilityRole="button"
                accessibilityLabel={`Carregar cenário ${item.name}`}
              >
                <Text
                  style={[styles.listTitle, { color: colors.text }]}
                  testID={`scenario-item-title-${index}`}
                >
                  {item.name}
                </Text>
                <Text style={[styles.listSubtitle, { color: colors.textTertiary }]}>
                  {item.system} • {formatCurrency(item.principal)}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.deleteButton, { backgroundColor: colors.errorLight }]}
                onPress={() => onDelete(item.id, item.name)}
                accessibilityRole="button"
                accessibilityLabel={`Excluir cenário ${item.name}`}
              >
                <Text style={[styles.deleteButtonText, { color: colors.error }]}>X</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  secondaryButton: {
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontWeight: '600',
    fontSize: 14,
  },
  list: {
    gap: 8,
  },
  listItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  listItemContent: {
    flex: 1,
    gap: 2,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  listSubtitle: {
    fontSize: 12,
  },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
