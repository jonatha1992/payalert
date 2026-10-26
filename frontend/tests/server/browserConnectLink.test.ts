import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { loadClientApp, createConnectInvite, verifyFirebaseIdToken } = vi.hoisted(() => ({ loadClientApp: vi.fn(), createConnectInvite: vi.fn(), verifyFirebaseIdToken: vi.fn() }));
vi.mock('@/lib/server/clientApps', () => ({ loadClientApp }));
vi.mock('@/lib/server/connectInvites', () => ({ createConnectInvite, ConnectInviteError: class extends Error {} }));
vi.mock('@/lib/server/firebaseIdToken', () => ({ verifyFirebaseIdToken }));

import { POST } from '@/app/api/v1/browser/connect-link/route';

const app = { id: 'app-1', slug: 'huellitas', active: true, connection_id: null, firebase_project_id: 'huellitas-prod', owner_emails: ['owner@example.com'], allowed_origins: ['https://huellitas.test'], business_id: 'biz', api_key_hash: 'hash', deposit_default: 100 };
const request = (origin = 'https://huellitas.test', token = 'valid-token') => new NextRequest('https://payalert.test/api/v1/browser/connect-link', { method: 'POST', headers: { origin, authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ app: 'huellitas' }) });

beforeEach(() => { vi.clearAllMocks(); loadClientApp.mockResolvedValue(app); verifyFirebaseIdToken.mockResolvedValue({ uid: 'uid-1', email: 'owner@example.com' }); createConnectInvite.mockResolvedValue({ url: 'https://payalert.test/connect/invite', expires_at: '2099-01-01T00:00:00.000Z' }); });

describe('browser connect link', () => {
  it('returns 401 for an invalid Firebase token', async () => {
    verifyFirebaseIdToken.mockResolvedValue(null);
    const response = await POST(request());
    if (!response) throw new Error('POST did not return a response');
    expect(response.status).toBe(401);
    expect(createConnectInvite).not.toHaveBeenCalled();
  });

  it('returns 403 when the authenticated email is not an owner', async () => {
    verifyFirebaseIdToken.mockResolvedValue({ uid: 'uid-2', email: 'other@example.com' });
    const response = await POST(request());
    if (!response) throw new Error('POST did not return a response');
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Solo la dueña puede conectar Mercado Pago' });
  });

  it('returns 403 for an unapproved browser origin', async () => {
    const response = await POST(request('https://attacker.test'));
    if (!response) throw new Error('POST did not return a response');
    expect(response.status).toBe(403);
    expect(verifyFirebaseIdToken).not.toHaveBeenCalled();
  });

  it('returns the shared connection invitation for the verified owner', async () => {
    const response = await POST(request());
    if (!response) throw new Error('POST did not return a response');
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ url: 'https://payalert.test/connect/invite' });
    expect(createConnectInvite).toHaveBeenCalledWith('app-1', expect.any(String));
  });

  it('returns connected when the app already has a connection', async () => {
    loadClientApp.mockResolvedValue({ ...app, connection_id: 'connection-1' });
    const response = await POST(request());
    if (!response) throw new Error('POST did not return a response');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ connected: true });
    expect(createConnectInvite).not.toHaveBeenCalled();
  });
});
