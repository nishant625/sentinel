# Implemented: Client Registry

How clients (applications) are registered, stored, and enforced.

---

## Files Involved

```
prisma/schema.prisma          model Client
services/clientService.js     register, get, validate, list, delete
controllers/adminController.js  HTTP handlers for admin API
routes/admin.js               routes + admin auth middleware
controllers/oauthController.js  authorize() validates client on every request
```

---

## Registering a Client

```
POST /admin/clients
Header: x-admin-secret: <ADMIN_SECRET from .env>
Body: { name, isPublic, redirectUris[], scopes }
```

Flow:
```
routes/admin.js:adminAuth middleware     ← checks x-admin-secret header
controllers/adminController.js:createClient()
  └── services/clientService.js:registerClient()
        ├── clientId = "clt_" + crypto.randomBytes(12).toString('hex')
        ├── clientSecret = "cs_" + crypto.randomBytes(24).toString('hex')  (confidential only)
        │     stored as bcrypt hash, raw returned ONCE in response
        └── prisma.client.create(...)
```

Source: `services/clientService.js:8-32`

**clientId format:** `clt_` + 24 hex chars. E.g. `clt_a7f3b2c9d4e5f6g7h8i9j0`

---

## Admin Auth — `routes/admin.js:adminAuth`

```js
const adminAuth = (req, res, next) => {
  const secret = req.headers['x-admin-secret'];
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};
```

`ADMIN_SECRET` lives in `.env`. All `/admin/*` routes go through this middleware.

---

## Client Validation on Every Authorize Request

```
controllers/oauthController.js:27-34

const client = await clientService.getClient(client_id);
if (!client) return 400 'Unknown client_id'

if (!clientService.validateRedirectUri(client, redirect_uri))
  return 400 'redirect_uri not registered for this client'
```

`validateRedirectUri` is a simple array includes check:
```js
// services/clientService.js:43
return client.redirectUris.includes(redirectUri);
```

Exact match only. No wildcards, no trailing slash tolerance.

---

## Admin Endpoints

| Method | Path | What it does |
|---|---|---|
| `POST` | `/admin/clients` | Register a new client, returns clientId (+ clientSecret once if confidential) |
| `GET` | `/admin/clients` | List all clients (no secrets returned) |
| `DELETE` | `/admin/clients/:clientId` | Delete a client |

All require `x-admin-secret` header.

---

## Dev Seed Client

`prisma/seed.js` creates a client with a fixed `clientId` for local testing:

```
clientId:     clt_dev_testclient
name:         Dev Test Client
isPublic:     true
tokenFormat:  jwt  (default)
redirectUris: http://localhost:3000/callback
              http://localhost:5173/callback
              http://localhost:8080/callback
```

Run: `npm run db:seed`

---

## What's Missing / Not Yet Implemented

- No `allowed_scopes` enforcement — scope is stored per client but not checked against the requested scope during authorize
- No `onDelete: Cascade` on FK relations — deleting a Client with existing AuthCodes/Tokens will fail
- No client secret validation during token exchange — confidential clients can exchange codes without proving their secret (Phase 1 gap, intentional for now)
