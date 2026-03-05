# Sentinel

A self-hosted OAuth 2.0 authorization server. Implements the Authorization Code flow with PKCE, issues RS256 JWT access tokens, refresh token rotation, and a client registry with admin UI.

Built to understand how auth servers like Auth0 and Keycloak work under the hood.

---

## What it does

- Authorization Code flow + PKCE (S256)
- RS256 JWT access tokens — verified locally by resource servers via JWKS
- Refresh tokens with rotation and revocation
- Client registry — register apps, validate redirect URIs, public vs confidential clients
- Admin UI at `/admin.html` — register and manage clients in a browser
- JWKS endpoint + OpenID Connect discovery document

---

## Quickstart

```bash
npm install
cp .env.example .env   # fill in your values

# Start PostgreSQL (Docker)
docker run -d \
  --name sentinel-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=auth_db \
  -p 5433:5432 \
  postgres:16-alpine

npx prisma migrate dev
node prisma/seed.js

npm run dev
```

Server runs on `http://localhost:4000`.

---

## Environment

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/auth_db
PORT=4000
ADMIN_SECRET=change-me-in-production
ISSUER_URL=http://localhost:4000

# RSA key pair — leave blank in dev (ephemeral keys generated on startup)
# In production generate once with OpenSSL and paste here (newlines as \n)
# See docs/learn/12-persistent-keys.md
PRIVATE_KEY_PEM=
PUBLIC_KEY_PEM=
```

### Generating a persistent key pair

**1. Generate the keys**

```bash
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem
```

**2. Convert to single-line format**

```bash
awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' private.pem
awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' public.pem
```

**3. Paste into `.env` with double quotes**

```env
PRIVATE_KEY_PEM="-----BEGIN PRIVATE KEY-----\nMIIEv...\n-----END PRIVATE KEY-----\n"
PUBLIC_KEY_PEM="-----BEGIN PUBLIC KEY-----\nMIIBI...\n-----END PUBLIC KEY-----\n"
```

> Double quotes are required — dotenv uses them to expand `\n` into real newlines. Without them the key will fail to parse.

**4. Delete the `.pem` files**

```bash
rm private.pem public.pem
```

They're not needed once they're in `.env` and must never be committed.

---

## Admin UI

Open `http://localhost:4000/admin.html` — enter your `ADMIN_SECRET` to log in.

Register clients, set redirect URIs, choose token format (JWT or opaque), copy the client secret once for confidential clients.

---

## Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/oauth/authorize` | Start login flow — validates client, returns login form |
| `POST` | `/oauth/authz-direct` | Submit credentials, issues auth code, redirects |
| `POST` | `/oauth/token` | Exchange code or refresh token for access token |
| `POST` | `/oauth/introspect` | Validate a token |
| `POST` | `/oauth/revoke` | Revoke a refresh token (logout) |
| `GET` | `/.well-known/jwks.json` | RSA public key for JWT verification |
| `GET` | `/.well-known/openid-configuration` | Discovery document |
| `POST` | `/admin/clients` | Register a client (`x-admin-secret` header required) |
| `GET` | `/admin/clients` | List all clients |
| `DELETE` | `/admin/clients/:clientId` | Delete a client |

---

## SDKs

**[`@nishant625/auth-react`](https://www.npmjs.com/package/@nishant625/auth-react)**
React SDK — `<AuthProvider>`, `useAuth()` hook. Handles PKCE + state, token storage, and exposes `isAuthenticated`, `user`, `login()`, `logout()`, `getAccessToken()`.

```bash
npm install @nishant625/auth-react
```

**[`@nishant625/auth-node`](https://www.npmjs.com/package/@nishant625/auth-node)**
Express middleware — verifies RS256 JWTs via JWKS automatically, attaches decoded payload to `req.user`.

```bash
npm install @nishant625/auth-node
```

---

## Seed users

| Email | Password |
|---|---|
| `alice@example.com` | `password123` |
| `bob@example.com` | `password123` |
| `nishant@example.com` | `password123` |

---

## Docs

Concept guides, code reference, and build plans in [`/docs`](./docs/README.md).
