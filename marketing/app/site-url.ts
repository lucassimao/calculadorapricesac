/**
 * Canonical site origin, normalized to never end with a trailing slash.
 *
 * A trailing slash here is dangerous: every consumer builds URLs as
 * `${siteUrl}/path`, so a trailing slash produces `//path` in canonical tags,
 * Open Graph images, the sitemap and robots.txt. Stripping it once, here,
 * keeps those outputs correct regardless of how the env var is set.
 */
export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.calculadorapricesac.com.br'
).replace(/\/+$/, '');
