export function safeInternalPath(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\') || value.includes('\\')) return '/dashboard';
  const parsed = new URL(value, 'https://internal.invalid');
  if (parsed.origin !== 'https://internal.invalid' || parsed.pathname === '/auth/callback' || parsed.pathname.startsWith('/auth/callback/')) return '/dashboard';
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}
