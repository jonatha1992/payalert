import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('dashboard responsive layout', () => {
  it('keeps KPI cards in one mobile column and two tablet columns', () => {
    const page = readFileSync(resolve(process.cwd(), 'app/dashboard/page.tsx'), 'utf8');
    expect(page).toContain('grid-cols-1 min-w-0 gap-4 sm:grid-cols-2 md:grid-cols-2');
  });

  it('gives dashboard and admin main content shrinkable width', () => {
    for (const layout of ['app/dashboard/layout.tsx', 'app/admin/layout.tsx']) {
      const source = readFileSync(resolve(process.cwd(), layout), 'utf8');
      expect(source).toContain('min-w-0 flex-1');
      expect(source).toContain('w-full min-w-0 max-w-7xl');
    }
  });
});
