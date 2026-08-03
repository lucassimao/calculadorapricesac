import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import styles from '../guias.module.css';
import { AppStoreLink } from '../../AppStoreLink';
import { siteUrl } from '../../site-url';
import { guides, guideBySlug, type Block } from '../content';

const appStoreUrl = 'https://apps.apple.com/br/app/calculadora-sac-price/id6757717537';

export function generateStaticParams() {
  return guides.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = guideBySlug(slug);
  if (!guide) return {};
  const url = `${siteUrl}/guias/${guide.slug}`;
  return {
    title: { absolute: guide.metaTitle },
    description: guide.description,
    alternates: { canonical: `/guias/${guide.slug}` },
    openGraph: {
      title: guide.metaTitle,
      description: guide.description,
      url,
      type: 'article',
    },
    twitter: {
      title: guide.metaTitle,
      description: guide.description,
    },
  };
}

function renderBlock(block: Block, i: number) {
  switch (block.type) {
    case 'p':
      return <p key={i}>{block.text}</p>;
    case 'list':
      return (
        <ul key={i} className={styles.list}>
          {block.items.map((item, j) => (
            <li key={j}>{item}</li>
          ))}
        </ul>
      );
    case 'callout':
      return (
        <p key={i} className={styles.callout}>
          {block.text}
        </p>
      );
    case 'source':
      return (
        <p key={i} className={styles.source}>
          <a href={block.href} target="_blank" rel="noreferrer">
            {block.text}
          </a>
        </p>
      );
    case 'internalLink':
      return (
        <p key={i} className={styles.internalLink}>
          {block.text} <Link href={block.href}>{block.label}</Link>
        </p>
      );
    case 'appCta':
      return (
        <div key={i} className={styles.guideAppCta}>
          <span>{block.text}</span>
          <AppStoreLink className={styles.guideAppCtaButton} href={appStoreUrl} location="guide">
            {block.label}
          </AppStoreLink>
        </div>
      );
    case 'table':
      return (
        <div key={i} className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                {block.head.map((h, j) => (
                  <th key={j}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, j) => (
                <tr key={j}>
                  {row.map((cell, k) => (
                    <td key={k}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = guideBySlug(slug);
  if (!guide) notFound();

  const url = `${siteUrl}/guias/${guide.slug}`;
  const related = guide.related
    .map((s) => guideBySlug(s))
    .filter((g): g is NonNullable<typeof g> => Boolean(g));

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: guide.title,
      description: guide.description,
      datePublished: guide.updated,
      dateModified: guide.updated,
      inLanguage: 'pt-BR',
      mainEntityOfPage: url,
      author: { '@type': 'Person', name: 'Lucas Simão Costa' },
      publisher: { '@type': 'Organization', name: 'Calculadora Price & SAC' },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: guide.faq.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Guias', item: `${siteUrl}/guias` },
        { '@type': 'ListItem', position: 2, name: guide.title, item: url },
      ],
    },
  ];

  return (
    <main className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <nav className={styles.breadcrumb}>
        <Link href="/guias">Guias</Link> / {guide.title}
      </nav>

      <div>
        <h1 className={styles.title}>{guide.title}</h1>
        <p className={styles.lead}>{guide.intro}</p>
      </div>

      <div className={styles.cta}>
        <span className={styles.ctaText}>Faça as contas com os números do seu financiamento.</span>
        <Link className={styles.ctaButton} href="/">
          Simular agora →
        </Link>
      </div>

      <div className={styles.cta}>
        <span className={styles.ctaText}>
          Veja esta funcionalidade em uma visita rápida pelo app.
        </span>
        <Link className={styles.ctaButton} href={`/recursos/${guide.resourceSlug}`}>
          Ver recurso relacionado
        </Link>
      </div>

      {guide.sections.map((section, i) => (
        <section key={i} className={styles.section}>
          <h2>{section.heading}</h2>
          {section.blocks.map((block, j) => renderBlock(block, j))}
        </section>
      ))}

      <section className={styles.section}>
        <h2>Exemplo com números reais</h2>
        <p>
          Para comparar os sistemas com uma base comum, usamos o cenário de referência do app:
          imóvel de R$ 400.000, entrada de 20%, taxa de 11,5% a.a. e prazo de 360 meses. Os números
          abaixo são calculados pelo mesmo @loan-engine usado no simulador durante o build.
        </p>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Indicador</th>
                <th>SAC</th>
                <th>Price</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>1ª parcela</td>
                <td>{guide.example.sacFirstPayment}</td>
                <td>—</td>
              </tr>
              <tr>
                <td>Última parcela SAC</td>
                <td>{guide.example.sacLastPayment}</td>
                <td>—</td>
              </tr>
              <tr>
                <td>Total de juros</td>
                <td>{guide.example.sacTotalInterest}</td>
                <td>{guide.example.priceTotalInterest}</td>
              </tr>
              <tr>
                <td>CET</td>
                <td>{guide.example.sacCet}</td>
                <td>{guide.example.priceCet}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className={styles.callout}>
          É uma referência para entender a ordem de grandeza. Custos, datas, seguros e indexadores
          da sua proposta podem mudar o resultado.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Telas do app</h2>
        <div className={styles.guideScreenshots}>
          {guide.screenshots.map((screenshot) => (
            <figure key={screenshot.src} className={styles.guideScreenshot}>
              <Image
                src={screenshot.src}
                alt={screenshot.alt}
                width={360}
                height={640}
                loading="lazy"
              />
              <figcaption>{screenshot.alt}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <h2 className={styles.sectionHeading}>Perguntas frequentes</h2>
      <div className={styles.faq}>
        {guide.faq.map((f, i) => (
          <div key={i} className={styles.faqItem}>
            <div className={styles.faqQ}>{f.q}</div>
            <div className={styles.faqA}>{f.a}</div>
          </div>
        ))}
      </div>

      <div className={styles.cta}>
        <span className={styles.ctaText}>
          Compare SAC e Price, FGTS e custos no seu caso — grátis e sem cadastro.
        </span>
        <Link className={styles.ctaButton} href="/">
          Abrir o simulador →
        </Link>
      </div>

      {related.length > 0 && (
        <div>
          <h2 className={styles.sectionHeading}>Continue lendo</h2>
          <div className={styles.relatedRow}>
            {related.map((g) => (
              <Link key={g.slug} className={styles.relatedLink} href={`/guias/${g.slug}`}>
                {g.title}
              </Link>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
