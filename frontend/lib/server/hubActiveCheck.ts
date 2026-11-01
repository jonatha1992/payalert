import 'server-only';
import { getConnector } from '@/lib/payments/connectors';
import { decryptSecret } from '@/lib/payments/secretBox';
import { SupabasePaymentsRepository } from '@/lib/server/paymentsRepository';
import { getServiceClient } from '@/lib/server/session';
import { applyHubPayment } from '@/lib/server/hubWebhook';
import type { ClientApp } from '@/lib/server/clientApps';
import type { HubCharge } from '@/lib/server/hubCharges';

const MIN_INTERVAL_MS = 20_000;
const lastCheck = new Map<string, number>();

/** Fallback when the MP webhook is missed: ask MP directly for payments of a pending charge. */
export async function activeCheckCharge(app: ClientApp, charge: HubCharge, deps: {
  fetchImpl?: typeof fetch; now?: () => number;
} = {}): Promise<boolean> {
  if (charge.status !== 'pending' && charge.status !== 'expired') return false;
  if (!charge.external_reference || !app.connection_id) return false;
  const now = (deps.now ?? Date.now)();
  if (now - (lastCheck.get(charge.id) ?? 0) < MIN_INTERVAL_MS) return false;
  lastCheck.set(charge.id, now);
  const db = getServiceClient();
  const { data: row, error } = await db.from('payment_connections').select('credentials_encrypted')
    .eq('id', app.connection_id).maybeSingle<{ credentials_encrypted: string }>();
  if (error || !row) return false;
  const { access_token } = JSON.parse(decryptSecret(row.credentials_encrypted)) as { access_token: string };
  const url = `https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(charge.external_reference)}&sort=date_created&criteria=desc`;
  const res = await (deps.fetchImpl ?? fetch)(url, { headers: { Authorization: `Bearer ${access_token}` } });
  if (!res.ok) return false;
  const body = await res.json() as { results?: Array<{ id: number | string }> };
  const ids = (body.results ?? []).map((p) => String(p.id)).slice(0, 5);
  if (!ids.length) return false;
  const repo = new SupabasePaymentsRepository(db);
  const connection = await repo.findConnectionById(app.connection_id);
  if (!connection) return false;
  const connector = getConnector('mercado_pago');
  for (const id of ids) {
    const payment = await connector.fetchTransaction(connection, id);
    await applyHubPayment(payment, db);
  }
  return true;
}
