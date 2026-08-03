import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Home from '../page';
import ResourcePage from '../recursos/[slug]/page';
import { resources } from '../recursos/content';
import sitemap from '../sitemap';
import { siteUrl } from '../site-url';

describe('P3.4 use-case resources', () => {
  it('exposes the resources section and every resource from the landing page', () => {
    render(<Home />);

    expect(screen.getByRole('link', { name: 'Recursos' })).toHaveAttribute('href', '/recursos');
    for (const resource of resources) {
      expect(
        screen
          .getAllByRole('link')
          .find((link) => link.getAttribute('href') === `/recursos/${resource.slug}`),
      ).toHaveTextContent(resource.title);
    }
  });

  it.each(resources)('renders the required product-tour shape for %s', async (resource) => {
    render(await ResourcePage({ params: Promise.resolve({ slug: resource.slug }) }));

    expect(screen.getByRole('heading', { level: 1, name: resource.title })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Como fazer no app' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(resource.steps.length);
    expect(screen.getAllByRole('img')).toHaveLength(resource.screenshots.length);
    expect(screen.getByRole('link', { name: 'Abrir o simulador web' })).toHaveAttribute(
      'href',
      '/',
    );
    expect(screen.getByRole('link', { name: 'Baixar o app' })).toBeInTheDocument();
  });

  it('enumerates the resource index and every resource page in the sitemap', () => {
    const urls = sitemap().map((entry) => entry.url);

    expect(urls).toContain(`${siteUrl}/recursos`);
    for (const resource of resources) {
      expect(urls).toContain(`${siteUrl}/recursos/${resource.slug}`);
    }
  });
});
