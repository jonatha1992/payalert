import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { loadClientApp, verifyFirebaseIdToken, insert, update } = vi.hoisted(() => ({ loadClientApp: vi.fn(), verifyFirebaseIdToken: vi.fn(), insert: vi.fn(), update: vi.fn() }));
vi.mock('@/lib/server/clientApps', () => ({ loadClientApp, originAllowedForAnyApp: vi.fn() }));
vi.mock('@/lib/server/firebaseIdToken', () => ({ verifyFirebaseIdToken }));
vi.mock('@/lib/server/session', () => ({ getServiceClient: () => ({ from: () => ({ insert, update: (v: unknown) => { update(v); return { eq: async () => ({ error: null }) }; } }) }) }));

import { PATCH } from '@/app/api/v1/browser/config/route';

const app = { id: 'app-1', slug: 'huellitas', active: true, connection_id: 'c1', firebase_project_id: 'p', owner_emails: ['owner@example.com'], allowed_origins: ['https://huellitas.test'], business_id: 'biz', deposit_default: 5 };
const req = (deposit: unknown, origin = 'https://huellitas.test') => new NextRequest('https://payalert.test/api/v1/browser/config', { method: 'PATCH', headers: { origin, authorization: 'Bearer tok', 'content-type': 'application/json' }, body: JSON.stringify({ app: 'huellitas', deposit }) });

beforeEach(() => { vi.clearAllMocks(); insert.mockResolvedValue({ error: null }); loadClientApp.mockResolvedValue(app); verifyFirebaseIdToken.mockResolvedValue({ ok: true, uid: 'u', email: 'owner@example.com' }); });

describe('browser deposit update', () => {
  it('401 con token inválido', async () => { verifyFirebaseIdToken.mockResolvedValue({ ok: false, reason: 'malformed' }); expect((await PATCH(req(10))).status).toBe(401); expect(update).not.toHaveBeenCalled(); });
  it('403 si no es la dueña', async () => { verifyFirebaseIdToken.mockResolvedValue({ ok: true, uid: 'x', email: 'otra@example.com' }); const r = await PATCH(req(10)); expect(r.status).toBe(403); expect(await r.json()).toMatchObject({ code: 'not_owner' }); expect(update).not.toHaveBeenCalled(); });
  it('403 con origen no permitido', async () => { expect((await PATCH(req(10, 'https://evil.test'))).status).toBe(403); expect(verifyFirebaseIdToken).not.toHaveBeenCalled(); });
  it('400 con monto inválido', async () => { for (const d of [0, 1.5, '10', 1_000_001]) { const r = await PATCH(req(d)); expect(r.status).toBe(400); expect(await r.json()).toMatchObject({ code: 'invalid_deposit' }); } expect(update).not.toHaveBeenCalled(); });
  it('200 actualiza y anota en bitácora', async () => { const r = await PATCH(req(5000)); expect(r.status).toBe(200); expect(await r.json()).toEqual({ deposit: 5000 }); expect(update).toHaveBeenCalledWith({ deposit_default: 5000 }); expect(insert).toHaveBeenCalledWith(expect.objectContaining({ action: 'browser_deposit_update', new_data: expect.objectContaining({ old_deposit: 5, new_deposit: 5000 }) })); });
});
