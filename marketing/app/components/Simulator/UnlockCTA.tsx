import styles from './Simulator.module.css';
import { AppStoreLink } from '../../AppStoreLink';

const appStoreUrl = 'https://apps.apple.com/br/app/calculadora-sac-price/id6757717537';

export function UnlockCTA() {
  return (
    <div className={styles.unlock}>
      <div className={styles.unlockTitle}>Baixe o app para desbloquear</div>
      <p className={styles.unlockList}>
        amortizações recorrentes · FGTS com regras por tipo de uso · custos (IOF, ITBI, seguro,
        cartório) · tabela completa · exportar PDF, XLSX e CSV · salvar cenários
      </p>
      <AppStoreLink className="" href={appStoreUrl} location="simulator">
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            background: '#fff',
            color: 'var(--ink)',
            fontWeight: 600,
            padding: '11px 18px',
            borderRadius: 14,
          }}
        >
          Baixar na App Store
        </span>
      </AppStoreLink>
    </div>
  );
}
