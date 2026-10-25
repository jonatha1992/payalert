import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

describe('apps vinculadas placement', () => {
  it('shows the apps route in the admin menu', () => {
    expect(read('components/AdminSidebar.tsx')).toContain("href: '/admin/client-apps'");
  });
  it('does not show the apps route in the owner menu and redirects its old URL', () => {
    expect(read('components/DashboardSidebar.tsx')).not.toContain("href: '/dashboard/apps'");
    expect(read('app/dashboard/apps/page.tsx')).toContain("redirect('/dashboard')");
  });
});
