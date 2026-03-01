# Plan 01 — Client Registry

## Goal

Add a real `Client` table. Sentinel should generate client IDs, store registered clients, and reject any authorize request from an unknown client or with a mismatched redirect URI.

---

## Schema Changes

Add to `prisma/schema.prisma`:

```prisma
model Client {
  id           Int      @id @default(autoincrement())
  clientId     String   @unique        // "clt_a7f3b2c9d4e5" — generated
  clientSecret String?                 // bcrypt hash, null for public clients
  name         String                  // human label e.g. "My React App"
  isPublic     Boolean  @default(true) // true = PKCE only, no secret
  redirectUris String[]                // ["https://yourapp.com/callback"]
  scopes       String   @default("openid")
  createdAt    DateTime @default(now())

  authCodes AuthCode[]
  tokens    Token[]
  refreshTokens RefreshToken[]         // when refresh tokens are added
}
```

Update existing models — `clientId` becomes a proper foreign key:

```prisma
model AuthCode {
  // change:
  clientId String
  // add relation:
  client Client @relation(fields: [clientId], references: [clientId])
}

model Token {
  // same change
}
```

---

## New: Admin Routes

Add `routes/admin.js` and `controllers/adminController.js`.

These routes are not OAuth endpoints — they're for the operator of Sentinel to manage clients. In production these would be protected by an admin secret or a separate auth mechanism.

### POST /admin/clients — Register a client

Request:
```json
{
  "name": "My React App",
  "isPublic": true,
  "redirectUris": ["https://yourapp.com/callback"],
  "scopes": "openid profile"
}
```

Response:
```json
{
  "clientId": "clt_a7f3b2c9d4e5f6",
  "clientSecret": null,
  "name": "My React App",
  "isPublic": true,
  "redirectUris": ["https://yourapp.com/callback"],
  "scopes": "openid profile"
}
```

For confidential clients (`isPublic: false`), generate a `client_secret`, return it **once** (like GitHub personal access tokens — show it now, never again), store its bcrypt hash.

### GET /admin/clients — List clients

Returns all registered clients (without secrets).

### DELETE /admin/clients/:clientId — Delete a client

---

## Changes to Existing Logic

### `oauthController.js` — `authorize`

Currently: no client validation.

After: before saving the pending request, validate:
1. Look up `clientId` in `Client` table — if not found, return 400
2. Check `redirect_uri` is in `client.redirectUris` (exact match) — if not, return 400
3. If `client.isPublic === false` — confidential clients don't use this flow (they use client credentials), return 400

### `oauthService.js` — `exchangeCodeForToken`

Currently: clientId is checked by string equality against the auth code.

After: same string equality check still works, but now the client is a real registered entity. Optionally: for confidential clients, validate `client_secret` here too.

---

## New Service: `clientService.js`

```js
// Generate and register a new client
const registerClient = async ({ name, isPublic, redirectUris, scopes }) => { ... }

// Look up a client by clientId
const getClient = async (clientId) => { ... }

// Validate that a redirect_uri is registered for this client
const validateRedirectUri = async (clientId, redirectUri) => { ... }

// List all clients
const listClients = async () => { ... }

// Delete a client
const deleteClient = async (clientId) => { ... }
```

---

## Client ID Format

```js
const clientId = 'clt_' + crypto.randomBytes(12).toString('hex');
// → "clt_a7f3b2c9d4e5f6g7h8i9j0"
```

Prefix makes it obvious what type of ID it is at a glance.

---

## What to Protect the Admin Routes With

For now: a static admin secret in `.env`:

```
ADMIN_SECRET=some-long-random-string
```

Middleware:
```js
const adminAuth = (req, res, next) => {
  const secret = req.headers['x-admin-secret'];
  if (secret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};
```

Not glamorous but keeps the focus on the client registry itself. A proper admin auth system is Phase 6 territory.

---

## Test Flow After This Phase

```bash
# Register a client
curl -X POST http://localhost:3000/admin/clients \
  -H "x-admin-secret: your-secret" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test App","isPublic":true,"redirectUris":["http://localhost:8080/callback"],"scopes":"openid"}'

# Try to authorize with that client_id — should work
GET /oauth/authorize?client_id=clt_xxx&redirect_uri=http://localhost:8080/callback&...

# Try to authorize with unknown client_id — should get 400
GET /oauth/authorize?client_id=fake-id&...

# Try with a redirect_uri not in the registered list — should get 400
GET /oauth/authorize?client_id=clt_xxx&redirect_uri=https://evil.com/steal&...
```

---

## Files to Create / Modify

| File | Action |
|---|---|
| `prisma/schema.prisma` | Add `Client` model, update foreign keys |
| `prisma/migrations/...` | Run `prisma migrate dev` |
| `services/clientService.js` | Create |
| `controllers/adminController.js` | Create |
| `routes/admin.js` | Create |
| `index.js` | Mount `/admin` routes |
| `controllers/oauthController.js` | Add client validation in `authorize` |
| `services/authService.js` | Optionally validate client in `exchangeCodeForToken` |
| `prisma/seed.js` | Seed a test client instead of hardcoding client_id |
