export interface MipRateBand {
  minAge: number;
  maxAge: number;
  monthlyRate: number;
}

/**
 * Versioned estimate table used only to prefill the manually editable MIP rate.
 * Itaú publishes 0.0202% a.m. for an age-28 borrower. Later bands apply the
 * cumulative Brasilseg/BB SH/AM v3.1 reenquadramento percentages to that base.
 * Combining sources makes this a comparison estimate, never an insurer quote.
 */
export const MIP_RATE_TABLE = {
  version: 'mip-estimate-itau-base-brasilseg-v1',
  bank: 'Itaú (taxa-base) + Brasilseg/BB (progressão)',
  product: 'Referência combinada de seguro habitacional',
  referenceDate: 'Itaú 2008-03; Brasilseg SH/AM v3.1',
  sourceUrl: 'https://ww3.itau.com.br/imobline/pre/pdf/calculoprestacao.pdf',
  ageProgressionSourceUrl: 'https://www.bb.com.br/docs/pub/siteEsp/dimob/Seg6102.pdf',
  ageProgressionVersion: 'Brasilseg SH/AM 3.1',
  reviewedAt: '2026-08-03',
  estimateNotice: 'estimativa — confira sua apólice',
  bands: [
    { minAge: 18, maxAge: 30, monthlyRate: 0.0202 },
    { minAge: 31, maxAge: 35, monthlyRate: 0.02972 },
    { minAge: 36, maxAge: 40, monthlyRate: 0.04107 },
    { minAge: 41, maxAge: 45, monthlyRate: 0.05309 },
    { minAge: 46, maxAge: 50, monthlyRate: 0.0788 },
    { minAge: 51, maxAge: 55, monthlyRate: 0.13473 },
    { minAge: 56, maxAge: 60, monthlyRate: 0.29618 },
    { minAge: 61, maxAge: 65, monthlyRate: 0.55931 },
    { minAge: 66, maxAge: 70, monthlyRate: 0.75965 },
    { minAge: 71, maxAge: 75, monthlyRate: 1.07655 },
    { minAge: 76, maxAge: 80, monthlyRate: 1.21112 },
  ] satisfies MipRateBand[],
} as const;

export function getEstimatedMipRateForAge(age: number): number | null {
  if (!Number.isInteger(age)) return null;
  return (
    MIP_RATE_TABLE.bands.find((band) => age >= band.minAge && age <= band.maxAge)?.monthlyRate ??
    null
  );
}
