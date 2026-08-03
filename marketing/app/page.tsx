import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import styles from './page.module.css';
import { siteUrl } from './site-url';
import { AppStoreLink } from './AppStoreLink';
import { Simulator } from './components/Simulator/Simulator';
import { guides } from './guias/content';
import { resources } from './recursos/content';

const appStoreUrl = 'https://apps.apple.com/br/app/calculadora-sac-price/id6757717537';

export const metadata: Metadata = {
  title: { absolute: 'Calculadora SAC e Price — Simulador de Financiamento' },
  description:
    'Calculadora SAC e Price com tabela SAC e simulador de amortização. Compare parcelas, custos, CET e visualize tabelas e gráficos.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Calculadora SAC e Price — Simulador de Financiamento',
    description:
      'Calculadora SAC e Price com tabela SAC e simulador de amortização. Compare parcelas, custos, CET e visualize tabelas e gráficos.',
    url: siteUrl,
    images: [
      {
        url: `${siteUrl}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: 'Calculadora Price & SAC — simulador SAC e Price',
        type: 'image/png',
      },
      {
        url: `${siteUrl}/og-square`,
        width: 1200,
        height: 1200,
        alt: 'Calculadora Price & SAC — ícone do app',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    title: 'Calculadora SAC e Price — Simulador de Financiamento',
    description:
      'Calculadora SAC e Price com tabela SAC e simulador de amortização. Compare parcelas, custos, CET e visualize tabelas e gráficos.',
    images: [`${siteUrl}/twitter-image`],
  },
};

export default function Home() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'MobileApplication',
    name: 'Calculadora Price & SAC',
    operatingSystem: 'iOS',
    applicationCategory: 'FinanceApplication',
    description:
      'Simulador de financiamento imobiliário com SAC e Price. Funciona offline, com tabela completa, FGTS e exportações Premium.',
    image: [`${siteUrl}/opengraph-image`, `${siteUrl}/og-square`],
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'BRL',
      category: 'Free',
    },
    installUrl: appStoreUrl,
    url: siteUrl,
  };

  return (
    <main className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <section className={styles.hero}>
        <div>
          <span className={`${styles.heroBadge} ${styles.fadeUp}`}>
            Funciona offline • sem cadastro
          </span>
          <h1 className={`${styles.heroTitle} ${styles.fadeUp} ${styles.delay1}`}>
            Calculadora SAC e Price — simulador de financiamento
          </h1>
          <p className={`${styles.heroSubtitle} ${styles.fadeUp} ${styles.delay2}`}>
            Calcule parcelas, juros, custos e CET com metodologia transparente. Compare os sistemas
            lado a lado e veja o impacto de FGTS, amortizações extras e taxas opcionais no seu
            bolso.
          </p>
          <div className={`${styles.heroActions} ${styles.fadeUp} ${styles.delay3}`}>
            <AppStoreLink className={styles.primaryButton} href={appStoreUrl} location="hero">
              <span className={styles.storeIcon} aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M16.8 13.8c0 2.3 2 3.1 2 3.1s-1.6 4.7-3.8 4.7c-1.1 0-1.5-.7-2.8-.7s-1.8.7-2.9.7c-2.1 0-3.9-4.3-3.9-7.8 0-3.1 2-4.7 3.9-4.7 1.1 0 1.9.7 2.6.7s1.7-.9 3.1-.8c.5 0 1.9.2 2.8 1.5-2.4 1.3-2.2 3.7-2.2 4.1z"
                    fill="currentColor"
                  />
                  <path
                    d="M13.9 4.1c.6-.7 1-1.7.9-2.7-1 .1-2 .7-2.6 1.4-.6.7-1 1.7-.9 2.7 1-.1 1.9-.7 2.6-1.4z"
                    fill="currentColor"
                  />
                </svg>
              </span>
              App Store
            </AppStoreLink>
            <span
              className={`${styles.secondaryButton} ${styles.disabledButton}`}
              aria-disabled="true"
            >
              <span className={styles.storeIcon} aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M3.2 2.4c-.2.3-.2.7-.2 1.1v17.1c0 .4.1.8.3 1.1l9.4-9.6-9.5-9.7z"
                    fill="#34A853"
                  />
                  <path d="M14 12l2.9-3-10-5.9 7.1 8.9z" fill="#4285F4" />
                  <path d="M14 12l-7.1 8.9 10-5.8-2.9-3.1z" fill="#FBBC05" />
                  <path
                    d="M20.8 10.4l-3.9-2.3L14 12l2.9 3.1 3.9-2.3c.7-.5.7-1.9 0-2.4z"
                    fill="#EA4335"
                  />
                </svg>
              </span>
              Google Play (em breve)
            </span>
            <Link className={styles.secondaryButton} href="/suporte">
              Preciso de ajuda
            </Link>
          </div>
          <div className={styles.chips}>
            <span className={styles.chip}>SAC e Price</span>
            <span className={styles.chip}>Tabela completa</span>
            <span className={styles.chip}>FGTS e amortizações</span>
            <span className={styles.chip}>Premium sem anúncios</span>
          </div>
        </div>
        <div className={styles.heroCard}>
          <Simulator />
        </div>
      </section>

      <div className={styles.sectionDivider} />

      <section className={styles.section} aria-labelledby="guides-title">
        <div>
          <h2 id="guides-title" className={styles.sectionTitle}>
            Guias de financiamento imobiliário
          </h2>
          <p className={styles.sectionLead}>
            Entenda SAC, Price, CET, FGTS e amortização antes de simular. Nossos guias explicam o
            que aparece na tela e ajudam você a comparar propostas.
          </p>
        </div>
        <div className={styles.guideGrid}>
          {guides.map((guide) => (
            <Link key={guide.slug} className={styles.guideCard} href={`/guias/${guide.slug}`}>
              <span className={styles.guideCardTitle}>{guide.title}</span>
              <span className={styles.guideCardText}>{guide.hook}</span>
              <span className={styles.guideCardMore}>Ler guia →</span>
            </Link>
          ))}
        </div>
        <Link className={styles.guidesLink} href="/guias" aria-label="Guias">
          Ver todos os guias →
        </Link>
      </section>

      <div className={styles.sectionDivider} />

      <section className={styles.section} aria-labelledby="resources-title">
        <div>
          <h2 id="resources-title" className={styles.sectionTitle}>
            Recursos para decidir melhor
          </h2>
          <p className={styles.sectionLead}>
            Veja o app resolvendo dúvidas reais: amortização, FGTS, CET, indexadores, exportações e
            muito mais.
          </p>
        </div>
        <div className={styles.resourceGrid}>
          {resources.map((resource) => (
            <Link
              key={resource.slug}
              className={styles.resourceCard}
              href={`/recursos/${resource.slug}`}
            >
              <span className={styles.resourceCardTitle}>{resource.title}</span>
              <span className={styles.resourceCardText}>{resource.hook}</span>
              <span className={styles.resourceCardMore}>Ver recurso →</span>
            </Link>
          ))}
        </div>
        <Link className={styles.guidesLink} href="/recursos" aria-label="Recursos">
          Ver todos os recursos →
        </Link>
      </section>

      <div className={styles.sectionDivider} />

      <section className={styles.section}>
        <div>
          <h2 className={styles.sectionTitle}>Decida com clareza</h2>
          <p className={styles.sectionLead}>
            A Calculadora Price &amp; SAC foi pensada para quem precisa comparar propostas e
            entender o custo real do financiamento. As simulações acontecem no aparelho, sem login.
          </p>
        </div>
        <div className={styles.shotsGrid}>
          <figure className={styles.shotCard}>
            <div className={styles.shotFrame}>
              <Image
                src="/screenshots/resumo.png"
                alt="Resumo do financiamento"
                width={720}
                height={1280}
              />
            </div>
            <figcaption className={styles.shotCaption}>
              Resumo com total pago, juros e CET.
            </figcaption>
          </figure>
          <figure className={styles.shotCard}>
            <div className={styles.shotFrame}>
              <Image
                src="/screenshots/tabela.png"
                alt="Tabela de amortização"
                width={720}
                height={1280}
              />
            </div>
            <figcaption className={styles.shotCaption}>
              Tabela completa com saldo e amortização.
            </figcaption>
          </figure>
          <figure className={styles.shotCard}>
            <div className={styles.shotFrame}>
              <Image
                src="/screenshots/graficos.png"
                alt="Gráficos de evolução"
                width={720}
                height={1280}
              />
            </div>
            <figcaption className={styles.shotCaption}>
              Gráficos de saldo, parcelas e composição.
            </figcaption>
          </figure>
        </div>
        <div className={styles.featureGrid}>
          <div className={styles.featureCard}>
            <div className={styles.featureTitle}>Tabela completa</div>
            <p className={styles.featureText}>
              Veja amortização, juros, saldo devedor e custos mês a mês em uma tabela clara.
            </p>
          </div>
          <div className={styles.featureCard}>
            <div className={styles.featureTitle}>Comparativo SAC vs Price</div>
            <p className={styles.featureText}>
              Compare os dois sistemas lado a lado e entenda a diferença total de juros.
            </p>
          </div>
          <div className={styles.featureCard}>
            <div className={styles.featureTitle}>Valores conferidos</div>
            <p className={styles.featureText}>
              SAC e Price conferidos com simulação bancária publicada para crédito prefixado sem
              seguros individualizados.
            </p>
          </div>
          <div className={styles.featureCard}>
            <div className={styles.featureTitle}>Custos reais</div>
            <p className={styles.featureText}>
              Inclua IOF, seguro, tarifas administrativas, ITBI e cartório para um cenário fiel.
            </p>
          </div>
          <div className={styles.featureCard}>
            <div className={styles.featureTitle}>FGTS e amortizações</div>
            <p className={styles.featureText}>
              Simule uso de FGTS e amortizações extras para reduzir prazo ou parcela.
            </p>
          </div>
          <div className={styles.featureCard}>
            <div className={styles.featureTitle}>Contrato atual</div>
            <p className={styles.featureText}>
              Já tem um financiamento? Simule amortização e portabilidade.
            </p>
          </div>
        </div>
      </section>

      <div className={styles.sectionDivider} />

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Resultados que mostram o todo</h2>
        <p className={styles.sectionLead}>
          Além do valor das parcelas, acompanhe gráficos de saldo, composição entre juros e
          amortização e o impacto das suas decisões ao longo do tempo.
        </p>
        <div className={styles.numbersStrip}>
          <div className={styles.numberCard}>
            <div className={styles.numberValue}>2</div>
            <div className={styles.numberLabel}>Sistemas completos: SAC e Price.</div>
          </div>
          <div className={styles.numberCard}>
            <div className={styles.numberValue}>3</div>
            <div className={styles.numberLabel}>Exportações Premium: PDF, XLSX e CSV.</div>
          </div>
          <div className={styles.numberCard}>
            <div className={styles.numberValue}>0</div>
            <div className={styles.numberLabel}>
              Cadastros obrigatórios; simulações disponíveis offline.
            </div>
          </div>
          <div className={styles.numberCard}>
            <div className={styles.numberValue}>1</div>
            <div className={styles.numberLabel}>Compra única para remover anúncios.</div>
          </div>
        </div>
        <div className={styles.compareRow}>
          <div className={styles.compareCard}>
            <div>Price</div>
            <div className={styles.compareValue}>Parcelas estáveis</div>
            <p className={styles.featureText}>Ideal para previsibilidade no fluxo mensal.</p>
          </div>
          <div className={styles.compareCard}>
            <div>SAC</div>
            <div className={styles.compareValue}>Parcelas decrescentes</div>
            <p className={styles.featureText}>Pague menos juros totais ao longo do tempo.</p>
          </div>
          <div className={styles.compareCard}>
            <div>CET</div>
            <div className={styles.compareValue}>Taxa efetiva anual</div>
            <p className={styles.featureText}>Entenda o custo total do financiamento.</p>
          </div>
        </div>
      </section>

      <div className={styles.sectionDivider} />

      <section className={styles.section}>
        <div className={styles.premiumBox}>
          <h2 className={styles.sectionTitle}>Premium por compra única</h2>
          <p>
            Remova anúncios e desbloqueie exportações profissionais. Sem mensalidade e sem
            surpresas.
          </p>
          <div className={styles.premiumList}>
            <span>• Exportação em PDF, XLSX e CSV</span>
            <span>• Mais cenários salvos</span>
            <span>• Experiência sem anúncios</span>
          </div>
        </div>
      </section>

      <div className={styles.sectionDivider} />

      <section id="baixar" className={styles.section}>
        <div className={styles.ctaBlock}>
          <h2 className={styles.sectionTitle}>Pronto para simular?</h2>
          <p>
            Baixe agora e descubra o cenário ideal para o seu financiamento imobiliário. As
            simulações funcionam offline.
          </p>
          <div className={styles.ctaActions}>
            <AppStoreLink className={styles.primaryButton} href={appStoreUrl} location="cta">
              <span className={styles.storeIcon} aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M16.8 13.8c0 2.3 2 3.1 2 3.1s-1.6 4.7-3.8 4.7c-1.1 0-1.5-.7-2.8-.7s-1.8.7-2.9.7c-2.1 0-3.9-4.3-3.9-7.8 0-3.1 2-4.7 3.9-4.7 1.1 0 1.9.7 2.6.7s1.7-.9 3.1-.8c.5 0 1.9.2 2.8 1.5-2.4 1.3-2.2 3.7-2.2 4.1z"
                    fill="currentColor"
                  />
                  <path
                    d="M13.9 4.1c.6-.7 1-1.7.9-2.7-1 .1-2 .7-2.6 1.4-.6.7-1 1.7-.9 2.7 1-.1 1.9-.7 2.6-1.4z"
                    fill="currentColor"
                  />
                </svg>
              </span>
              App Store
            </AppStoreLink>
            <span
              className={`${styles.secondaryButton} ${styles.disabledButton}`}
              aria-disabled="true"
            >
              <span className={styles.storeIcon} aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M3.2 2.4c-.2.3-.2.7-.2 1.1v17.1c0 .4.1.8.3 1.1l9.4-9.6-9.5-9.7z"
                    fill="#34A853"
                  />
                  <path d="M14 12l2.9-3-10-5.9 7.1 8.9z" fill="#4285F4" />
                  <path d="M14 12l-7.1 8.9 10-5.8-2.9-3.1z" fill="#FBBC05" />
                  <path
                    d="M20.8 10.4l-3.9-2.3L14 12l2.9 3.1 3.9-2.3c.7-.5.7-1.9 0-2.4z"
                    fill="#EA4335"
                  />
                </svg>
              </span>
              Google Play (em breve)
            </span>
            <Link className={styles.secondaryButton} href="/privacidade">
              Ler política de privacidade
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
