import styles from './Simulator.module.css';
import { formatCurrency } from '@loan-engine/calculations';
import type { LoanSummary } from '@loan-engine/loan';
import { formatPercent } from './format';

interface Props {
  sac: LoanSummary;
  price: LoanSummary;
}

export function ResultsComparison({ sac, price }: Props) {
  return (
    <div className={styles.results}>
      <div className={`${styles.tile} ${styles.tileSac}`}>
        <div className={styles.tileName}>
          SAC <small>parcela decrescente</small>
        </div>
        <div className={styles.kv}><span>1ª parcela</span><b>{formatCurrency(sac.firstPayment)}</b></div>
        <div className={styles.kv}><span>Última parcela</span><b>{formatCurrency(sac.lastPayment)}</b></div>
        <div className={styles.kv}><span>Total de juros</span><b>{formatCurrency(sac.totalInterest)}</b></div>
        <div className={styles.kv}><span>CET</span><b>{formatPercent(sac.cetAnnualRate)} a.a.</b></div>
      </div>

      <div className={`${styles.tile} ${styles.tilePrice}`}>
        <div className={styles.tileName}>
          Price <small>parcela fixa</small>
        </div>
        <div className={styles.kv}><span>Parcela</span><b>{formatCurrency(price.firstPayment)}</b></div>
        <div className={styles.kv}><span>Total pago</span><b>{formatCurrency(price.totalPayment)}</b></div>
        <div className={styles.kv}><span>Total de juros</span><b>{formatCurrency(price.totalInterest)}</b></div>
        <div className={styles.kv}><span>CET</span><b>{formatPercent(price.cetAnnualRate)} a.a.</b></div>
      </div>
    </div>
  );
}
