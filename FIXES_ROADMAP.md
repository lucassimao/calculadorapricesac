# Fixes & Improvements Roadmap

This roadmap documents bugs, improvements, and enhancements identified during code review.
Organized by priority and grouped into sprints for systematic implementation.

---

## Priority Legend

- 🔴 **Critical** - Bugs that cause incorrect calculations or data
- 🟠 **High** - Significant UX issues or potential policy violations
- 🟡 **Medium** - Quality improvements and minor bugs
- 🟢 **Low** - Nice-to-have enhancements

---

## Sprint 1: Critical Bug Fixes

### 1.1 🔴 Fix `addMonths` date overflow bug
**File:** `src/lib/calculations.ts:116-121`

**Problem:** When adding months to dates at end of month (e.g., Jan 31 + 1 month), JavaScript's `setMonth` overflows to March 3rd instead of Feb 28/29.

**Impact:** Payment schedule dates can be wrong for loans starting on 29th, 30th, or 31st.

**Solution:**
```typescript
function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  const targetMonth = next.getMonth() + months;
  const targetYear = next.getFullYear() + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;

  // Get last day of target month
  const lastDayOfMonth = new Date(targetYear, normalizedMonth + 1, 0).getDate();

  // Clamp day to last day of target month
  next.setFullYear(targetYear);
  next.setMonth(normalizedMonth);
  next.setDate(Math.min(date.getDate(), lastDayOfMonth));

  return next;
}
```

**Tests to add:**
- Jan 31 + 1 month = Feb 28 (or 29 in leap year)
- Jan 31 + 2 months = Mar 31
- Mar 31 + 1 month = Apr 30

**Estimate:** 1 hour

---

### 1.2 🔴 Fix timezone date parsing issue
**File:** `app/(tabs)/calculator.tsx:591-595`

**Problem:** `new Date('2026-01-05')` parses as UTC midnight, which in negative UTC timezones becomes the previous day.

**Impact:** Start dates may be off by one day for users in certain timezones.

**Solution:**
```typescript
// Option A: Parse as local date
function parseLocalDate(text: string): Date | null {
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, year, month, day] = match;
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
}

// Option B: Append time to force local interpretation
const parsed = new Date(text + 'T00:00:00');
```

**Estimate:** 30 minutes

---

## Sprint 2: UX Critical Issues

### 2.1 🟠 Reduce excessive ad placements
**File:** `app/(tabs)/calculator.tsx`

**Problem:** 9 AdBanner components on a single screen is excessive and may violate AdMob policies.

**Impact:** Poor UX, potential policy violations, accidental clicks.

**Current placements (9):**
- Line 333, 384, 454, 621, 645, 713, 719, 755, 873, 1006, 1104, 1142

**Solution:** Reduce to 3-4 strategic placements:
1. After summary section
2. After amortization table
3. After FGTS section
4. Bottom of screen

**Estimate:** 30 minutes

---

### 2.2 🟠 Sync quick comparison with base parameters
**File:** `app/(tabs)/comparison.tsx:41-45`

**Problem:** Quick comparison scenarios use hardcoded defaults, don't update when user changes base principal/rate/term.

**Solution:**
```typescript
// Update quickCases when base changes
useEffect(() => {
  setQuickCases(prev => prev.map(c => ({
    ...c,
    principal: base.principal,
    // Keep individual rate/term/downPayment customizations
  })));
}, [base.principal]);
```

**Estimate:** 1 hour

---

### 2.3 🟡 Fix property mode principal display
**File:** `app/(tabs)/calculator.tsx:474-502`

**Problem:** When in property mode, changing propertyValue or downPayment doesn't update the displayed principalText field.

**Solution:** Add computed display or auto-update principalText:
```typescript
const displayedPrincipal = isPropertyMode
  ? (scenario.propertyValue ?? 0) - (scenario.downPayment ?? 0)
  : scenario.principal;

// Or show a read-only computed field in property mode
```

**Estimate:** 30 minutes

---

## Sprint 3: Code Quality

### 3.1 🟡 Extract duplicated utility functions
**Files:** `calculator.tsx:33-47`, `comparison.tsx:23-37`

**Problem:** `parseCurrencyInput` and `parseNumberInput` are duplicated.

**Solution:** Create `src/lib/utils.ts`:
```typescript
export function parseCurrencyInput(value: string): number {
  if (!value.trim()) return 0;
  const cleaned = value
    .replace(/\s/g, '')
    .replace(/R\$/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const parsed = Number.parseFloat(cleaned);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function parseNumberInput(value: string): number {
  const parsed = Number.parseFloat(value.replace(',', '.'));
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function parseLocalDate(text: string): Date | null {
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, year, month, day] = match;
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
}
```

**Estimate:** 30 minutes

---

### 3.2 🟡 Split calculator.tsx into smaller components
**File:** `app/(tabs)/calculator.tsx` (1335 lines)

**Problem:** Single file is too large, hard to maintain.

**Solution:** Extract into components:
```
src/components/
├── calculator/
│   ├── ScenarioManager.tsx      (~80 lines)
│   ├── SystemSelector.tsx       (~70 lines)
│   ├── LoanParameters.tsx       (~150 lines)
│   ├── CostsSection.tsx         (~100 lines)
│   ├── PrepaymentSection.tsx    (~120 lines)
│   ├── FgtsSection.tsx          (~130 lines)
│   ├── SummarySection.tsx       (~80 lines)
│   ├── ExportSection.tsx        (~50 lines)
│   └── PremiumSection.tsx       (~80 lines)
```

**Estimate:** 3-4 hours

---

### 3.3 🟢 Remove unused PrepaymentType values
**File:** `src/types/loan.ts:9`

**Problem:** `available_monthly` and `one_time` are defined but never used.

**Solution:** Either remove them or implement them:
```typescript
// Option A: Remove unused
export type PrepaymentType = 'fixed_amount' | 'percentage';

// Option B: Document as future features
export type PrepaymentType =
  | 'fixed_amount'
  | 'percentage'
  // Future: | 'available_monthly' | 'one_time';
```

**Estimate:** 15 minutes

---

## Sprint 4: UX Enhancements

### 4.1 🟡 Add chart legend
**File:** `src/components/LoanCharts.tsx`

**Problem:** "Juros vs Amortização" chart has no legend explaining colors.

**Solution:**
```typescript
<View style={styles.legend}>
  <View style={styles.legendItem}>
    <View style={[styles.legendColor, { backgroundColor: '#F97316' }]} />
    <Text style={styles.legendText}>Juros</Text>
  </View>
  <View style={styles.legendItem}>
    <View style={[styles.legendColor, { backgroundColor: '#22C55E' }]} />
    <Text style={styles.legendText}>Amortização</Text>
  </View>
</View>
```

**Estimate:** 30 minutes

---

### 4.2 🟡 Show prepayment/FGTS details in table
**File:** `src/components/AmortizationTable.tsx`

**Problem:** Table doesn't display prepaymentAmount, fgtsAmortization, or fgtsSubsidy even though they're calculated.

**Solution:** Add optional columns or expandable rows showing extra details.

**Estimate:** 1-2 hours

---

### 4.3 🟡 Add scenario deletion
**File:** `app/(tabs)/calculator.tsx`

**Problem:** Users can save scenarios but cannot delete them.

**Solution:** Add delete button to scenario list items with confirmation:
```typescript
const handleDeleteScenario = async (id: string) => {
  Alert.alert(
    'Excluir cenário',
    'Tem certeza que deseja excluir este cenário?',
    [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          const nextList = scenarios.filter(s => s.id !== id);
          await persistScenarios(nextList);
        }
      },
    ]
  );
};
```

**Estimate:** 30 minutes

---

### 4.4 🟢 Improve date input UX
**File:** `app/(tabs)/calculator.tsx:587`

**Problem:** Date format YYYY-MM-DD is unfamiliar to Brazilian users (DD/MM/YYYY).

**Options:**
1. Use a date picker component (e.g., `@react-native-community/datetimepicker`)
2. Accept both formats and auto-detect
3. Use masked input with DD/MM/YYYY format

**Estimate:** 1-2 hours (depending on approach)

---

### 4.5 🟢 Add loading state for calculations
**File:** `app/(tabs)/calculator.tsx`

**Problem:** No loading indicator when recalculating large schedules.

**Solution:**
```typescript
const [calculating, setCalculating] = useState(false);

// Wrap calculation in useEffect with debounce
useEffect(() => {
  setCalculating(true);
  const timeout = setTimeout(() => {
    // calculations...
    setCalculating(false);
  }, 100);
  return () => clearTimeout(timeout);
}, [scenario]);
```

**Estimate:** 30 minutes

---

## Sprint 5: Advanced Improvements

### 5.1 🟢 Improve CET calculation accuracy
**File:** `src/lib/calculations.ts:366-392`

**Problem:** CET calculation assumes regular monthly periods; edge cases with early termination may be slightly inaccurate.

**Solution:** Use actual dates for period calculations in IRR/NPV.

**Estimate:** 2-3 hours

---

### 5.2 🟢 Allow zero-rate (interest-free) loans
**File:** `src/lib/calculations.ts:427-429`

**Problem:** Validation rejects rate <= 0, but `calculatePricePayment` handles rate = 0 correctly.

**Solution:** Allow rate = 0 for interest-free financing simulation:
```typescript
if (scenario.rate < 0) {
  errors.push('Taxa de juros não pode ser negativa.');
}
// Remove the <= 0 check, allow zero
```

**Estimate:** 15 minutes

---

### 5.3 🟢 Environment-based AdMob IDs
**File:** `app.json`

**Problem:** Test AdMob IDs are hardcoded. Need different IDs for production.

**Solution:** Use EAS environment variables or app.config.js:
```javascript
// app.config.js
export default {
  // ...
  plugins: [
    [
      'react-native-google-mobile-ads',
      {
        androidAppId: process.env.ADMOB_ANDROID_ID ?? 'ca-app-pub-3940256099942544~3347511713',
        iosAppId: process.env.ADMOB_IOS_ID ?? 'ca-app-pub-3940256099942544~1458002511',
      },
    ],
  ],
};
```

**Estimate:** 30 minutes

---

## Implementation Schedule

| Sprint | Focus | Items | Estimated Time |
|--------|-------|-------|----------------|
| **Sprint 1** | Critical Bugs | 1.1, 1.2 | 1.5 hours |
| **Sprint 2** | UX Critical | 2.1, 2.2, 2.3 | 2 hours |
| **Sprint 3** | Code Quality | 3.1, 3.2, 3.3 | 4-5 hours |
| **Sprint 4** | UX Enhancements | 4.1-4.5 | 4-5 hours |
| **Sprint 5** | Advanced | 5.1-5.3 | 3-4 hours |

**Total Estimated Time:** 15-18 hours

---

## Testing Checklist

After each sprint, verify:

- [ ] All existing tests pass (`npm test`)
- [ ] Lint passes (`npm run lint`)
- [ ] TypeScript compiles (`npx tsc --noEmit`)
- [ ] Maestro UI tests pass (`npm run ui:maestro`)
- [ ] Manual testing on iOS and Android

---

## Verification Tests to Add

### For Sprint 1 (Date fixes):
```typescript
describe('addMonths edge cases', () => {
  it('handles end-of-month overflow', () => {
    const jan31 = new Date(2026, 0, 31);
    const result = addMonths(jan31, 1);
    expect(result.getMonth()).toBe(1); // February
    expect(result.getDate()).toBeLessThanOrEqual(28);
  });

  it('handles leap year', () => {
    const jan31 = new Date(2024, 0, 31); // 2024 is leap year
    const result = addMonths(jan31, 1);
    expect(result.getDate()).toBe(29);
  });
});
```

### For Sprint 2 (Quick comparison):
```typescript
describe('quick comparison sync', () => {
  it('updates scenarios when base principal changes', () => {
    // Test that changing base.principal updates quickCases
  });
});
```

---

## Notes

- Sprints 1-2 should be completed before any app store submission
- Sprint 3 improves maintainability for future development
- Sprints 4-5 are post-launch enhancements
- All changes should maintain backward compatibility with saved scenarios
