import type { Metadata } from 'next';
import Link from 'next/link';
import styles from './guias.module.css';
import { siteUrl } from '../site-url';
import { guides } from './content';

export const metadata: Metadata = {
  title: { absolute: 'Guias de financiamento imobiliário (SAC, Price, FGTS, CET)' },
  description:
    'Guias práticos sobre financiamento imobiliário: diferença entre SAC e Price, CET, uso do FGTS, amortização e entrada. Explicações claras e diretas.',
  alternates: { canonical: '/guias' },
  openGraph: {
    title: 'Guias de financiamento imobiliário',
    description:
      'Diferença entre SAC e Price, CET, FGTS, amortização e entrada — explicado de forma clara.',
    url: `${siteUrl}/guias`,
    type: 'website',
  },
};

export default function GuidesIndex() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Guias de financiamento imobiliário',
    description:
      'Guias sobre SAC, Price, CET, FGTS, amortização e entrada no financiamento imobiliário.',
    inLanguage: 'pt-BR',
    url: `${siteUrl}/guias`,
    hasPart: guides.map((g) => ({
      '@type': 'Article',
      headline: g.title,
      url: `${siteUrl}/guias/${g.slug}`,
    })),
  };

  return (
    <main className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div>
        <h1 className={styles.title}>Guias de financiamento imobiliário</h1>
        <p className={styles.lead}>
          Explicações claras e diretas sobre como funciona o financiamento da casa própria — para
          você decidir com segurança e simular o seu caso.
        </p>
      </div>

      <div className={styles.grid}>
        {guides.map((g) => (
          <Link key={g.slug} className={styles.card} href={`/guias/${g.slug}`}>
            <span className={styles.cardTitle}>{g.title}</span>
            <span className={styles.cardHook}>{g.hook}</span>
            <span className={styles.cardMore}>Ler guia →</span>
          </Link>
        ))}
      </div>

      <div className={styles.cta}>
        <span className={styles.ctaText}>Pronto para ver os números do seu financiamento?</span>
        <Link className={styles.ctaButton} href="/">
          Abrir o simulador →
        </Link>
      </div>
    </main>
  );
}
