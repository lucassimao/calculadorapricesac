import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Home from '../page';
import ResourcePage from '../recursos/[slug]/page';
import { resources } from '../recursos/content';
import sitemap from '../sitemap';
import { siteUrl } from '../site-url';

describe('P3.4 use-case resources', () => {
  const marketingRoot = process.cwd().endsWith(`${path.sep}marketing`)
    ? process.cwd()
    : path.join(process.cwd(), 'marketing');
  const screenshotPath = (src: string) =>
    path.join(marketingRoot, 'public', src.replace(/^\//, ''));

  const screenshotDigest = (src: string) => {
    const file = readFileSync(screenshotPath(src));
    return createHash('sha256').update(file).digest('hex');
  };

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

  it('ships varied, page-specific app captures instead of shared placeholders', () => {
    const allDigests = resources.flatMap((resource) =>
      resource.screenshots.map((screenshot) => screenshotDigest(screenshot.src)),
    );

    for (const resource of resources) {
      const pageDigests = resource.screenshots.map((screenshot) =>
        screenshotDigest(screenshot.src),
      );
      const otherDigests = new Set(
        resources
          .filter((candidate) => candidate !== resource)
          .flatMap((candidate) =>
            candidate.screenshots.map((screenshot) => screenshotDigest(screenshot.src)),
          ),
      );

      expect(new Set(pageDigests).size).toBe(resource.screenshots.length);
      expect(
        pageDigests.every((digest) => !otherDigests.has(digest)),
        `${resource.slug} must own every capture it references`,
      ).toBe(true);

      const imageSizes = resource.screenshots.map(
        (screenshot) => statSync(screenshotPath(screenshot.src)).size,
      );
      expect(imageSizes.every((size) => size <= 200 * 1024)).toBe(true);
      expect(imageSizes.reduce((total, size) => total + size, 0)).toBeLessThan(1024 * 1024);
    }

    expect(new Set(allDigests).size).toBe(allDigests.length);
  });
});
