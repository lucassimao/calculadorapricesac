import type { Metadata } from 'next';
import styles from '../legal.module.css';

export const metadata: Metadata = {
  title: 'Privacidade',
  description: 'Política de privacidade da Calculadora Price & SAC.',
  alternates: {
    canonical: '/privacidade',
  },
  openGraph: {
    title: 'Privacidade',
    description: 'Política de privacidade da Calculadora Price & SAC.',
    url: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://calculadorapricesac.com'}/privacidade`,
  },
};

export default function PrivacyPage() {
  return (
    <main className={styles.page}>
      <div>
        <h1 className={styles.title}>Política de Privacidade</h1>
        <p className={styles.lead}>
          Última atualização: 12 de janeiro de 2026. Esta política explica como a Calculadora Price
          &amp; SAC trata dados no app.
        </p>
      </div>

      <section className={styles.section}>
        <h2>Resumo rápido</h2>
        <div className={styles.badgeRow}>
          <span className={styles.badge}>Sem cadastro</span>
          <span className={styles.badge}>Uso offline</span>
          <span className={styles.badge}>Dados salvos no aparelho</span>
        </div>
        <p>
          O app funciona sem login. As simulações e cenários ficam salvos localmente no seu
          dispositivo.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Dados coletados pelo app</h2>
        <p>
          A Calculadora Price &amp; SAC não solicita cadastro e não coleta diretamente dados
          pessoais como nome, CPF ou endereço. As informações inseridas nas simulações ficam
          armazenadas no dispositivo do usuário.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Serviços de terceiros</h2>
        <p>
          Para exibição de anúncios e compras no app, utilizamos serviços de terceiros que podem
          coletar dados técnicos do dispositivo, como identificadores de publicidade, modelo do
          aparelho e dados de uso.
        </p>
        <ul className={styles.list}>
          <li>Google AdMob (anúncios para usuários gratuitos).</li>
          <li>App Store / Google Play (processamento de compras únicas).</li>
        </ul>
        <p>
          Esses serviços possuem suas próprias políticas de privacidade. Consulte os links abaixo:
        </p>
        <ul className={styles.list}>
          <li>
            <a
              className={styles.link}
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noreferrer"
            >
              Google Privacy Policy
            </a>
          </li>
          <li>
            <a
              className={styles.link}
              href="https://www.apple.com/legal/privacy/"
              target="_blank"
              rel="noreferrer"
            >
              Apple Privacy Policy
            </a>
          </li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2>Exportações e compartilhamento</h2>
        <p>
          O app permite exportar relatórios em PDF, XLSX e CSV (recurso Premium). Os arquivos são
          gerados localmente e compartilhados apenas quando o usuário escolhe exportar.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Contato</h2>
        <p>
          Dúvidas sobre privacidade? Fale com a gente pelo e-mail:{' '}
          <a className={styles.link} href="mailto:lucas@lucassimao.com">
            lucas@lucassimao.com
          </a>
          .
        </p>
      </section>
    </main>
  );
}
