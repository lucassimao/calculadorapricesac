import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { captureMarketingEvent, vercelTrack } = vi.hoisted(() => ({
  captureMarketingEvent: vi.fn(),
  vercelTrack: vi.fn(),
}));

vi.mock('../lib/analytics', () => ({ captureMarketingEvent }));
vi.mock('@vercel/analytics', () => ({ track: vercelTrack }));

import { AppStoreLink } from '../AppStoreLink';
import { Simulator } from '../components/Simulator/Simulator';

describe('marketing funnel events', () => {
  beforeEach(() => {
    captureMarketingEvent.mockClear();
    vercelTrack.mockClear();
  });

  it('sends app_store_click to PostHog while preserving Vercel Analytics', () => {
    render(
      <AppStoreLink href="https://apps.apple.com/example" location="hero">
        Baixar
      </AppStoreLink>,
    );

    fireEvent.click(screen.getByRole('link', { name: 'Baixar' }));

    expect(captureMarketingEvent).toHaveBeenCalledWith('app_store_click', { location: 'hero' });
    expect(vercelTrack).toHaveBeenCalledWith('app_store_click', { location: 'hero' });
  });

  it('sends one simulator_interacted event on the first input change', () => {
    render(<Simulator />);

    fireEvent.change(screen.getByLabelText('Entrada'), { target: { value: '90000' } });
    fireEvent.change(screen.getByLabelText('Taxa de juros anual'), { target: { value: '12' } });

    expect(captureMarketingEvent).toHaveBeenCalledTimes(1);
    expect(captureMarketingEvent).toHaveBeenCalledWith('simulator_interacted');
  });
});
