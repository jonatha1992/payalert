# Ualá Bis — API Cobros Online v2

Status: **order webhook + order read + order creation implemented.** Transfers: **not covered by the API.**
Source: developers.ualabis.com.ar/v2 (verified 2026-09-26). **API v1 is deprecated on 2026-12-31**; the old
`/api/webhooks/uala` handler parsed a v1-looking body and is replaced.

## Coverage
Only orders created through the API (payment link, card: credit, debit, prepaid). Transfers into the Ualá account
are not exposed. Use case in PayAlert: the cashier creates an expected payment, PayAlert creates a Ualá order and
shows its `checkout_link` (as link / QR drawn by the app); the webhook confirms it.

## Credentials
From the welcome email or the Ualá app → "Tu negocio": `username`, `client_id`, `client_secret_id`.
Stored encrypted per business. PayAlert never asks for the Ualá app password (the old form stored it in plaintext).

## Environments
| | Auth base | API base |
|---|---|---|
| Production | `https://auth.developers.ar.ua.la/v2/api` | `https://checkout.developers.ar.ua.la/v2/api` |
| Stage | `https://auth.stage.developers.ar.ua.la/v2/api` | `https://checkout.stage.developers.ar.ua.la/v2/api` |

## Token
`POST {auth}/auth/token` body `{username, client_id, client_secret_id, grant_type: "client_credentials"}` →
`{access_token, expires_in: 86400, token_type: "Bearer"}`.

## Create order
`POST {api}/checkout` (Bearer) body
`{amount, description, callback_fail, callback_success, notification_url, external_reference}` →
`{uuid, amount, status: "PENDING", external_reference, links: {checkout_link, success, failed}}`.

**Open question — amount unit.** The field table says "cents as integer string, min 2500 = $25,00"; the curl
example sends `"10.90"`. PayAlert sends pesos with two decimals by default and switches to cents when the
connection has `amount_in_cents = "true"`. Confirm with one real stage order before production.

## Read order
`GET {api}/orders/{uuid}` (Bearer) → `{uuid, amount, status, external_reference, commissions, taxes, changelog, created_date, updated_date}`.
`GET {api}/orders?limit&fromDate&toDate&status&last_search_key` lists orders (usable for polling/reconciliation).

Statuses: `PENDING`, `PROCESSED` (paid, pending disbursement), `APPROVED` (disbursed), `REJECTED`, `REFUNDED`.
Mapping: `APPROVED|PROCESSED → CONFIRMED`, `PENDING → PENDING`, `REJECTED → REJECTED`, `REFUNDED → REVERSED`.

## Webhook
`POST notification_url` body `{uuid, external_reference, status, created_date, api_version: "2"}`.
Answer 200; otherwise up to 3 retries (4 attempts total).

**The webhook is not signed.** PayAlert therefore:
1. only accepts uuids of orders it created (`expected_payments.provider_order_id`), which also identifies the tenant;
2. ignores the body status and re-reads the order with `GET /orders/{uuid}` using that business's credentials.

## Rate limits
Not published.
