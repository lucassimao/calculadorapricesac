'use client';

import styles from './Simulator.module.css';
import type { SimulatorInputs } from './types';

const brl = new Intl.NumberFormat('pt-BR');

function parseNumber(raw: string): number {
  const digits = raw.replace(/\D/g, '');
  return digits ? Number(digits) : 0;
}

interface Props {
  value: SimulatorInputs;
  onChange: (next: SimulatorInputs) => void;
  errors: string[];
}

export function InputsForm({ value, onChange, errors }: Props) {
  const set = (patch: Partial<SimulatorInputs>) => onChange({ ...value, ...patch });

  return (
    <div className={styles.card}>
      <div className={styles.fields}>
        <label className={styles.field}>
          <span className={styles.label}>Valor do imóvel</span>
          <span className={styles.inputWrap}>
            <span className={styles.affix}>R$</span>
            <input
              className={styles.input}
              inputMode="numeric"
              aria-label="Valor do imóvel"
              value={brl.format(value.propertyValue)}
              onChange={(e) => set({ propertyValue: parseNumber(e.target.value) })}
            />
          </span>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Entrada</span>
          <span className={styles.inputWrap}>
            <span className={styles.affix}>R$</span>
            <input
              className={styles.input}
              inputMode="numeric"
              aria-label="Entrada"
              value={brl.format(value.downPayment)}
              onChange={(e) => set({ downPayment: parseNumber(e.target.value) })}
            />
          </span>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Taxa de juros</span>
          <span className={styles.inputWrap}>
            <input
              className={styles.input}
              inputMode="decimal"
              aria-label="Taxa de juros anual"
              value={String(value.annualRate).replace('.', ',')}
              onChange={(e) => set({ annualRate: Number(e.target.value.replace(',', '.')) || 0 })}
            />
            <span className={styles.affix}>% a.a.</span>
          </span>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Prazo</span>
          <span className={styles.inputWrap}>
            <input
              className={styles.input}
              inputMode="numeric"
              aria-label="Prazo em anos"
              value={String(value.termYears)}
              onChange={(e) => set({ termYears: parseNumber(e.target.value) })}
            />
            <span className={styles.affix}>anos</span>
          </span>
        </label>
      </div>
      {errors.length > 0 && (
        <p className={styles.error} role="alert">{errors[0]}</p>
      )}
    </div>
  );
}
