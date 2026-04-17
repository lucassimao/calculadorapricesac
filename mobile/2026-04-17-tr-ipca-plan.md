# TR/IPCA Monetary Correction — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add TR and IPCA monetary correction to the loan calculator so users can model Caixa SFH/SFI and IPCA+ mortgages accurately.

**Architecture:** Two new optional fields on `Scenario` (`indexType`, `indexRate`) feed a balance-correction step at the start of each amortization period. A new `bacen.ts` module auto-fetches the latest rate from BACEN's open API when the user picks an index. A new `IndexSelector` component renders the picker and rate input inside the existing calculator screen. All three export formats gain a conditional `Correção` column.

**Tech Stack:** React Native, Expo, Vitest (unit tests), BACEN Open Data API (api.bcb.gov.br)

---

### Task 1: Extend types

**Files:**
- Modify: `mobile/src/types/loan.ts`

- [ ] **Step 1: Add fields to `Scenario`**

In `mobile/src/types/loan.ts`, add to the `Scenario` interface after `registryFee?`:

```ts
  indexType?: 'TR' | 'IPCA';
  indexRate?: number;        // monthly %, e.g. 0.08 for 0.08% a.m.
```

- [ ] **Step 2: Add field to `ScheduleRow`**

In `mobile/src/types/loan.ts`, add to the `ScheduleRow` interface after `netPayment?`:

```ts
  indexCorrection?: number;  // amount added to balance by the index this period
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd mobile && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add mobile/src/types/loan.ts
git commit -m "feat(types): add indexType, indexRate, indexCorrection for monetary correction"
```

---

### Task 2: BACEN API client

**Files:**
- Create: `mobile/src/lib/bacen.ts`
- Create: `mobile/src/lib/__tests__/bacen.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `mobile/src/lib/__tests__/bacen.test.ts`:

```ts
import { describe, expect, it, vi, afterEach } from 'vitest';
import { fetchLatestTR, fetchLatestIPCA } from '../bacen';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchLatestTR', () => {
  it('parses rate and label from BACEN response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
      json: async () => [{ data: '01/03/2026', valor: '0.01723' }],
    }));
    const result = await fetchLatestTR();
    expect(result.rate).toBeCloseTo(0.01723, 5);
    expect(result.label).toBe('TR (mar/2026)');
  });

  it('throws on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('offline')));
    await expect(fetchLatestTR()).rejects.toThrow('offline');
  });
});

describe('fetchLatestIPCA', () => {
  it('parses rate and label from BACEN response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
      json: async () => [{ data: '01/02/2026', valor: '1.31' }],
    }));
    const result = await fetchLatestIPCA();
    expect(result.rate).toBeCloseTo(1.31, 2);
    expect(result.label).toBe('IPCA (fev/2026)');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd mobile && npx vitest run src/lib/__tests__/bacen.test.ts
```

Expected: FAIL — `Cannot find module '../bacen'`

- [ ] **Step 3: Implement `bacen.ts`**

Create `mobile/src/lib/bacen.ts`:

```ts
const MONTH_NAMES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

export interface BacenResult {
  rate: number;   // monthly %, e.g. 0.01723 for TR or 1.31 for IPCA
  label: string;  // e.g. "TR (mar/2026)" or "IPCA (fev/2026)"
}

function parseResult(prefix: string, json: Array<{ data: string; valor: string }>): BacenResult {
  const item = json[0];
  const rate = parseFloat(item.valor.replace(',', '.'));
  const parts = item.data.split('/');
  const month = parseInt(parts[1], 10) - 1;
  const year = parts[2];
  return { rate, label: `${prefix} (${MONTH_NAMES[month]}/${year})` };
}

export async function fetchLatestTR(): Promise<BacenResult> {
  const res = await fetch(
    'https://api.bcb.gov.br/dados/serie/bcdata.sgs.226/dados/ultimos/1?formato=json',
  );
  return parseResult('TR', await res.json());
}

export async function fetchLatestIPCA(): Promise<BacenResult> {
  const res = await fetch(
    'https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados/ultimos/1?formato=json',
  );
  return parseResult('IPCA', await res.json());
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd mobile && npx vitest run src/lib/__tests__/bacen.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add mobile/src/lib/bacen.ts mobile/src/lib/__tests__/bacen.test.ts
git commit -m "feat(bacen): add TR and IPCA rate fetch from BACEN open API"
```

---

### Task 3: Update amortization engine

**Files:**
- Modify: `mobile/src/lib/calculations.ts`
- Modify: `mobile/src/lib/__tests__/calculations.test.ts`

- [ ] **Step 1: Write the failing tests**

In `mobile/src/lib/__tests__/calculations.test.ts`, append:

```ts
describe('generateAmortizationSchedule with monetary correction', () => {
  const indexedBase: Scenario = {
    id: 'test',
    name: 'Indexado',
    system: 'PRICE',
    principal: 10000,
    rate: 1,
    rateType: 'monthly',
    term: 12,
    termUnit: 'months',
    startDate: new Date(2026, 0, 1),
    dueDay: 5,
    prepayments: [],
    indexType: 'TR',
    indexRate: 0.5,
  };

  it('PRICE+TR: first row has correct indexCorrection and interest on corrected balance', () => {
    const schedule = generateAmortizationSchedule(indexedBase);
    // balance corrected: 10000 * 0.005 = 50
    expect(schedule[1].indexCorrection).toBeCloseTo(50, 2);
    // interest on corrected balance: 10050 * 0.01 = 100.50
    expect(schedule[1].interest).toBeCloseTo(100.5, 2);
  });

  it('PRICE+TR: balance reaches zero by last installment', () => {
    const schedule = generateAmortizationSchedule(indexedBase);
    expect(schedule[schedule.length - 1].balance).toBeCloseTo(0, 1);
  });

  it('SAC+IPCA: first row has correct indexCorrection and amortization', () => {
    const schedule = generateAmortizationSchedule({
      ...indexedBase,
      system: 'SAC',
      indexType: 'IPCA',
      indexRate: 0.5,
    });
    // balance corrected: 10000 * 0.005 = 50 -> balance = 10050
    expect(schedule[1].indexCorrection).toBeCloseTo(50, 2);
    // fixedAmortization = 10050 / 12 = 837.50
    expect(schedule[1].amortization).toBeCloseTo(837.5, 1);
    // interest = 10050 * 0.01 = 100.50
    expect(schedule[1].interest).toBeCloseTo(100.5, 2);
  });

  it('SAC+IPCA: balance reaches zero by last installment', () => {
    const schedule = generateAmortizationSchedule({
      ...indexedBase,
      system: 'SAC',
      indexType: 'IPCA',
    });
    expect(schedule[schedule.length - 1].balance).toBeCloseTo(0, 1);
  });

  it('no indexCorrection field when indexType is absent', () => {
    const schedule = generateAmortizationSchedule({ ...indexedBase, indexType: undefined });
    expect(schedule[1].indexCorrection).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd mobile && npx vitest run src/lib/__tests__/calculations.test.ts
```

Expected: 5 new tests FAIL — `indexCorrection` is undefined, balance doesn't reach zero.

- [ ] **Step 3: Update the PRICE loop in `calculations.ts`**

In `mobile/src/lib/calculations.ts`, inside the `if (scenario.system === 'PRICE')` block, replace the loop opening:

```ts
  if (scenario.system === 'PRICE') {
    let fixedPayment = calculatePricePayment(balance, monthlyRate, termMonths);
    for (let i = 1; i <= termMonths; i++) {
      const interest = balance * monthlyRate;
```

with:

```ts
  if (scenario.system === 'PRICE') {
    let fixedPayment = calculatePricePayment(balance, monthlyRate, termMonths);
    for (let i = 1; i <= termMonths; i++) {
      const monthlyIndexRate = (scenario.indexRate ?? 0) / 100;
      const indexCorrection = scenario.indexType
        ? roundCents(balance * monthlyIndexRate)
        : undefined;
      if (indexCorrection) {
        balance += indexCorrection;
        const remaining = termMonths - i + 1;
        if (remaining > 0) {
          fixedPayment = calculatePricePayment(balance, monthlyRate, remaining);
        }
      }
      const interest = balance * monthlyRate;
```

- [ ] **Step 4: Add `indexCorrection` to the PRICE `schedule.push` call**

In the same PRICE block, find the `schedule.push({` call and add `indexCorrection` after `netPayment`:

```ts
      schedule.push({
        installmentNumber: i,
        date: installmentDate,
        payment: roundCents(payment),
        interest: roundCents(interest),
        amortization: roundCents(amortization),
        balance: roundCents(balance < 0 ? 0 : balance),
        prepaymentAmount: prepaymentAmount > 0 ? roundCents(prepaymentAmount) : undefined,
        prepaymentDescription,
        insurance: insurance > 0 ? roundCents(insurance) : undefined,
        adminFee: adminFee > 0 ? roundCents(adminFee) : undefined,
        extraCosts: extraCosts > 0 ? roundCents(extraCosts) : undefined,
        totalCost: roundCents(payment + extraCosts),
        fgtsAmortization: fgtsAmortization > 0 ? roundCents(fgtsAmortization) : undefined,
        fgtsSubsidy: fgtsSubsidy > 0 ? roundCents(fgtsSubsidy) : undefined,
        netPayment: roundCents(netPayment),
        indexCorrection,
      });
```

- [ ] **Step 5: Update the SAC loop in `calculations.ts`**

In the `else` (SAC) block, replace the loop opening:

```ts
    let fixedAmortization = calculateSacAmortization(balance, termMonths);
    for (let i = 1; i <= termMonths; i++) {
      const interest = balance * monthlyRate;
      let amortization = fixedAmortization;
```

with:

```ts
    let fixedAmortization = calculateSacAmortization(balance, termMonths);
    for (let i = 1; i <= termMonths; i++) {
      const monthlyIndexRate = (scenario.indexRate ?? 0) / 100;
      const indexCorrection = scenario.indexType
        ? roundCents(balance * monthlyIndexRate)
        : undefined;
      if (indexCorrection) {
        balance += indexCorrection;
        const remaining = termMonths - i + 1;
        if (remaining > 0) {
          fixedAmortization = calculateSacAmortization(balance, remaining);
        }
      }
      const interest = balance * monthlyRate;
      let amortization = fixedAmortization;
```

- [ ] **Step 6: Add `indexCorrection` to the SAC `schedule.push` call**

Same as Step 4 but in the SAC block — add `indexCorrection` to `schedule.push`.

- [ ] **Step 7: Run all tests to verify they pass**

```bash
cd mobile && npx vitest run src/lib/__tests__/calculations.test.ts
```

Expected: all tests PASS, including the 5 new ones and all pre-existing ones.

- [ ] **Step 8: Commit**

```bash
git add mobile/src/lib/calculations.ts mobile/src/lib/__tests__/calculations.test.ts
git commit -m "feat(calc): apply TR/IPCA balance correction per period in PRICE and SAC"
```

---

### Task 4: IndexSelector component

**Files:**
- Create: `mobile/src/components/calculator/IndexSelector.tsx`
- Modify: `mobile/src/components/calculator/index.ts`

- [ ] **Step 1: Create `IndexSelector.tsx`**

Create `mobile/src/components/calculator/IndexSelector.tsx`:

```tsx
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Scenario } from '../../types/loan';
import { useTheme } from '../../lib/theme';

interface IndexSelectorProps {
  indexType: Scenario['indexType'];
  indexRateText: string;
  indexRateLabel: string | null;
  loading: boolean;
  onIndexTypeChange: (type: Scenario['indexType']) => void;
  onIndexRateTextChange: (text: string) => void;
}

export function IndexSelector({
  indexType,
  indexRateText,
  indexRateLabel,
  loading,
  onIndexTypeChange,
  onIndexRateTextChange,
}: IndexSelectorProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.section,
        { backgroundColor: colors.backgroundSecondary, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Correção Monetária</Text>
      <View style={styles.toggleRow}>
        {([undefined, 'TR', 'IPCA'] as const).map((type) => (
          <Pressable
            key={type ?? 'none'}
            onPress={() => onIndexTypeChange(type)}
            style={[
              styles.toggleButton,
              { borderColor: colors.border },
              indexType === type && {
                backgroundColor: colors.primaryLight,
                borderColor: colors.primary,
              },
            ]}
            accessibilityRole="radio"
            accessibilityState={{ selected: indexType === type }}
            accessibilityLabel={`Correção ${type ?? 'Nenhuma'}`}
          >
            <Text
              style={[
                styles.toggleButtonText,
                { color: colors.textSecondary },
                indexType === type && { color: colors.primary },
              ]}
            >
              {type ?? 'Nenhuma'}
            </Text>
          </Pressable>
        ))}
      </View>
      {indexType && (
        <>
          <View style={styles.labelRow}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              {indexRateLabel ?? `Taxa ${indexType} (% a.m.)`}
            </Text>
            {loading && <ActivityIndicator size="small" color={colors.primary} />}
          </View>
          <TextInput
            value={indexRateText}
            onChangeText={onIndexRateTextChange}
            keyboardType="numeric"
            style={[
              styles.input,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            placeholder={loading ? 'Buscando...' : 'Informe a taxa mensal do índice'}
            placeholderTextColor={colors.textTertiary}
            accessibilityLabel={`Taxa ${indexType}`}
            testID="input-index-rate"
            nativeID="input-index-rate"
          />
          <Text style={[styles.helperText, { color: colors.textTertiary }]}>
            {indexType === 'TR'
              ? 'Taxa Referencial aplicada mensalmente ao saldo devedor (padrão Caixa SFH/SFI).'
              : 'IPCA aplicado mensalmente ao saldo devedor (padrão Caixa IPCA+).'}
          </Text>
        </>
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
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  toggleButtonText: {
    fontWeight: '600',
    fontSize: 14,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  helperText: {
    fontSize: 12,
    lineHeight: 16,
  },
});
```

- [ ] **Step 2: Export from barrel**

In `mobile/src/components/calculator/index.ts`, add:

```ts
export { IndexSelector } from './IndexSelector';
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd mobile && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add mobile/src/components/calculator/IndexSelector.tsx mobile/src/components/calculator/index.ts
git commit -m "feat(ui): add IndexSelector component for TR/IPCA correction picker"
```

---

### Task 5: Wire IndexSelector into calculator screen

**Files:**
- Modify: `mobile/app/(tabs)/calculator.tsx`

- [ ] **Step 1: Import BACEN functions and IndexSelector**

At the top of `mobile/app/(tabs)/calculator.tsx`, add these imports alongside existing ones:

```ts
import { fetchLatestIPCA, fetchLatestTR } from '../../src/lib/bacen';
import { IndexSelector } from '../../src/components/calculator';
```

- [ ] **Step 2: Add state for index rate UI**

Inside the `CalculatorScreen` component, after the existing `const [rateText, setRateText] = useState('1,2');` line (around line 180), add:

```ts
const [indexRateText, setIndexRateText] = useState('');
const [indexRateLabel, setIndexRateLabel] = useState<string | null>(null);
const [indexRateLoading, setIndexRateLoading] = useState(false);
const indexRateCache = useRef<Map<string, { rate: number; label: string }>>(new Map());
```

- [ ] **Step 3: Add BACEN fetch effect**

After the existing `useEffect` blocks (before the `return` statement), add:

```ts
useEffect(() => {
  const { indexType } = scenario;
  if (!indexType) return;

  const cached = indexRateCache.current.get(indexType);
  if (cached) {
    setIndexRateText(String(cached.rate).replace('.', ','));
    setIndexRateLabel(cached.label);
    return;
  }

  setIndexRateLoading(true);
  const fetcher = indexType === 'TR' ? fetchLatestTR : fetchLatestIPCA;
  fetcher()
    .then(({ rate, label }) => {
      indexRateCache.current.set(indexType, { rate, label });
      setScenario((prev) => ({ ...prev, indexRate: rate }));
      setIndexRateText(String(rate).replace('.', ','));
      setIndexRateLabel(label);
    })
    .catch(() => {
      setIndexRateLabel(null);
    })
    .finally(() => {
      setIndexRateLoading(false);
    });
}, [scenario.indexType]);
```

- [ ] **Step 4: Reset index state when loading a saved scenario**

In the `handleLoadScenario` function (around line 325), after `setRateText(...)`, add:

```ts
setIndexRateText(target.indexRate != null ? String(target.indexRate).replace('.', ',') : '');
setIndexRateLabel(null);
```

- [ ] **Step 5: Render IndexSelector in JSX**

In the JSX, find the `<SystemSelector` block (around line 613). Add `<IndexSelector` immediately after the closing `/>` of `<SystemSelector`:

```tsx
<IndexSelector
  indexType={scenario.indexType}
  indexRateText={indexRateText}
  indexRateLabel={indexRateLabel}
  loading={indexRateLoading}
  onIndexTypeChange={(type) => {
    setIndexRateText('');
    setIndexRateLabel(null);
    setScenario((prev) => ({ ...prev, indexType: type, indexRate: undefined }));
  }}
  onIndexRateTextChange={(text) => {
    setIndexRateText(text);
    const value = parseFloat(text.replace(',', '.'));
    setScenario((prev) => ({ ...prev, indexRate: Number.isNaN(value) ? undefined : value }));
  }}
/>
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd mobile && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add "mobile/app/(tabs)/calculator.tsx"
git commit -m "feat(calculator): wire IndexSelector with BACEN auto-fetch for TR/IPCA"
```

---

### Task 6: Add correction column to exports

**Files:**
- Modify: `mobile/src/lib/exports/csv.ts`
- Modify: `mobile/src/lib/exports/xlsx.ts`
- Modify: `mobile/src/lib/exports/pdf.ts`

- [ ] **Step 1: Update `csv.ts`**

In `mobile/src/lib/exports/csv.ts`, replace the `header` array definition:

```ts
  const header = [
    'N°',
    'Data',
    'Valor Parcela',
    'Juros',
    'Amortização',
    'Saldo',
    'Custos',
    'Extra',
    'FGTS Amortização',
    'FGTS Parcela',
    'Líquido',
  ];
```

with:

```ts
  const header = [
    'N°',
    'Data',
    'Valor Parcela',
    'Juros',
    'Amortização',
    'Saldo',
    'Custos',
    'Extra',
    'FGTS Amortização',
    'FGTS Parcela',
    'Líquido',
    ...(scenario.indexType ? ['Correção'] : []),
  ];
```

Replace the `buildCsvLine([` row mapping:

```ts
      buildCsvLine([
        row.installmentNumber,
        formatDateBR(row.date),
        formatCsvNumber(row.payment),
        formatCsvNumber(row.interest),
        formatCsvNumber(row.amortization),
        formatCsvNumber(row.balance),
        formatCsvNumber(row.extraCosts ?? 0),
        formatCsvNumber(row.prepaymentAmount ?? 0),
        formatCsvNumber(row.fgtsAmortization ?? 0),
        formatCsvNumber(row.fgtsSubsidy ?? 0),
        formatCsvNumber(row.netPayment ?? row.payment),
      ]),
```

with:

```ts
      buildCsvLine([
        row.installmentNumber,
        formatDateBR(row.date),
        formatCsvNumber(row.payment),
        formatCsvNumber(row.interest),
        formatCsvNumber(row.amortization),
        formatCsvNumber(row.balance),
        formatCsvNumber(row.extraCosts ?? 0),
        formatCsvNumber(row.prepaymentAmount ?? 0),
        formatCsvNumber(row.fgtsAmortization ?? 0),
        formatCsvNumber(row.fgtsSubsidy ?? 0),
        formatCsvNumber(row.netPayment ?? row.payment),
        ...(scenario.indexType ? [formatCsvNumber(row.indexCorrection ?? 0)] : []),
      ]),
```

After the `lines.push(buildCsvLine(['Prazo', ...]))` line in the summary section, add:

```ts
    if (scenario.indexType) {
      lines.push(buildCsvLine(['Índice de Correção', scenario.indexType]));
      lines.push(
        buildCsvLine([
          'Taxa de Correção (% a.m.)',
          `${formatCsvNumber(scenario.indexRate ?? 0)}%`,
        ]),
      );
    }
```

- [ ] **Step 2: Update `xlsx.ts`**

In `mobile/src/lib/exports/xlsx.ts`, replace the header row:

```ts
    [
      'N°',
      'Data',
      'Valor Parcela',
      'Juros',
      'Amortização',
      'Saldo',
      'Custos',
      'Extra',
      'FGTS Amortização',
      'FGTS Parcela',
      'Líquido',
    ],
```

with:

```ts
    [
      'N°',
      'Data',
      'Valor Parcela',
      'Juros',
      'Amortização',
      'Saldo',
      'Custos',
      'Extra',
      'FGTS Amortização',
      'FGTS Parcela',
      'Líquido',
      ...(scenario.indexType ? ['Correção'] : []),
    ],
```

Replace the data row mapping:

```ts
    ...rows.map((row) => [
      row.installmentNumber,
      formatDateBR(row.date),
      row.payment,
      row.interest,
      row.amortization,
      row.balance,
      row.extraCosts ?? 0,
      row.prepaymentAmount ?? 0,
      row.fgtsAmortization ?? 0,
      row.fgtsSubsidy ?? 0,
      row.netPayment ?? row.payment,
    ]),
```

with:

```ts
    ...rows.map((row) => [
      row.installmentNumber,
      formatDateBR(row.date),
      row.payment,
      row.interest,
      row.amortization,
      row.balance,
      row.extraCosts ?? 0,
      row.prepaymentAmount ?? 0,
      row.fgtsAmortization ?? 0,
      row.fgtsSubsidy ?? 0,
      row.netPayment ?? row.payment,
      ...(scenario.indexType ? [row.indexCorrection ?? 0] : []),
    ]),
```

After the `['Prazo', formatExportTerm(...)]` line in the summary push, add:

```ts
      ...(scenario.indexType
        ? ([
            ['Índice de Correção', scenario.indexType],
            ['Taxa de Correção (% a.m.)', `${(scenario.indexRate ?? 0).toFixed(5)}%`],
          ] as (string | number)[][])
        : []),
```

- [ ] **Step 3: Update `pdf.ts`**

In `mobile/src/lib/exports/pdf.ts`, replace the `<thead>` row:

```html
            <tr>
              <th>N°</th>
              <th>Data</th>
              <th>Valor Parcela</th>
              <th>Juros</th>
              <th>Amortização</th>
              <th>Saldo</th>
              <th>Custos</th>
              <th>Extra</th>
              <th>FGTS Amort.</th>
              <th>FGTS Parcela</th>
              <th>Líquido</th>
            </tr>
```

with:

```ts
            <tr>
              <th>N°</th>
              <th>Data</th>
              <th>Valor Parcela</th>
              <th>Juros</th>
              <th>Amortização</th>
              <th>Saldo</th>
              <th>Custos</th>
              <th>Extra</th>
              <th>FGTS Amort.</th>
              <th>FGTS Parcela</th>
              <th>Líquido</th>
              ${scenario.indexType ? '<th>Correção</th>' : ''}
            </tr>
```

In the `tableRows` map, replace:

```ts
        <td>${formatCurrency(row.netPayment ?? row.payment)}</td>
      </tr>
```

with:

```ts
        <td>${formatCurrency(row.netPayment ?? row.payment)}</td>
        ${scenario.indexType ? `<td>${formatCurrency(row.indexCorrection ?? 0)}</td>` : ''}
      </tr>
```

After `<p><strong>Prazo:</strong> ...` in `summarySection`, add:

```ts
        ${scenario.indexType ? `
        <p><strong>Índice de Correção:</strong> ${scenario.indexType}</p>
        <p><strong>Taxa de Correção (% a.m.):</strong> ${(scenario.indexRate ?? 0).toFixed(5).replace('.', ',')}%</p>` : ''}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd mobile && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Run the full test suite**

```bash
cd mobile && npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add mobile/src/lib/exports/csv.ts mobile/src/lib/exports/xlsx.ts mobile/src/lib/exports/pdf.ts
git commit -m "feat(exports): add Correção column and index summary to CSV, XLSX, PDF"
```
