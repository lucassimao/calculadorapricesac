import styles from './Simulator.module.css';

interface Props {
  sacBalances: number[];
  priceBalances: number[];
}

const W = 240;
const H = 64;

function toPath(values: number[], max: number): string {
  if (values.length === 0 || max <= 0) return '';
  return values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * W;
      const y = H - (v / max) * H;
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

export function BalanceChart({ sacBalances, priceBalances }: Props) {
  const max = Math.max(...sacBalances, ...priceBalances, 1);
  return (
    <div className={`${styles.card} ${styles.chartCard}`}>
      <span className={styles.label}>Saldo devedor ao longo do tempo</span>
      <svg
        className={styles.chart}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Evolução do saldo devedor: SAC e Price"
      >
        <path d={toPath(priceBalances, max)} fill="none" stroke="#d64b3c" strokeWidth="2.5" strokeLinecap="round" />
        <path d={toPath(sacBalances, max)} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <div className={styles.legend}>
        <span><span className={styles.legendDot} style={{ background: 'var(--accent)' }} />SAC</span>
        <span><span className={styles.legendDot} style={{ background: '#d64b3c' }} />Price</span>
      </div>
    </div>
  );
}
