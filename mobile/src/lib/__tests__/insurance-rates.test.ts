import { describe, expect, it } from 'vitest';
import { MIP_RATE_TABLE, getEstimatedMipRateForAge } from '../insurance-rates';

describe('MIP age presets', () => {
  it('ships traceable, versioned bank/product/date/source metadata', () => {
    expect(MIP_RATE_TABLE.version).toBe('mip-estimate-itau-base-brasilseg-v1');
    expect(MIP_RATE_TABLE.bank).toContain('Itaú');
    expect(MIP_RATE_TABLE.bank).toContain('Brasilseg/BB');
    expect(MIP_RATE_TABLE.product).toContain('Referência combinada');
    expect(MIP_RATE_TABLE.referenceDate).toContain('2008-03');
    expect(MIP_RATE_TABLE.sourceUrl).toMatch(/^https:\/\//);
    expect(MIP_RATE_TABLE.ageProgressionSourceUrl).toContain('bb.com.br');
    expect(MIP_RATE_TABLE.ageProgressionVersion).toBe('Brasilseg SH/AM 3.1');
  });

  it('uses the published age-28 rate for its age band and rejects invalid ages', () => {
    expect(getEstimatedMipRateForAge(28)).toBe(0.0202);
    expect(getEstimatedMipRateForAge(30)).toBe(0.0202);
    expect(getEstimatedMipRateForAge(0)).toBeNull();
    expect(getEstimatedMipRateForAge(81)).toBeNull();
  });
});
