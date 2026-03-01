# Implemented: Full OAuth Flow

End-to-end trace of what happens when a user logs in. Every hop, every file.

---

## Step 1 — Client redirects user to Sentinel

**Entry point:** `GET /oauth/authorize`

```
routes/oauth.js:5        router.get('/authorize', oauthController.authorize)
controllers/oauthController.js:5   const authorize = async (req, res)
```

What happens:
1. Validates required params (`client_id`, `redirect_uri`, `response_type`, `state`, `code_challenge`)
2. **Validates client exists** → `services/clientService.js:getClient()`
3. **Validates redirect_uri is registered** → `services/clientService.js:validateRedirectUri()`
4. Saves pending request in memory → `services/oauthService.js:savePendingRequest()`
5. Returns HTML login form

Pending requests live in `services/oauthService.js` — a plain JS object in memory (`pendingRequests`). Lost on restart. Keyed by a `crypto.randomUUID()`.

---

## Step 2 — User submits credentials

**Entry point:** `POST /oauth/authz-direct`

```
routes/oauth.js:6        router.post('/authz-direct', oauthController.authzDirect)
controllers/oauthController.js:62  const authzDirect = async (req, res)
```

What happens:
1. Looks up the pending request by `requestId` (hidden form field)
2. **Verifies email + password** → `services/authService.js:verifyUser()`
   - `prisma.user.findUnique({ where: { email } })` → bcrypt.compare
3. **Creates auth code** → `services/authService.js:createAuthCode()`
   - `crypto.randomBytes(32).toString('hex')` — 64-char hex string
   - Stored in `AuthCode` table with `expiresAt = now + 5 min`, `used = false`
   - `codeChallenge` stored here — checked later in step 3
4. Deletes the pending request
5. Redirects to `redirect_uri?code=xxx&state=xxx`

**Schema:** `prisma/schema.prisma` — `model AuthCode`

---

## Step 3 — Client exchanges code for tokens

**Entry point:** `POST /oauth/token` with `grant_type=authorization_code`

```
routes/oauth.js:7        router.post('/token', oauthController.token)
controllers/oauthController.js:93  if (grant_type === 'authorization_code')
```

What happens:
1. Calls `services/authService.js:exchangeCodeForToken()`
2. Looks up `AuthCode` by code, includes `user`
3. Validates: not used, not expired, `clientId` matches, `redirectUri` matches
4. **PKCE check:** `SHA256(codeVerifier)` must equal stored `codeChallenge`
   ```js
   // authService.js:99
   const hash = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
   if (hash !== authCode.codeChallenge) throw new Error('PKCE verification failed');
   ```
5. Marks auth code `used = true`
6. Gets client to check `tokenFormat` → `services/clientService.js:getClient()`
7. Calls `issueTokenPair()` → issues JWT access token + opaque refresh token
8. Returns `{ access_token, refresh_token, expires_in: 900 }`

---

## Step 4 — Client uses the access token

Access token is a JWT. Resource server validates it **locally** — no call to Sentinel.

```
GET /.well-known/jwks.json    → index.js:19
```

JWT contains: `sub`, `email`, `aud` (clientId), `scope`, `iat`, `exp`, `iss`

Introspect endpoint (if needed):
```
POST /oauth/introspect
routes/oauth.js:8
controllers/oauthController.js:138
services/authService.js:introspectToken()   ← detects eyJ prefix → verifies locally
```

---

## Step 5 — Access token expires, client uses refresh token

**Entry point:** `POST /oauth/token` with `grant_type=refresh_token`

```
controllers/oauthController.js:115  if (grant_type === 'refresh_token')
services/authService.js:refreshAccessToken()
```

What happens:
1. SHA-256 hashes the incoming refresh token
2. Looks up `RefreshToken` by hash
3. Validates: not used, not expired, `clientId` matches
4. **Marks old token `used = true`** (rotation — can't reuse)
5. Calls `issueTokenPair()` again → new access token + new refresh token
6. Returns new pair

**Schema:** `prisma/schema.prisma` — `model RefreshToken`

---

## Step 6 — Logout

**Entry point:** `POST /oauth/revoke`

```
routes/oauth.js:9
controllers/oauthController.js:152
services/authService.js:revokeRefreshToken()
```

Deletes the `RefreshToken` row. Always returns 200 (RFC 7009).
