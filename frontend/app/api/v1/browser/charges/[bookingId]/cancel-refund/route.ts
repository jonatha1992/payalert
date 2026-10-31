import { NextRequest, NextResponse } from 'next/server';
import { loadClientApp, originAllowedForAnyApp } from '@/lib/server/clientApps';
import { verifyFirebaseIdToken } from '@/lib/server/firebaseIdToken';
import { corsHeaders } from '@/lib/server/hubHttp';
import { findCharge, transitionCharge } from '@/lib/server/hubCharges';
import { completeRefund } from '@/lib/server/hubRefund';
import { getServiceClient } from '@/lib/server/session';

const DAY_MS = 24 * 60 * 60 * 1000;
const TIME_ZONE = 'America/Argentina/Buenos_Aires';
type FirestoreDocument = { fields?: Record<string, { stringValue?: unknown }> };

function bookingField(document: FirestoreDocument, key: string): string | undefined {
  const value = document.fields?.[key]?.stringValue;
  return typeof value === 'string' ? value : undefined;
}

function appointmentTimestamp(date: string, time: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  if (month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59) return null;
  const probe = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return null;
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(probe);
  const local = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const wallTimeAsUtc = Date.UTC(Number(local.year), Number(local.month) - 1, Number(local.day), Number(local.hour), Number(local.minute));
  const offset = wallTimeAsUtc - probe.getTime();
  return Date.UTC(year, month - 1, day, hour, minute) - offset;
}

async function readBooking(projectId: string, bookingId: string, token: string): Promise<FirestoreBooking | null> {
  const path = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/bookings/${encodeURIComponent(bookingId)}`;
  const response = await fetch(path, { headers: { Authorization: `Bearer ${token}` } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('booking_read_failed');
  const document = await response.json() as FirestoreDocument;
  return { uid: bookingField(document, 'uid'), date: bookingField(document, 'date'), time: bookingField(document, 'time'), status: bookingField(document, 'status') };
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!origin || !await originAllowedForAnyApp(origin)) return new NextResponse(null, { status: 403 });
  return new NextResponse(null, { status: 204, headers: { ...corsHeaders(origin), 'Access-Control-Allow-Headers': 'Authorization, Content-Type' } });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ bookingId: string }> }) {
  const origin = request.headers.get('origin');
  const appSlug = new URL(request.url).searchParams.get('app');
  const respond = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status, headers: origin ? corsHeaders(origin) : {} });
  if (!appSlug) return respond(400, { error: 'invalid_app' });
  let app;
  try { app = await loadClientApp(appSlug); } catch { return respond(502, { error: 'booking_unavailable' }); }
  if (!app) return respond(404, { error: 'app_not_found' });
  if (!origin || !app.allowed_origins.includes(origin)) return respond(403, { error: 'origin_not_allowed' });
  const token = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return respond(401, { error: 'unauthorized' });
  if (!app.firebase_project_id) return respond(502, { error: 'booking_unavailable' });
  const identity = await verifyFirebaseIdToken(token, app.firebase_project_id);
  if (!identity.ok) return respond(401, { error: 'invalid_token' });

  const { bookingId } = await params;
  if (!/^[A-Za-z0-9_-]{4,64}$/.test(bookingId)) return respond(400, { error: 'invalid_booking_id' });
  let booking: FirestoreBooking | null;
  try { booking = await readBooking(app.firebase_project_id, bookingId, token); } catch { return respond(502, { error: 'booking_unavailable' }); }
  if (!booking || booking.uid !== identity.uid) return respond(403, { error: 'not_owner' });
  if (booking.status === 'cancelado') {
    const prior = await findCharge(app.id, bookingId);
    if (prior?.status === 'refunded') return respond(200, { status: 'already_refunded' });
  }
  const charge = await findCharge(app.id, bookingId);
  if (charge?.status === 'refunded') return respond(200, { status: 'already_refunded' });
  if (!charge || charge.status !== 'approved' || !charge.payment_id) return respond(409, { error: 'not_paid' });
  const appointment = typeof booking.date === 'string' && typeof booking.time === 'string' ? appointmentTimestamp(booking.date, booking.time) : null;
  if (appointment === null || appointment - Date.now() < DAY_MS) return respond(409, { error: 'too_late' });

  const claimed = await transitionCharge(charge.id, 'approved', 'refunding', { last_error: null });
  if (!claimed) {
    const latest = await findCharge(app.id, bookingId);
    return latest?.status === 'refunded' ? respond(200, { status: 'already_refunded' }) : respond(502, { error: 'refund_failed' });
  }
  try {
    const result = await completeRefund({ ...charge, status: 'refunding', client_apps: app }, getServiceClient());
    if (result !== 'approved') return respond(502, { error: 'refund_failed' });
    return respond(200, { status: 'refunded' });
  } catch (error) {
    console.error('[browser/cancel-refund] refund_failed', error instanceof Error ? error.name : 'unknown');
    return respond(502, { error: 'refund_failed' });
  }
}
