# Plan 02 — JWT Access Tokens

## Goal

Issue signed JWT access tokens (RS256) instead of opaque hex strings. Expose a JWKS endpoint. Resource servers can then validate tokens locally without calling Sentinel.

Keep opaque tokens working — token format is a per-client setting.

---

## Prerequisites

Phase 01 (Client Registry) must be done. The `Client` model needs to exist so `tokenFormat` can be stored per client.

---

## Schema Change

Add `tokenFormat` to `Client`:

```prisma
model Client {
  // existing fields...
  tokenFormat String @default("opaque")  // "opaque" | "jwt"
}
```

No change to the `Token` model — whether the token string is opaque hex or a JWT string, it's still stored the same way. The `token` column just holds whichever format was issued.

---

## Key Pair Management

On startup, Sentinel needs an RSA key pair. Two approaches:

### Option A — Generate on startup, store in DB or file

```js
// services/keyService.js
const crypto = require('crypto');

let keyPair = null;
const KEY_ID = 'sentinel-key-1'; // change this when rotating

const getKeyPair = () => {
  if (!keyPair) {
    throw new Error('Key pair not initialized');
  }
  return keyPair;
};

const initKeys = async () => {
  // In production: load from env/file/secrets manager
  // For now: generate on startup (lost on restart — fine for dev)
  keyPair = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
};

module.exports = { getKeyPair, initKeys, KEY_ID };
```

Call `initKeys()` before `app.listen()` in `index.js`.

### Production approach (note for later)

Store the PEM private key in an environment variable or secrets manager. Load it on startup. Never generate on the fly in production — key must persist across restarts or all existing JWTs become invalid.

```
PRIVATE_KEY_PEM="-----BEGIN PRIVATE KEY-----\n..."
```

---

## Signing a JWT

No JWT library needed — Node's built-in `crypto` can do RS256. But using `jsonwebtoken` (npm) is much simpler and widely used.

```js
// npm install jsonwebtoken
const jwt = require('jsonwebtoken');
const { getKeyPair, KEY_ID } = require('./keyService');

const issueJwt = (payload) => {
  const { privateKey } = getKeyPair();

  return jwt.sign(payload, privateKey, {
    algorithm: 'RS256',
    keyid: KEY_ID,
    // expiresIn is in the payload (exp claim), not here
  });
};
```

Payload for an access token:
```js
{
  iss: process.env.ISSUER_URL,  // "https://auth.yourservice.com"
  sub: String(userId),          // always a string per OIDC spec
  aud: clientId,
  email: user.email,
  scope: scope,
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 900,  // 15 min
}
```

---

## Changes to `authService.js` — `exchangeCodeForToken`

Currently: always generates `crypto.randomBytes(32).toString('hex')`.

After:
```js
const { getClient } = require('./clientService');

const exchangeCodeForToken = async ({ code, clientId, redirectUri, codeVerifier }) => {
  // ... existing validation ...

  const client = await getClient(clientId);

  let tokenValue;
  if (client.tokenFormat === 'jwt') {
    tokenValue = issueJwt({
      iss: process.env.ISSUER_URL,
      sub: String(authCode.userId),
      aud: clientId,
      email: authCode.user.email,  // need to include user in the query
      scope: authCode.scope,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 900,
    });
  } else {
    tokenValue = crypto.randomBytes(32).toString('hex');
  }

  await prisma.token.create({
    data: {
      token: tokenValue,
      userId: authCode.userId,
      clientId,
      scope: authCode.scope,
      expiresAt: new Date(Date.now() + (client.tokenFormat === 'jwt' ? 15 : 24 * 60) * 60 * 1000),
    },
  });

  return tokenValue;
};
```

Note: for JWT clients, you still write the token to DB. This lets `/introspect` work if called, and lets you build a revocation list later. You don't have to, but it keeps the system consistent. The token is just stored as its full JWT string.

---

## New Endpoint: `GET /.well-known/jwks.json`

```js
// in routes or index.js
const { getKeyPair, KEY_ID } = require('./services/keyService');

app.get('/.well-known/jwks.json', (req, res) => {
  const { publicKey } = getKeyPair();

  // Convert PEM public key to JWK format
  const keyObject = crypto.createPublicKey(publicKey);
  const jwk = keyObject.export({ format: 'jwk' });

  res.json({
    keys: [{
      kty: jwk.kty,
      use: 'sig',
      kid: KEY_ID,
      alg: 'RS256',
      n: jwk.n,
      e: jwk.e,
    }],
  });
});
```

Node 18+ can export keys directly to JWK format via `key.export({ format: 'jwk' })`. No extra library needed.

---

## Changes to `/introspect`

Currently: looks up opaque token in DB.

After: detect whether the token is a JWT (starts with `eyJ`) or opaque, handle accordingly:

```js
const introspectToken = async (token) => {
  // JWT tokens: verify signature locally, no DB needed
  if (token.startsWith('eyJ')) {
    try {
      const { publicKey } = getKeyPair();
      const decoded = jwt.verify(token, publicKey, { algorithms: ['RS256'] });
      return {
        active: true,
        sub: decoded.sub,
        scope: decoded.scope,
        client_id: decoded.aud,
        username: decoded.email,
        exp: decoded.exp,
        iat: decoded.iat,
      };
    } catch {
      return { active: false };
    }
  }

  // Opaque tokens: DB lookup (existing logic)
  // ...
};
```

---

## New Endpoint: `GET /.well-known/openid-configuration`

Now that JWKS exists, add the discovery document. Static values:

```js
app.get('/.well-known/openid-configuration', (req, res) => {
  const base = process.env.ISSUER_URL;
  res.json({
    issuer: base,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/oauth/token`,
    introspection_endpoint: `${base}/oauth/introspect`,
    jwks_uri: `${base}/.well-known/jwks.json`,
    scopes_supported: ['openid'],
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
  });
});
```

---

## Files to Create / Modify

| File | Action |
|---|---|
| `services/keyService.js` | Create — key pair init, getKeyPair |
| `services/jwtService.js` | Create — issueJwt |
| `services/authService.js` | Update `exchangeCodeForToken` to branch on tokenFormat; update `introspectToken` |
| `services/clientService.js` | Update `registerClient` to accept `tokenFormat` |
| `prisma/schema.prisma` | Add `tokenFormat` to `Client` |
| `index.js` | Mount `/.well-known/jwks.json` and `/.well-known/openid-configuration`; call `initKeys()` |
| `package.json` | Add `jsonwebtoken` dependency |

---

## Test Flow After This Phase

```bash
# Register a JWT client
curl -X POST /admin/clients \
  -d '{"name":"JWT App","isPublic":true,"redirectUris":["..."],"tokenFormat":"jwt"}'

# Do the full authorize → token flow
# The access_token returned will start with "eyJ..."

# Decode it at jwt.io to inspect claims

# Fetch JWKS
curl http://localhost:3000/.well-known/jwks.json

# Introspect the JWT (should work via local verification)
curl -X POST /oauth/introspect -d "token=eyJ..."

# Register an opaque client — still works as before
curl -X POST /admin/clients \
  -d '{"name":"Legacy App","isPublic":true,"redirectUris":["..."],"tokenFormat":"opaque"}'
```
