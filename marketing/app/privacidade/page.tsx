import type { Metadata } from 'next';
import styles from '../legal.module.css';
import { siteUrl } from '../site-url';

export const metadata: Metadata = {
  title: 'Privacidade',
  description: 'Política de privacidade da Calculadora Price & SAC.',
  alternates: {
    canonical: '/privacidade',
  },
  openGraph: {
    title: 'Privacidade',
    description: 'Política de privacidade da Calculadora Price & SAC.',
    url: `${siteUrl}/privacidade`,
  },
};

export default function PrivacyPage() {
  return (
    <main className={styles.page}>
      <div>
        <h1 className={styles.title}>Política de Privacidade</h1>
        <p className={styles.lead}>
          Última atualização: 2 de agosto de 2026. Esta política explica como a Calculadora Price
          &amp; SAC trata dados no app.
        </p>
      </div>

      <section className={styles.section}>
        <h2>Resumo rápido</h2>
        <div className={styles.badgeRow}>
          <span className={styles.badge}>Sem cadastro</span>
          <span className={styles.badge}>Uso offline</span>
          <span className={styles.badge}>Simulações no aparelho</span>
        </div>
        <p>
          O app funciona sem login. As simulações e cenários ficam salvos localmente no seu
          dispositivo.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Dados coletados pelo app</h2>
        <p>
          A Calculadora Price &amp; SAC não solicita cadastro. As informações financeiras inseridas
          nas simulações e os cenários salvos ficam no dispositivo e não são enviados ao serviço de
          análise. Se você salvar o Perfil profissional, o nome ou empresa, e-mail, telefone,
          registro profissional e website informados são associados ao seu perfil de uso no PostHog.
          Se um Perfil profissional completo já estava salvo antes desta atualização, essa
          associação ocorre uma única vez na primeira abertura com o serviço de análise ativo. Dados
          dos seus clientes usados em exportações não são enviados ao PostHog. Ao limpar o Perfil
          profissional, o app remove os dados locais e solicita ao PostHog que os cinco campos
          pessoais atuais sejam substituídos por valores vazios. Essa ação não apaga o histórico
          técnico do serviço de análise.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Finalidade, tratamento e retenção</h2>
        <p>
          Os dados de uso ajudam a entender quais recursos são utilizados e a melhorar o produto. Os
          dados opcionais do Perfil profissional permitem identificar o uso desse recurso. O
          tratamento ocorre com base no legítimo interesse de analisar e aperfeiçoar o serviço,
          respeitados os direitos do titular. Os dados são mantidos enquanto forem necessários para
          essas finalidades ou até um pedido de exclusão aplicável.
        </p>
        <p>
          O PostHog pode processar dados fora do Brasil, sujeito às medidas contratuais e de
          segurança adotadas pelo fornecedor.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Seus direitos</h2>
        <p>
          Você pode solicitar confirmação do tratamento, acesso, correção ou exclusão de dados
          pessoais associados ao Perfil profissional pelo e-mail indicado abaixo. Para localizar o
          perfil correto, poderemos pedir informações adicionais de verificação.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Serviços de terceiros</h2>
        <p>
          Para análise de uso, exibição de anúncios e compras no app, utilizamos serviços de
          terceiros que podem coletar dados técnicos do dispositivo, como identificadores, modelo do
          aparelho e dados de uso.
        </p>
        <ul className={styles.list}>
          <li>Google AdMob (anúncios para usuários gratuitos).</li>
          <li>App Store / Google Play (processamento de compras únicas).</li>
          <li>PostHog (análise de uso e perfil profissional informado pelo usuário).</li>
        </ul>
        <p>
          Esses serviços possuem suas próprias políticas de privacidade. Consulte os links abaixo:
        </p>
        <ul className={styles.list}>
          <li>
            <a
              className={styles.link}
              href="https://posthog.com/privacy"
              target="_blank"
              rel="noreferrer"
            >
              PostHog Privacy Policy
            </a>
          </li>
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
