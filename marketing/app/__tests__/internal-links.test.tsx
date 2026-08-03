import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/font/google', () => ({
  Fraunces: () => ({ variable: '' }),
  Manrope: () => ({ variable: '' }),
}));

import Home from '../page';
import RootLayout from '../layout';
import GuidePage from '../guias/[slug]/page';
import { guides } from '../guias/content';
import ResourcePage from '../recursos/[slug]/page';

describe('P3.5 internal links', () => {
  it('links from the landing page to the guides index and every guide', () => {
    render(<Home />);

    expect(screen.getByRole('link', { name: 'Guias' })).toHaveAttribute('href', '/guias');
    expect(
      screen.getByRole('heading', { name: 'Guias de financiamento imobiliário' }),
    ).toBeInTheDocument();

    for (const guide of guides) {
      const link = screen
        .getAllByRole('link')
        .find((candidate) => candidate.getAttribute('href') === `/guias/${guide.slug}`);
      expect(link).toBeTruthy();
      expect(link).toHaveTextContent(guide.title);
    }
  });

  it('keeps the guides index reachable from the footer', () => {
    render(
      <RootLayout>
        <div />
      </RootLayout>,
    );

    expect(screen.getByRole('contentinfo')).toHaveTextContent('Guias');
    expect(screen.getByRole('contentinfo').querySelector('a[href="/guias"]')).toBeTruthy();
  });

  it.each(guides)('links %s to its related resource page', async (guide) => {
    render(await GuidePage({ params: Promise.resolve({ slug: guide.slug }) }));

    expect(screen.getByRole('link', { name: 'Ver recurso relacionado' })).toHaveAttribute(
      'href',
      `/recursos/${guide.resourceSlug}`,
    );
  });

  it('links the amortization resource back to the amortize-or-invest guide', async () => {
    render(
      await ResourcePage({
        params: Promise.resolve({ slug: 'amortizacao-reduzir-prazo-ou-parcela' }),
      }),
    );

    expect(
      screen.getByRole('link', { name: 'Amortizar ou investir: como decidir →' }),
    ).toHaveAttribute('href', '/guias/amortizar-financiamento-ou-investir');
  });

  it('links the amortization resource back to the goal-based optimizer guide', async () => {
    render(
      await ResourcePage({
        params: Promise.resolve({ slug: 'amortizacao-reduzir-prazo-ou-parcela' }),
      }),
    );

    expect(
      screen.getByRole('link', { name: 'Melhor estratégia para amortizar →' }),
    ).toHaveAttribute('href', '/guias/melhor-estrategia-amortizar-financiamento');
  });
});
