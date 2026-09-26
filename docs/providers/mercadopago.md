# Mercado Pago

Status: **webhook ingestion implemented** (payments topic). Charge creation (QR / Checkout / Orders) **NOT_IMPLEMENTED**.
Sources: official docs at mercadopago.com.ar/developers (Webhooks, Checkout Pro payment notifications) and the
official SDK validator `mercadopago/sdk-nodejs` `src/utils/webhook/index.ts`. Verified 2026-09-26.

## What it covers — and what it does not

| Money in | Visible to PayAlert? |
|---|---|
| Payment through Checkout Pro / Checkout API / Orders | Yes, `payment` / `order` notifications |
| Payment through Mercado Pago QR / Point | Yes, via their notifications (QR notifications are **not signed**) |
| Plain bank transfer / CVU transfer into the account | **Not documented.** No webhook topic exists for it. Pending the manual probe below. |

The PRD's core case ("customer transfers and shows a screenshot") is only covered if the customer pays through a
Mercado Pago product. Do not promise transfer detection until the probe confirms it.

### Probe to run (KAN-76)
1. With the merchant's own production access token, have someone transfer $10 to the account's CVU.
2. `GET https://api.mercadopago.com/v1/payments/search?sort=date_created&criteria=desc&range=date_created&begin_date=NOW-1HOURS&end_date=NOW`
3. If the transfer appears (look at `operation_type`, `payment_type_id`), polling is possible. Document the
   fields here. If not, transfers stay out of scope.

## Authentication
- Per business: the owner pastes the **production Access Token** of their own application
  (Tus integraciones → Credenciales). Stored encrypted in `payment_connections.credentials_encrypted`.
- OAuth (marketplace "vincular cuenta") is the long-term path: NOT_IMPLEMENTED; needs an app with OAuth enabled
  and redirect URL registered by the platform owner.
- `GET https://api.mercadopago.com/users/me` returns the account `id`; PayAlert stores it as
  `payment_connections.provider_account_id`. Webhook `user_id` is matched against it to find the tenant.

## Webhooks
- Configure in Tus integraciones → Webhooks → URL
  `https://<host>/api/webhooks/mercadopago`, event **Pagos**. Copy the generated **secret signature** into the
  PayAlert integration form (stored encrypted).
- Request: `POST ?data.id=<id>&type=payment`, body `{id, live_mode, type, date_created, user_id, api_version, action, data:{id}}`.
- Headers: `x-signature: ts=<ts>,v1=<hex>`, `x-request-id`.
- Signature: `HMAC_SHA256(secret, "id:<data.id>;request-id:<x-request-id>;ts:<ts>;")`, missing parts omitted.
  Docs say lowercase alphanumeric `data.id`; the SDK signs it as received — both accepted.
  Implemented in `frontend/lib/payments/mercadopagoSignature.ts`. A connection without secret rejects webhooks.
- Must answer 200/201 within 22 s; otherwise retries every 15 min, then with growing interval.
- **Test credentials do not send notifications.** Use the "Simular" button in Tus integraciones → Webhooks, or real
  production payments of small amounts.

## Reading the payment
`GET https://api.mercadopago.com/v1/payments/{id}` with `Authorization: Bearer <access_token>`.

Fields used: `id, status, status_detail, transaction_amount, currency_id, date_created, date_approved,
external_reference, collector_id, payer.identification, operation_type, payment_type_id, payment_method_id, live_mode`.

Status mapping: `approved → CONFIRMED`, `pending|in_process|authorized → PENDING`,
`rejected|cancelled → REJECTED`, `refunded|charged_back → REVERSED`, else `UNKNOWN`.

The webhook body is never trusted for amount/status: the API read is the source of truth.

## Rate limits
Not published per endpoint in the pages reviewed. Treat 429 as retriable (webhook answers 500 so MP retries).

## Environment variables (legacy, now unused by the webhook)
`MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` were global; the route now uses per-connection credentials.
