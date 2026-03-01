# 07 — JWKS: How JWT Signatures Are Verified Without Sharing Secrets

When your auth server issues a JWT, it signs it with a private key. Every API that receives that JWT needs to verify the signature. But you can't share the private key with every service — that defeats the point.

The solution: **asymmetric cryptography + a public endpoint.**

The auth server keeps the private key secret. It publishes the corresponding public key at a standard URL. Anyone can fetch the public key and verify signatures. No secret ever leaves the auth server.

That public key endpoint is the **JWKS endpoint**.

---

## The Endpoint

```
GET /.well-known/jwks.json
```

Response:

```json
{
  "keys": [
    {
      "kty": "RSA",
      "use": "sig",
      "kid": "key-2024-01",
      "alg": "RS256",
      "n": "0vx7agoebGcQSuuPiLJXZptN9nndrQmbXEps2aiAFbWhM78LhWx...",
      "e": "AQAB"
    }
  ]
}
```

It's an array because auth servers can have multiple active keys at once (more on this under key rotation).

---

## Field by Field

| Field | Meaning |
|---|---|
| `kty` | Key type. `RSA` for RSA keys, `EC` for elliptic curve. |
| `use` | Intended use. `sig` = signing/verification. `enc` = encryption. |
| `kid` | Key ID. A label the auth server assigns. Used to match keys. |
| `alg` | Algorithm. `RS256` = RSA + SHA-256. `ES256` = ECDSA + SHA-256. |
| `n` | RSA modulus — part of the RSA public key. Base64url encoded. |
| `e` | RSA exponent — the other part. Usually `AQAB` (= 65537). |

For EC keys you'd see `crv`, `x`, `y` instead of `n` and `e`.

---

## The `kid` — Key ID

This is the critical link between a JWT and its verification key.

When the auth server signs a JWT, it puts the `kid` in the JWT header:

```json
{
  "alg": "RS256",
  "typ": "JWT",
  "kid": "key-2024-01"
}
```

When your API receives the JWT:

1. Decode the header (it's just Base64 — no verification needed to read it)
2. Read the `kid`
3. Find the key with that `kid` in your cached JWKS
4. Verify the signature using that key

Without `kid`, if the auth server had multiple keys, your API wouldn't know which one to use. `kid` solves that.

---

## How a Resource Server Uses JWKS

```
Startup:
  → fetch /.well-known/jwks.json
  → parse keys, cache them

Per-request:
  → receive JWT in Authorization header
  → decode JWT header (Base64, no secret needed)
  → read kid from header
  → find matching key in cache
  → verify signature using that public key
  → check exp hasn't passed
  → check iss matches expected issuer
  → check aud matches this service
  → done — user is authenticated
```

The only network call is the initial JWKS fetch. After that, everything is local math. This is why JWTs scale: a service handling 10,000 req/s verifies tokens locally — zero calls to the auth server.

---

## Key Rotation

Private keys should be rotated periodically. If a key is ever leaked or compromised, you want the blast radius limited.

The problem: if you rotate the key and invalidate all old JWTs instantly, users get logged out.

The solution: **gradual rotation**.

```
Step 1: Generate new key pair (new kid: "key-2025-01")

Step 2: Add new public key to JWKS
  "keys": [
    { "kid": "key-2024-01", ... },   ← old key still here
    { "kid": "key-2025-01", ... }    ← new key added
  ]

Step 3: Start signing new JWTs with new key

Step 4: Old JWTs (signed with key-2024-01) still verify fine
        because the old public key is still in the JWKS

Step 5: Wait for old JWTs to expire (usually 15-60 min)

Step 6: Remove old key from JWKS
```

During the overlap window, both keys are valid. Services cache the JWKS and can verify tokens from either key. Users see nothing.

---

## What If the `kid` Isn't in the Cache?

Your API has cached the JWKS. A JWT arrives with a `kid` your cache doesn't have. Two scenarios:

1. **Key rotation happened** — the auth server rotated keys while your service was running. Correct response: re-fetch JWKS, try again.
2. **Forged JWT** — someone made up a `kid`. If you re-fetch and it's still not there, reject.

Libraries handle this automatically. The pattern is:
- On unknown `kid`, re-fetch JWKS once
- If still not found after re-fetch, reject as invalid

---

## RS256 vs ES256 vs HS256

| Algorithm | Type | Who has the key |
|---|---|---|
| `RS256` | RSA asymmetric | Auth server has private key, everyone else has public key (JWKS) |
| `ES256` | ECDSA asymmetric | Same as RS256, smaller key size, faster verification |
| `HS256` | HMAC symmetric | **Same secret shared by signer and verifier** |

HS256 has no JWKS. It's a shared secret — the auth server and the verifier both know the same key. This means:
- Every service that validates tokens must know the secret
- If any service is compromised, the secret is leaked
- You can't rotate safely
- Not suitable for systems with multiple independent services

RS256 and ES256 are standard for public JWKS. ES256 is increasingly preferred — same security properties, smaller keys, faster math.

---

## What JWKS Doesn't Cover

JWKS is only about **public keys for verification**. It doesn't cover:

- Which JWTs are revoked (no revocation list here)
- Token introspection (that's `/introspect`)
- The meaning of claims (that's defined by OIDC or your own spec)
- User information (that's `/userinfo`)

If you need revocation before expiry, you need a separate blocklist check. JWKS alone doesn't solve that.

---

## What Sentinel Would Need to Expose JWKS

Currently Sentinel uses opaque tokens — no JWTs, no signing keys, no JWKS needed. To add JWT support:

1. Generate an RSA or EC key pair on startup (or load from config)
2. Sign access tokens and `id_tokens` with the private key (include `kid` in the JWT header)
3. Expose `GET /.well-known/jwks.json` returning the public key
4. Resource servers fetch the JWKS and verify locally instead of calling `/introspect`

The `/introspect` endpoint would still exist but would be used only as a fallback or for opaque clients.

---

Next: [08 — OpenID Configuration: The Discovery Document](./08-openid-config.md)
