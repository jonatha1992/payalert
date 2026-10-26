import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import AppVersion from '../components/AppVersion';

describe('AppVersion', () => {
  it('renders the deployed version and build time', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_VERSION', '87b6d30');
    vi.stubEnv('NEXT_PUBLIC_BUILD_TIME', '25/10 23:10');
    expect(renderToStaticMarkup(createElement(AppVersion))).toContain('v87b6d30 · 25/10 23:10');
    vi.unstubAllEnvs();
  });

  it('uses dev when the version is missing', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_VERSION', '');
    vi.stubEnv('NEXT_PUBLIC_BUILD_TIME', '');
    expect(renderToStaticMarkup(createElement(AppVersion))).toContain('vdev');
    vi.unstubAllEnvs();
  });
});
