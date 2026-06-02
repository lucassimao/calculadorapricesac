import styles from './Simulator.module.css';
import { formatCurrency } from '@loan-engine/calculations';
import type { ScheduleRow } from '@loan-engine/loan';

interface Props {
  rows: ScheduleRow[];
  count?: number;
}

export function TablePreview({ rows, count = 6 }: Props) {
  const preview = rows.filter((r) => r.installmentNumber > 0).slice(0, count);
  return (
    <div className={`${styles.card} ${styles.tablePreview}`}>
      <span className={styles.label}>Tabela de amortização (SAC)</span>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>#</th>
            <th>Parcela</th>
            <th>Juros</th>
            <th>Saldo</th>
          </tr>
        </thead>
        <tbody>
          {preview.map((r) => (
            <tr key={r.installmentNumber}>
              <td>{r.installmentNumber}</td>
              <td>{formatCurrency(r.payment)}</td>
              <td>{formatCurrency(r.interest)}</td>
              <td>{formatCurrency(r.balance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className={styles.tableFade} />
      <p className={styles.tableCaption}>Veja a tabela completa, mês a mês, no app.</p>
    </div>
  );
}
