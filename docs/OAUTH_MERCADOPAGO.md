# Mercado Pago OAuth (PAY-15)

OAuth marketplace remains disabled unless `MP_OAUTH_ENABLED=true`. Configure `MP_CLIENT_ID`, `MP_CLIENT_SECRET`, `MP_OAUTH_REDIRECT_URI` (exact static callback URL `.../api/integrations/mercadopago`), and `MP_OAUTH_STATE_SECRET` (at least 32 characters). The redirect URI must first be registered in the Mercado Pago application. Missing/invalid config safely disables OAuth (503); manual Access Token setup remains available.

The start route is `GET /api/integrations/mercadopago`; callback is `PUT` on the same route. Only the authenticated business owner can use the OAuth flow. `state` is HMAC-signed, bound to user+tenant, expires after 10 minutes, and persisted as a hash for atomic one-time consumption. Tokens are stored encrypted and never included in logs or responses.

Requested scopes are `offline_access read`: offline access is needed to renew credentials; read is the minimal read scope documented for the integration's payment observation. Confirm the exact scope grant with Mercado Pago during app setup. The authorization URL uses `https://auth.mercadopago.com/authorization`; token exchange/refresh use `POST https://api.mercadopago.com/oauth/token`.

## Encryption key rotation

New secrets use `enc:v2:<key-id>:<iv-base64>:<tag-base64>:<ciphertext-base64>`. Set `PAYMENTS_ENCRYPTION_KEY` to the active 32-byte base64 key, `PAYMENTS_ENCRYPTION_KEY_ID` to its non-secret id, and `PAYMENTS_ENCRYPTION_KEYS` to a JSON map containing old key ids and base64 key values during rotation. Keep old keys until all records are re-encrypted. `enc:v1` remains readable using the legacy key override (or key id `legacy` in the map).

The `scripts/reencrypt-secrets.mjs --dry-run` command only reports counts; without `--dry-run` it performs writes. It is intentionally not run against real databases as part of this change. Validate against an isolated local database before any operational use.

## Provider validation and revocation caveat

Disconnect is local only: PayAlert clears its encrypted credentials, marks the connection `DISCONNECTED`, and records an audit event. It does not call a provider revocation endpoint. Mercado Pago's official documentation describes seller-initiated authorization revocation and token refresh, but does not document a general API revocation endpoint. Programmatic revocation remains **a validar con Mercado Pago**.

Official references:
- [Obtener Access Token](https://www.mercadopago.com.ar/developers/es/docs/security/oauth/creation) — URL, redirect URI, state, authorization-code flow, recommended PKCE. PKCE is not implemented here; validate whether it is required for the production app.
- [Renovar Access Token](https://www.mercadopago.com.ar/developers/es/docs/security/oauth/renewal) — refresh-token flow and token lifecycle.
- [Crear y refrescar token API](https://www.mercadopago.com.ar/developers/es/reference/authentication/oauth/_oauth_token/post) — endpoint and accepted grants/scopes.
- [Manage Access Token](https://www.mercadopago.com.ar/developers/en/docs/checkout-api-payments/additional-content/security/oauth/management) — documented seller authorization revocation behavior; no API endpoint specified.

Do not deploy until the owner registers the callback URI, validates app credentials/scopes and PKCE requirements with Mercado Pago, and confirms production behavior. No live provider calls or credentials were used in implementation tests.
