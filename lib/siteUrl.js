// Returns the canonical base URL for building email redirects.
// Priority: NEXT_PUBLIC_SITE_URL/SITE_URL > VERCEL_URL > window.location.origin > localhost.
export function getBaseUrl() {
  // 1) Explicit env (recommended; set on Vercel and optionally locally to force prod links)
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
  if (envUrl) return envUrl.replace(/\/$/, '');
  // 2) Vercel-provided URL (without protocol)
  const vercel = process.env.NEXT_PUBLIC_VERCEL_URL || process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`.replace(/\/$/, '');
  // 3) Browser origin (only if no explicit/base env is present)
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  // 4) Fallback to local dev
  return 'http://localhost:3000';
}

export function redirectTo(path = '/') {
  const base = getBaseUrl();
  const p = typeof path === 'string' ? path : '/';
  return `${base}${p.startsWith('/') ? p : `/${p}`}`;
}
