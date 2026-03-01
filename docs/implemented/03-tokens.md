# Implemented: Token Issuance

How tokens are created, signed, stored, and verified.

---

## The Chain

```
authService.js:exchangeCodeForToken()
  └── authService.js:issueTokenPair()
        ├── jwtService.js:signAccessToken()     ← if tokenFormat === "jwt"
        │     └── keyService.js:getKeyPair()    ← RSA private key
        └── crypto.randomBytes(40)              ← refresh token (always opaque)
```

---

## Key Pair — `services/keyService.js`

```js
// Called once at startup — index.js:7
initKeys()

// Generates RSA 2048 key pair, stores in memory
keyPair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048, ... })
```

**KEY_ID:** `'sentinel-key-1'` — hardcoded. Change this string when rotating keys (both server and JWKS will reflect the new `kid`).

**Dev limitation:** Keys are regenerated on every restart. All existing JWTs become invalid after a restart because the public key changes. In production, load from env/secrets manager so the key persists.

**JWKS endpoint:**
```
GET /.well-known/jwks.json    index.js:19
  └── keyService.js:getPublicJwk()   ← exports { kty, use, kid, alg, n, e }
```

---

## JWT Access Token — `services/jwtService.js`

```js
// signAccessToken({ userId, email, clientId, scope })
jwt.sign(
  { sub, email, aud, scope, iat, exp: now + 900 },
  privateKey,
  { algorithm: 'RS256', issuer: ISSUER_URL, keyid: KEY_ID }
)
```

Payload fields:
| Claim | Value | Purpose |
|---|---|---|
| `sub` | `String(userId)` | Stable user identifier |
| `email` | user's email | For display / userinfo |
| `aud` | `clientId` | Which app this token is for |
| `scope` | e.g. `"openid"` | What permissions were granted |
| `iat` | Unix timestamp | Issued at |
| `exp` | `iat + 900` | Expires in 15 minutes |
| `iss` | `ISSUER_URL` | Who issued it |

**Verification** (introspect or resource server):
```js
// jwtService.js:verifyAccessToken()
jwt.verify(token, publicKey, { algorithms: ['RS256'], issuer: ISSUER_URL })
```

---

## Refresh Token — `services/authService.js:issueTokenPair()`

```js
const refreshTokenRaw = crypto.randomBytes(40).toString('hex')  // 80-char hex
await prisma.refreshToken.create({
  data: {
    tokenHash: hashToken(refreshTokenRaw),   // SHA-256, stored
    userId, clientId, scope,
    expiresAt: now + 30 days,
    used: false,
  }
})
```

The raw token is returned to the client. The hash is what's in the DB. When the client sends it back, you hash it again and look up the hash.

---

## Token Response Shape

```json
{
  "access_token":  "eyJhbGci...",
  "token_type":    "Bearer",
  "expires_in":    900,
  "refresh_token": "3f8a2b1c...",
  "refresh_token_expires_in": 2592000,
  "scope":         "openid"
}
```

Source: `controllers/oauthController.js:104-112`

---

## Opaque Token Path (commented out)

`services/authService.js:issueTokenPair()` — the `else` branch.

The old opaque logic is there, commented, as reference. It used `crypto.randomBytes(32).toString('hex')` with a 24-hour expiry. Introspect did a DB lookup. All of that is in comments in `authService.js` and the introspect function.

To re-enable opaque tokens: uncomment the `else` block in `issueTokenPair()` and the DB-lookup block in `introspectToken()`.

---

## Introspection — `services/authService.js:introspectToken()`

```
Token received at POST /oauth/introspect
  ├── starts with "eyJ"?
  │     YES → jwtService.verifyAccessToken()   ← local, no DB
  │              returns { active, sub, scope, client_id, username, exp, iat }
  │
  └── NO  → opaque path (commented out)
             currently returns { active: false }
```

Source: `services/authService.js:140-170`
