import type { Metadata } from 'next';
import styles from '../legal.module.css';
import { siteUrl } from '../site-url';

export const metadata: Metadata = {
  title: 'Termos de Uso',
  description: 'Termos de uso da Calculadora Price & SAC.',
  alternates: {
    canonical: '/termos',
  },
  openGraph: {
    title: 'Termos de Uso',
    description: 'Termos de uso da Calculadora Price & SAC.',
    url: `${siteUrl}/termos`,
  },
};

export default function TermsPage() {
  return (
    <main className={styles.page}>
      <div>
        <h1 className={styles.title}>Termos de Uso</h1>
        <p className={styles.lead}>
          Última atualização: 16 de janeiro de 2026. Ao utilizar a Calculadora Price &amp; SAC, você
          concorda com os termos abaixo.
        </p>
      </div>

      <section className={styles.section}>
        <h2>1. Aceitação dos Termos</h2>
        <p>
          Ao baixar, instalar ou utilizar o aplicativo Calculadora Price &amp; SAC, você aceita
          estes Termos de Uso. Se não concordar com algum termo, não utilize o aplicativo.
        </p>
      </section>

      <section className={styles.section}>
        <h2>2. Descrição do Serviço</h2>
        <p>
          A Calculadora Price &amp; SAC é um aplicativo de simulação de financiamentos imobiliários
          que permite ao usuário:
        </p>
        <ul className={styles.list}>
          <li>Simular financiamentos nos sistemas Price e SAC.</li>
          <li>Visualizar tabelas de amortização completas.</li>
          <li>Incluir custos adicionais como IOF, seguro e taxas.</li>
          <li>Simular amortizações extras e uso de FGTS.</li>
          <li>Comparar diferentes cenários de financiamento.</li>
          <li>Exportar relatórios em PDF, XLSX e CSV (recurso Premium).</li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2>3. Natureza Informativa</h2>
        <p>
          As simulações realizadas no aplicativo têm caráter exclusivamente informativo e
          educacional. Os valores apresentados são estimativas baseadas nos parâmetros fornecidos
          pelo usuário e podem diferir das condições reais oferecidas por instituições financeiras.
        </p>
        <p>
          O aplicativo <strong>não constitui oferta de crédito</strong>, recomendação de
          investimento ou aconselhamento financeiro. Consulte sempre uma instituição financeira para
          obter condições reais de financiamento.
        </p>
      </section>

      <section className={styles.section}>
        <h2>4. Isenção de Responsabilidade</h2>
        <p>O desenvolvedor não se responsabiliza por:</p>
        <ul className={styles.list}>
          <li>Decisões financeiras tomadas com base nas simulações do aplicativo.</li>
          <li>Divergências entre os valores simulados e as condições reais de financiamento.</li>
          <li>Perdas ou danos decorrentes do uso das informações apresentadas.</li>
          <li>Erros de cálculo decorrentes de parâmetros incorretos informados pelo usuário.</li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2>5. Compras no Aplicativo</h2>
        <p>
          O aplicativo oferece uma compra única (Premium) que remove anúncios e libera recursos
          adicionais como exportação de relatórios e cenários ilimitados.
        </p>
        <ul className={styles.list}>
          <li>O pagamento é processado pela App Store (iOS) ou Google Play (Android).</li>
          <li>A compra é única e permanente, não sendo uma assinatura recorrente.</li>
          <li>Reembolsos seguem as políticas da respectiva loja de aplicativos.</li>
          <li>A compra pode ser restaurada em outros dispositivos vinculados à mesma conta.</li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2>6. Propriedade Intelectual</h2>
        <p>
          Todo o conteúdo do aplicativo, incluindo textos, gráficos, ícones, imagens, código-fonte e
          marca, é de propriedade exclusiva do desenvolvedor e protegido por leis de direitos
          autorais.
        </p>
        <p>
          É proibida a reprodução, distribuição, modificação ou engenharia reversa do aplicativo sem
          autorização prévia por escrito.
        </p>
      </section>

      <section className={styles.section}>
        <h2>7. Uso Aceitável</h2>
        <p>
          Você concorda em utilizar o aplicativo apenas para fins legais e de acordo com estes
          termos. É proibido:
        </p>
        <ul className={styles.list}>
          <li>Tentar acessar sistemas ou dados não autorizados.</li>
          <li>Utilizar o aplicativo para atividades ilegais ou fraudulentas.</li>
          <li>Interferir no funcionamento normal do aplicativo.</li>
          <li>Redistribuir ou revender o aplicativo ou seus recursos.</li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2>8. Disponibilidade</h2>
        <p>
          O desenvolvedor não garante disponibilidade ininterrupta do aplicativo. Atualizações,
          manutenções ou descontinuação podem ocorrer a qualquer momento, sem aviso prévio.
        </p>
      </section>

      <section className={styles.section}>
        <h2>9. Alterações nos Termos</h2>
        <p>
          Estes termos podem ser atualizados periodicamente. Alterações significativas serão
          comunicadas através do aplicativo ou do site. O uso continuado após alterações constitui
          aceitação dos novos termos.
        </p>
      </section>

      <section className={styles.section}>
        <h2>10. Legislação Aplicável</h2>
        <p>
          Estes termos são regidos pelas leis da República Federativa do Brasil. Eventuais disputas
          serão resolvidas no foro da comarca de São Paulo, SP.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Contato</h2>
        <p>
          Dúvidas sobre os termos de uso? Entre em contato pelo e-mail:{' '}
          <a className={styles.link} href="mailto:lucas@lucassimao.com">
            lucas@lucassimao.com
          </a>
          .
        </p>
      </section>
    </main>
  );
}
