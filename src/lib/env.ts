/** URL pública do site (para sitemap e metadados). Opcional: defina SITE_URL na Vercel se tiver domínio próprio. */
export function siteUrl(source: Record<string, string | undefined> = process.env): string {
  const explicit = source.SITE_URL?.trim();
  if (explicit && /^https?:\/\//.test(explicit)) return explicit.replace(/\/+$/, '');
  if (source.VERCEL_ENV === 'production' && source.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${source.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (source.VERCEL_URL) return `https://${source.VERCEL_URL}`;
  return 'http://localhost:3000';
}
