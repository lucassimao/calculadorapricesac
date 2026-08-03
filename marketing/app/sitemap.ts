import type { MetadataRoute } from 'next';
import { siteUrl } from './site-url';
import { guides } from './guias/content';
import { resources } from './recursos/content';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    {
      url: `${siteUrl}/`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 1,
    },
    {
      url: `${siteUrl}/guias`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    ...guides.map((g) => ({
      url: `${siteUrl}/guias/${g.slug}`,
      lastModified: new Date(g.updated),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
    {
      url: `${siteUrl}/recursos`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    ...resources.map((resource) => ({
      url: `${siteUrl}/recursos/${resource.slug}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
    {
      url: `${siteUrl}/privacidade`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.5,
    },
    {
      url: `${siteUrl}/termos`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.5,
    },
    {
      url: `${siteUrl}/suporte`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.6,
    },
  ];
}
