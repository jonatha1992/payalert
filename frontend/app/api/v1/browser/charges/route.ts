import { NextRequest, NextResponse } from 'next/server';
import { loadClientApp, originAllowedForAnyApp } from '@/lib/server/clientApps';
import { verifyFirebaseIdToken } from '@/lib/server/firebaseIdToken';
import { corsHeaders } from '@/lib/server/hubHttp';
import { getServiceClient } from '@/lib/server/session';
import { createBrowserCharge } from '@/lib/server/browserCharge';
import { findCharge } from '@/lib/server/hubCharges';
import { recordAuditEvent } from '@/lib/server/audit';
async function audit(app: Awaited<ReturnType<typeof loadClientApp>>, result: string) { if (app) try { await recordAuditEvent(getServiceClient(), { businessId: app.business_id, actorId: null, action: 'browser_charge', entityType: 'client_app', entityId: app.id, newData: { result } }); } catch (error) { console.error('[browser/charges] audit_failed', error); } }
export async function OPTIONS(request: NextRequest) { const origin = request.headers.get('origin'); if (!origin || !await originAllowedForAnyApp(origin)) return new NextResponse(null, { status: 403 }); return new NextResponse(null, { status: 204, headers: { ...corsHeaders(origin), 'Access-Control-Allow-Headers': 'Authorization, Content-Type' } }); }
export async function POST(request: NextRequest) {
 const origin = request.headers.get('origin'); let app: Awaited<ReturnType<typeof loadClientApp>> = null;
 const respond = (status: number, body: Record<string, unknown>, cors = false) => NextResponse.json(body, { status, headers: cors && origin ? corsHeaders(origin) : {} });
 let body: Record<string, unknown>; try { const parsed = await request.json(); if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(); body = parsed; } catch { return respond(400, { error: 'invalid_request', code: 'invalid_request' }); }
 if (typeof body.app !== 'string' || !body.app) return respond(400, { error: 'invalid_app', code: 'invalid_app' });
 try { app = await loadClientApp(body.app); } catch { return respond(500, { error: 'app_lookup_failed', code: 'app_lookup_failed' }); }
 if (!app) return respond(404, { error: 'app_not_found', code: 'app_not_found' });
 if (!origin || !app.allowed_origins.includes(origin)) { await audit(app, 'origin_denied'); return respond(403, { error: 'origin_not_allowed', code: 'origin_not_allowed' }); }
 const token = (request.headers.get('authorization') ?? '').match(/^Bearer\s+(.+)$/i)?.[1];
 const identity = app.firebase_project_id && token ? await verifyFirebaseIdToken(token, app.firebase_project_id) : { ok: false as const, reason: 'malformed' as const };
 if (!identity.ok) { await audit(app, 'unauthorized'); return respond(401, { error: 'invalid_token', code: identity.reason }, true); }
 if (typeof body.bookingId !== 'string' || !/^[A-Za-z0-9_-]{4,64}$/.test(body.bookingId)) return respond(400, { error: 'invalid_booking_id', code: 'invalid_booking_id' }, true);
 try { const existing = await findCharge(app.id, body.bookingId); if (existing?.status === 'approved') { await audit(app, 'already_paid'); return respond(409, { error: 'already_paid', code: 'already_paid' }, true); } if (existing?.status === 'pending' && existing.init_point) { await audit(app, 'idempotent_pending'); return respond(200, { init_point: existing.init_point, status: 'pending' }, true); } if (!app.connection_id) { await audit(app, 'not_connected'); return respond(409, { error: 'not_connected', code: 'not_connected' }, true); } const amount = app.deposit_default; if (!Number.isInteger(amount) || amount < 1 || amount > 1_000_000) return respond(422, { error: 'invalid_deposit', code: 'invalid_deposit' }, true); const result = await createBrowserCharge(app, body.bookingId, amount, typeof body.payerName === 'string' ? body.payerName : undefined, origin); await audit(app, 'created'); return respond(200, result, true); }
 catch (error) { const msg = error instanceof Error ? error.message : ''; const code = msg === 'not_connected' || msg === 'charge_in_progress' ? msg : 'charge_creation_failed'; await audit(app, code); return respond(code === 'not_connected' || code === 'charge_in_progress' ? 409 : 500, { error: code, code }, true); }
}
