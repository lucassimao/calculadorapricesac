import type { Metadata } from 'next';
import Link from 'next/link';
import styles from './recursos.module.css';
import { siteUrl } from '../site-url';
import { resources } from './content';

export const metadata: Metadata = {
  title: { absolute: 'Recursos do simulador de financiamento SAC e Price' },
  description:
    'Visitas rápidas pelo app para simular SAC, Price, amortização, FGTS, CET, exportações e outros cenários de financiamento.',
  alternates: { canonical: '/recursos' },
  openGraph: {
    title: 'Recursos do simulador de financiamento',
    description: 'Veja o app resolvendo dúvidas práticas de financiamento.',
    url: `${siteUrl}/recursos`,
    type: 'website',
  },
};

export default function ResourcesIndex() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Recursos do simulador de financiamento',
    description: metadata.description,
    inLanguage: 'pt-BR',
    url: `${siteUrl}/recursos`,
    hasPart: resources.map((resource) => ({
      '@type': 'Article',
      headline: resource.title,
      url: `${siteUrl}/recursos/${resource.slug}`,
    })),
  };

  return (
    <main className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div>
        <h1 className={styles.title}>Recursos do simulador de financiamento</h1>
        <p className={styles.lead}>
          Páginas curtas, diretas e com telas reais do app para você entender como simular cada
          situação — de SAC e Price a FGTS, amortização e exportações.
        </p>
      </div>
      <div className={styles.grid}>
        {resources.map((resource) => (
          <Link key={resource.slug} className={styles.card} href={`/recursos/${resource.slug}`}>
            <span className={styles.cardTitle}>{resource.title}</span>
            <span className={styles.cardHook}>{resource.hook}</span>
            <span className={styles.cardMore}>Ver como funciona →</span>
          </Link>
        ))}
      </div>
      <div className={styles.cta}>
        <span className={styles.ctaText}>Quer testar seus próprios números?</span>
        <Link className={styles.ctaButton} href="/">
          Abrir o simulador web
        </Link>
      </div>
    </main>
  );
}
