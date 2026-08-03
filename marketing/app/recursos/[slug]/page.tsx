import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import styles from '../recursos.module.css';
import { AppStoreLink } from '../../AppStoreLink';
import { siteUrl } from '../../site-url';
import { resourceBySlug, resources } from '../content';

const appStoreUrl = 'https://apps.apple.com/br/app/calculadora-sac-price/id6757717537';

export function generateStaticParams() {
  return resources.map((resource) => ({ slug: resource.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const resource = resourceBySlug(slug);
  if (!resource) return {};
  const url = `${siteUrl}/recursos/${resource.slug}`;
  return {
    title: { absolute: resource.metaTitle },
    description: resource.description,
    alternates: { canonical: `/recursos/${resource.slug}` },
    openGraph: {
      title: resource.metaTitle,
      description: resource.description,
      url,
      type: 'article',
      images: [
        { url: `${siteUrl}${resource.screenshots[0].src}`, alt: resource.screenshots[0].alt },
      ],
    },
    twitter: { title: resource.metaTitle, description: resource.description },
  };
}

export default async function ResourcePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const resource = resourceBySlug(slug);
  if (!resource) notFound();

  const url = `${siteUrl}/recursos/${resource.slug}`;
  const related = resource.related
    .map((relatedSlug) => resourceBySlug(relatedSlug))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: resource.title,
      description: resource.description,
      inLanguage: 'pt-BR',
      mainEntityOfPage: url,
      author: { '@type': 'Person', name: 'Lucas Simão Costa' },
      publisher: { '@type': 'Organization', name: 'Calculadora Price & SAC' },
      image: `${siteUrl}${resource.screenshots[0].src}`,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: resource.faq.map((faq) => ({
        '@type': 'Question',
        name: faq.q,
        acceptedAnswer: { '@type': 'Answer', text: faq.a },
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Recursos', item: `${siteUrl}/recursos` },
        { '@type': 'ListItem', position: 2, name: resource.title, item: url },
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
        <Link href="/recursos">Recursos</Link> / {resource.title}
      </nav>
      <div>
        <h1 className={styles.title}>{resource.title}</h1>
        <p className={styles.lead}>
          {resource.hook} {resource.description}
        </p>
      </div>
      <div className={styles.cta}>
        <span className={styles.ctaText}>Teste esta simulação com seus próprios números.</span>
        <Link className={styles.ctaButton} href="/">
          Abrir o simulador web
        </Link>
      </div>
      <section className={styles.section}>
        <h2>Como fazer no app</h2>
        <ol className={styles.steps}>
          {resource.steps.map((step) => (
            <li key={step} className={styles.step}>
              {step}
            </li>
          ))}
        </ol>
      </section>
      <section className={styles.section}>
        <h2>Telas do app</h2>
        <div className={styles.screenshotGrid}>
          {resource.screenshots.map((screenshot) => (
            <figure key={screenshot.src} className={styles.screenshot}>
              <Image
                src={screenshot.src}
                alt={screenshot.alt}
                width={360}
                height={640}
                loading="lazy"
              />
              <figcaption className={styles.caption}>{screenshot.alt}</figcaption>
            </figure>
          ))}
        </div>
      </section>
      <AppStoreLink className={styles.ctaButton} href={appStoreUrl} location="resource">
        Baixar o app
      </AppStoreLink>
      <section>
        <h2 className={styles.sectionHeading}>Perguntas frequentes</h2>
        <div className={styles.faq}>
          {resource.faq.map((faq) => (
            <div key={faq.q} className={styles.faqItem}>
              <div className={styles.faqQ}>{faq.q}</div>
              <div className={styles.faqA}>{faq.a}</div>
            </div>
          ))}
        </div>
      </section>
      <div>
        <h2 className={styles.sectionHeading}>Leia também</h2>
        <div className={styles.related}>
          <Link className={styles.relatedLink} href={`/guias/${resource.guideSlug}`}>
            Guia relacionado →
          </Link>
          {resource.relatedGuides?.map((guide) => (
            <Link key={guide.slug} className={styles.relatedLink} href={`/guias/${guide.slug}`}>
              {guide.title} →
            </Link>
          ))}
          {related.map((item) => (
            <Link key={item.slug} className={styles.relatedLink} href={`/recursos/${item.slug}`}>
              {item.title} →
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
