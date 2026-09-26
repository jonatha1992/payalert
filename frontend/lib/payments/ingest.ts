import { ProviderError } from './connectors/errors';
import { asIdentifier, readWebhookBody } from './connectors/payload';
import { matchTransaction, type MatchResult } from './matching';
import type { ExpectedPayment, ExpectedPaymentStatus, MovementStatus, NormalizedTransaction,
  PaymentConnection, PaymentConnector, Provider, WebhookRequest } from './types';

export type WebhookLogStatus = 'unmatched' | 'invalid' | 'ignored' | 'failed' | 'processed' | 'duplicate';

/** Deliberately excludes raw requests, provider bodies, payer details and credentials. */
export interface WebhookLogEntry {
  provider: Provider;
  status: WebhookLogStatus;
  receivedAt: string;
  connectionId: string | null;
  businessId: string | null;
  transactionId?: string;
  reason?: string;
  providerStatus?: number;
}

export interface PaymentAuditEntry {
  action: 'payment_ingested';
  businessId: string;
  connectionId: string;
  transactionId: string;
  previousStatus: MovementStatus | null;
  status: MovementStatus;
  occurredAt: string;
}

export type StatusTransitionPolicy = (previous: MovementStatus, next: MovementStatus) => boolean;

export interface PaymentsRepository {
  findConnectionByProviderAccount(provider: Provider, providerAccountId: string): Promise<PaymentConnection | null>;
  findConnectionByOrder(provider: Provider, providerOrderId: string): Promise<PaymentConnection | null>;
  findConnectionById(id: string): Promise<PaymentConnection | null>;
  /**
   * Atomically insert or update under a unique (provider, externalId) key. On conflict,
   * verify business ownership, then apply canTransition to the stored status before
   * writing anything. A denied transition must leave the entire row unchanged.
   * Return the status observed inside that same atomic operation, including for no-ops.
   * Database adapters must use a lock/transaction or equivalent compare-and-swap.
   */
  upsertTransaction(
    businessId: string, storeId: string | null, tx: NormalizedTransaction, canTransition: StatusTransitionPolicy,
  ): Promise<{ id: string; created: boolean; previousStatus: MovementStatus | null }>;
  listOpenExpectedPayments(businessId: string, storeId?: string | null): Promise<ExpectedPayment[]>;
  /** Persist only a WAITING candidate owned by the transaction's business and store. */
  markExpectedPayment(id: string, status: ExpectedPaymentStatus, transactionId: string): Promise<void>;
  logWebhook(entry: WebhookLogEntry): Promise<void>;
  audit(entry: PaymentAuditEntry): Promise<void>;
}

export interface IngestResult {
  httpStatus: number;
  outcome: WebhookLogStatus;
  transactionId?: string;
  notify?: boolean;
  notification?: Pick<NormalizedTransaction, 'amount' | 'currency' | 'occurredAt' | 'provider'> & { storeId: string | null };
  match?: MatchResult;
}

export interface IngestWebhookInput {
  provider: Provider;
  request: WebhookRequest;
  repo: PaymentsRepository;
  connectorFactory: (provider: Provider) => PaymentConnector;
  /** Milliseconds since Unix epoch, matching Date.now. */
  now?: () => number;
}

/** Unknown can acquire a known status; terminal rejection/reversal cannot reopen. */
export function canTransitionStatus(previous: MovementStatus, next: MovementStatus): boolean {
  if (previous === next) return false;
  if (previous === 'UNKNOWN') return next !== 'UNKNOWN';
  if (previous === 'PENDING') return next === 'CONFIRMED' || next === 'REJECTED';
  return previous === 'CONFIRMED' && next === 'REVERSED';
}

async function resolveConnection(
  provider: Provider, request: WebhookRequest, repo: PaymentsRepository,
): Promise<PaymentConnection | null> {
  const body = readWebhookBody(request);
  const account = provider === 'mercado_pago' ? asIdentifier(body?.user_id) : null;
  const order = provider === 'uala' ? asIdentifier(body?.uuid) : null;
  let owner: PaymentConnection | null = null;
  if (account) {
    owner = await repo.findConnectionByProviderAccount(provider, account);
    // An explicit account must resolve; a caller-supplied hint cannot replace its owner.
    if (!owner || owner.providerAccountId !== account) return null;
  } else if (order) {
    owner = await repo.findConnectionByOrder(provider, order);
  }
  if (owner && owner.provider !== provider) return null;
  if (request.query.connection) {
    const hint = await repo.findConnectionById(request.query.connection);
    if (!hint || hint.provider !== provider || (owner && hint.id !== owner.id)) return null;
    return owner ?? hint;
  }
  return owner;
}

const safeParseReasons = new Set([
  'invalid_body', 'missing_id', 'missing_uuid', 'missing_secret', 'missing_signature',
  'malformed_signature', 'missing_timestamp', 'missing_hash', 'signature_mismatch',
  'timestamp_out_of_tolerance',
]);

export async function ingestWebhook({
  provider, request, repo, connectorFactory, now = Date.now,
}: IngestWebhookInput): Promise<IngestResult> {
  const receivedAt = new Date(now()).toISOString();
  const connection = await resolveConnection(provider, request, repo);
  async function finish(result: IngestResult, detail: { reason?: string; providerStatus?: number } = {}) {
    await repo.logWebhook({ provider, status: result.outcome, receivedAt,
      connectionId: connection?.id ?? null, businessId: connection?.businessId ?? null,
      ...(result.transactionId ? { transactionId: result.transactionId } : {}), ...detail });
    return result;
  }
  if (!connection) return finish({ httpStatus: 200, outcome: 'unmatched' });
  const connector = connectorFactory(provider);
  const parsed = connector.parseWebhook(request, connection);
  if (parsed.kind === 'rejected') {
    return finish({ httpStatus: 401, outcome: 'invalid' },
      { reason: safeParseReasons.has(parsed.reason) ? parsed.reason : 'invalid_notification' });
  }
  if (parsed.kind === 'ignored') {
    return finish({ httpStatus: 200, outcome: 'ignored' }, { reason: 'unsupported_type' });
  }

  let tx: NormalizedTransaction;
  try {
    tx = await connector.fetchTransaction(connection, parsed.externalId);
  } catch (error) {
    const providerError = error instanceof ProviderError ? error : null;
    return finish({ httpStatus: providerError && !providerError.retriable ? 200 : 500, outcome: 'failed' },
      { reason: 'fetch_failed', ...(providerError ? { providerStatus: providerError.status } : {}) });
  }
  if (tx.providerAccountId && connection.providerAccountId && tx.providerAccountId !== connection.providerAccountId) {
    return finish({ httpStatus: 200, outcome: 'invalid' }, { reason: 'account mismatch' });
  }

  let result: IngestResult;
  try {
    const persisted = await repo.upsertTransaction(connection.businessId, connection.storeId, tx, canTransitionStatus);
    const changed = persisted.created || (persisted.previousStatus !== null && canTransitionStatus(persisted.previousStatus, tx.status));
    result = { httpStatus: 200, outcome: changed ? 'processed' : 'duplicate', transactionId: persisted.id };
    if (changed && tx.status === 'CONFIRMED') {
          const candidates = await repo.listOpenExpectedPayments(connection.businessId, connection.storeId);
          // Preserve the tenant/store boundary even if an adapter accidentally returns extra rows.
          const scoped = candidates.filter((candidate) => candidate.businessId === connection.businessId
            && (connection.storeId === null || candidate.storeId === connection.storeId));
          result.match = matchTransaction(tx, scoped);
          if (result.match.decision === 'AUTO' && result.match.expectedPaymentId) {
            await repo.markExpectedPayment(result.match.expectedPaymentId, 'MATCHED', persisted.id);
          } else if (result.match.decision === 'MANUAL_REVIEW' || result.match.decision === 'SUGGESTED') {
            // Persist candidates for manual resolution (MANUAL_REVIEW) or suggested review (SUGGESTED)
            for (const candidate of result.match.candidates.filter((candidate) => candidate.score >= 70)) {
              await repo.markExpectedPayment(candidate.id, 'MANUAL_REVIEW', persisted.id);
            }
          }
          result.notify = true;
          result.notification = { amount: tx.amount, currency: tx.currency, occurredAt: tx.occurredAt,
            storeId: connection.storeId, provider: tx.provider };
        }
    if (changed) {
      await repo.audit({ action: 'payment_ingested', businessId: connection.businessId, connectionId: connection.id,
        transactionId: persisted.id, previousStatus: persisted.previousStatus, status: tx.status, occurredAt: receivedAt });
    }
  } catch {
    return finish({ httpStatus: 500, outcome: 'failed' }, { reason: 'persistence_failed' });
  }
  return finish(result);
}
