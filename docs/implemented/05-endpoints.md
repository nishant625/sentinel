# Implemented: All Endpoints

Every route Sentinel exposes, what it does, and where it lives in code.

---

## OAuth Endpoints — `routes/oauth.js`

### `GET /oauth/authorize`
**Controller:** `oauthController.js:authorize`

Starts the login flow. Validates params, validates client + redirect_uri against DB, saves pending request in memory, returns HTML login form.

Required query params:
- `client_id` — must exist in Client table
- `redirect_uri` — must be in Client.redirectUris (exact match)
- `response_type` — must be `code`
- `state` — random string for CSRF protection
- `code_challenge` — BASE64URL(SHA256(code_verifier))
- `code_challenge_method` — must be `S256`

---

### `POST /oauth/authz-direct`
**Controller:** `oauthController.js:authzDirect`

Receives the login form submission. Verifies credentials against DB, creates an AuthCode, redirects to `redirect_uri?code=xxx&state=xxx`.

Body params: `requestId`, `email`, `password`

---

### `POST /oauth/token`
**Controller:** `oauthController.js:token`

Two grant types:

**`authorization_code`** — exchange auth code for tokens
- Body: `grant_type`, `code`, `redirect_uri`, `client_id`, `code_verifier`
- PKCE verified here
- Returns: `{ access_token, token_type, expires_in: 900, refresh_token, refresh_token_expires_in: 2592000 }`

**`refresh_token`** — get a new access token using a refresh token
- Body: `grant_type`, `refresh_token`, `client_id`
- Rotates refresh token (old one invalidated)
- Returns same shape as above

---

### `POST /oauth/introspect`
**Controller:** `oauthController.js:introspect`
**Service:** `authService.js:introspectToken`

Validates a token. JWT tokens verified locally via JWKS (no DB). Opaque path currently returns `{ active: false }` (commented out).

Body: `token`

Response (active): `{ active, sub, scope, client_id, username, exp, iat }`
Response (inactive): `{ active: false }`

---

### `POST /oauth/revoke`
**Controller:** `oauthController.js:revoke`
**Service:** `authService.js:revokeRefreshToken`

Deletes the RefreshToken row. Always returns `200 {}` even if token doesn't exist (RFC 7009).

Body: `token` (refresh token), `client_id`

---

## Admin Endpoints — `routes/admin.js`

All require header: `x-admin-secret: <value from .env ADMIN_SECRET>`

### `POST /admin/clients`
**Controller:** `adminController.js:createClient`

Registers a new client. Generates `clientId` and optionally `clientSecret`.

Body: `{ name, isPublic, redirectUris[], scopes }`

Response: `{ clientId, clientSecret (once, null if public), name, isPublic, redirectUris, scopes }`

---

### `GET /admin/clients`
**Controller:** `adminController.js:listClients`

Lists all registered clients. Never returns `clientSecret`.

---

### `DELETE /admin/clients/:clientId`
**Controller:** `adminController.js:deleteClient`

Removes a client. Will fail if the client has associated AuthCodes or Tokens (no cascade set).

---

## Well-Known Endpoints — `index.js`

### `GET /.well-known/jwks.json`
Returns the RSA public key in JWK format. Used by resource servers to verify JWTs locally.

Source: `index.js:19` → `keyService.js:getPublicJwk()`

Response:
```json
{
  "keys": [{
    "kty": "RSA", "use": "sig", "kid": "sentinel-key-1",
    "alg": "RS256", "n": "...", "e": "AQAB"
  }]
}
```

---

### `GET /.well-known/openid-configuration`
Discovery document. SDKs use this to auto-configure all endpoints.

Source: `index.js:23`

---

## Health

### `GET /health`
Returns `{ status: 'ok', timestamp }`. No auth required.
