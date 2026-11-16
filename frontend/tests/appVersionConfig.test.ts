import { afterEach, describe, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

describe('Next build version configuration', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('prefers explicit version, then Vercel SHA, then git SHA; formats build time for Argentina', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_VERSION', 'manual');
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'abcdef0123456789');
    let config = await import('../next.config').then((module) => module.default);
    expect(config.env?.NEXT_PUBLIC_APP_VERSION).toBe('manual');
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_APP_VERSION', '');
    config = await import('../next.config').then((module) => module.default);
    expect(config.env?.NEXT_PUBLIC_APP_VERSION).toBe('abcdef0');

    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', '');
    vi.resetModules();
    config = await import('../next.config').then((module) => module.default);
    expect(config.env?.NEXT_PUBLIC_APP_VERSION).toBe(execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: resolve(__dirname, '../..'), encoding: 'utf8' }).trim());
    expect(config.env?.NEXT_PUBLIC_BUILD_TIME).toMatch(/^\d{2}\/\d{2} \d{2}:\d{2}$/);
    const redirects = await config.redirects?.();
    expect(redirects?.[0]).toMatchObject({ permanent: true, destination: 'https://payalert.tecnofusion.dev/:path' });
  });
});
