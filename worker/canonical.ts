// SPDX-License-Identifier: MIT
/** Page redirects preserve table links. API callers retain their existing origin contract. */
export function canonicalPage(request: Request): Response | undefined {
  if (!['GET', 'HEAD'].includes(request.method)) return;
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) return;
  const host = url.hostname;
  if (!['clickclacks.app', 'dice.clickclacks.app', 'app.clickclacks.app'].includes(host)) return;
  const target = new URL(url);
  target.protocol = 'https:';
  target.port = '';
  if (host === 'app.clickclacks.app') target.hostname = 'dice.clickclacks.app';
  if (target.pathname === '/index.html' || (host === 'clickclacks.app' && target.pathname === '/landing.html')) target.pathname = '/';
  return target.href === url.href ? undefined : Response.redirect(target.href, 308);
}
