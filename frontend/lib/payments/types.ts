/**
 * Payment domain contracts (PRD sections 10-12, 17-18).
 * Everything under lib/payments is framework-free so it can be unit tested
 * without Next.js or a live Supabase instance.
 */

export type Provider = 'mercado_pago' | 'uala' | 'mock';

/** Normalized movement status (PRD section 12). */
export type MovementStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'REVERSED' | 'UNKNOWN';

export type ConnectionStatus = 'CONNECTED' | 'DEGRADED' | 'REAUTH_REQUIRED' | 'DISCONNECTED' | 'ERROR';

export type ExpectedPaymentStatus = 'WAITING' | 'MATCHED' | 'EXPIRED' | 'MANUAL_REVIEW' | 'CANCELLED';

export type MatchDecision = 'AUTO' | 'SUGGESTED' | 'MANUAL_REVIEW' | 'NO_MATCH';

/** Provider-agnostic incoming movement (PRD section 11). */
export interface NormalizedTransaction {
  provider: Provider;
  /** Provider id of the payment/order. Idempotency key together with provider. */
  externalId: string;
  /** Account id at the provider that received the money (MP collector_id / user_id). */
  providerAccountId: string | null;
  direction: 'IN' | 'OUT';
  amount: number;
  currency: string;
  status: MovementStatus;
  occurredAt: string;
  payerName: string | null;
  payerIdentifier: string | null;
  description: string | null;
  /** Reference we sent to the provider when creating a charge (expected_payments.id). */
  externalReference: string | null;
  /** Provider payload with secrets and personal data already stripped. */
  raw: Record<string, unknown>;
}

/** A provider account linked to one business. Credentials stay encrypted at rest. */
export interface PaymentConnection {
  id: string;
  businessId: string;
  storeId: string | null;
  provider: Provider;
  providerAccountId: string | null;
  status: ConnectionStatus;
  /** Decrypted credentials, only ever materialized server-side. */
  credentials: Record<string, string>;
  /** Decrypted per-connection webhook secret, if the provider signs notifications. */
  webhookSecret: string | null;
}

export interface ExpectedPayment {
  id: string;
  businessId: string;
  storeId: string | null;
  amount: number;
  currency: string;
  reference: string | null;
  status: ExpectedPaymentStatus;
  createdAt: string;
  expiresAt: string;
  provider: Provider | null;
  providerOrderId: string | null;
  checkoutUrl: string | null;
}

export interface WebhookRequest {
  headers: Record<string, string>;
  query: Record<string, string>;
  rawBody: string;
}

/** Result of parsing a webhook before any provider API call. */
export type WebhookParseResult =
  | { kind: 'ignored'; reason: string }
  | { kind: 'rejected'; reason: string }
  | {
      kind: 'accepted';
      /** Provider id to fetch (payment id, order uuid). */
      externalId: string;
      /** Hint to find the owning connection (MP user_id). */
      providerAccountId: string | null;
      /** Hint to find the owning expected payment / connection (Ualá order uuid). */
      providerOrderId: string | null;
      eventType: string;
    };

export interface CreateChargeInput {
  expectedPaymentId: string;
  amount: number;
  currency: string;
  description: string;
  notificationUrl: string;
  successUrl: string;
  failureUrl: string;
}

export interface CreateChargeResult {
  providerOrderId: string;
  checkoutUrl: string;
}

/**
 * Provider adapter (PRD section 10). New providers plug in here without
 * touching the ingestion service.
 */
export interface PaymentConnector {
  readonly provider: Provider;
  /**
   * Authenticate and pre-parse a webhook. Must not trust body amounts or status:
   * the source of truth is always fetchTransaction.
   */
  parseWebhook(request: WebhookRequest, connection: PaymentConnection | null): WebhookParseResult;
  /** Fetch the authoritative movement from the provider API. */
  fetchTransaction(connection: PaymentConnection, externalId: string): Promise<NormalizedTransaction>;
  /** Optional: create a provider-side charge (checkout link / QR) for an expected payment. */
  createCharge?(connection: PaymentConnection, input: CreateChargeInput): Promise<CreateChargeResult>;
  healthCheck(connection: PaymentConnection): Promise<{ ok: boolean; detail?: string }>;
}
