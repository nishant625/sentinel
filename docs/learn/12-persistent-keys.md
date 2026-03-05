# 12 — Persistent Keys: Why, How, and the Public Key Question

## The Dev Problem

Right now Sentinel generates a fresh RSA key pair every time it starts. This means:

- Every restart invalidates all existing JWTs
- Users get logged out whenever you restart the server
- Fine for development — annoying in any shared environment

The fix is simple: generate the key pair once, store it, load it on startup.

---

## Why the Public Key Is Exposed (And That's Fine)

The JWKS endpoint at `/.well-known/jwks.json` is publicly accessible. Anyone can open it.

This is intentional. Here's why it's not a security problem:

**Asymmetric cryptography gives you two mathematically linked keys:**

```
Private key → used to SIGN tokens       (only Sentinel has this)
Public key  → used to VERIFY signatures (anyone can have this)
```

Having the public key lets you check if a token is genuine. It does not let you create a new genuine token. Creating a token requires the private key, which never leaves Sentinel.

Think of it like a wax seal. Anyone can check whether a seal on a letter is real. Only the person with the signet ring can make a new seal.

So your APIs fetch the public key from JWKS, cache it, and use it to verify every JWT locally — no network call to Sentinel on each request. This is the whole reason JWTs scale.

**What an attacker gets from your public key:**
- ✓ They can verify tokens are genuine
- ✗ They cannot forge new tokens
- ✗ They cannot read encrypted data (JWKS is for signing, not encryption)
- ✗ They learn nothing about your users

---

## Generating a Key Pair

### Using OpenSSL (recommended for production)

```bash
# Generate private key (2048-bit RSA)
openssl genrsa -out private.pem 2048

# Extract public key from private key
openssl rsa -in private.pem -pubout -out public.pem
```

You now have two files:
- `private.pem` — keep this secret, never commit it
- `public.pem` — this is what goes in JWKS, safe to share

### Using Node.js (alternative)

```js
const crypto = require('crypto');
const fs = require('fs');

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding:  { type: 'spki',  format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

fs.writeFileSync('private.pem', privateKey);
fs.writeFileSync('public.pem', publicKey);
```

---

## Loading Into Sentinel

Sentinel reads `PRIVATE_KEY_PEM` and `PUBLIC_KEY_PEM` from environment variables. PEM files use real newlines — environment variables can't, so you encode newlines as `\n`.

### Convert PEM file to single-line env format

```bash
# Converts newlines to \n so it fits on one line in .env
awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' private.pem
awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' public.pem
```

Paste the output into your `.env`:

```
PRIVATE_KEY_PEM=-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkq...\n-----END PRIVATE KEY-----\n
PUBLIC_KEY_PEM=-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0B...\n-----END PUBLIC KEY-----\n
```

Sentinel's `keyService.js` converts `\n` back to real newlines on load:
```js
process.env.PRIVATE_KEY_PEM.replace(/\\n/g, '\n')
```

### In production (better than .env)

Never put private keys in `.env` files that get committed or copied around. Use a secrets manager:

- **AWS Secrets Manager** — store the PEM string, fetch it at startup
- **GCP Secret Manager** — same pattern
- **HashiCorp Vault** — same
- **Railway / Render / Fly.io** — paste into environment variable UI, never touches disk

---

## What Happens on Key Rotation

If you ever rotate your key pair (generate a new one):

1. Both the old and new public keys should be in JWKS during the overlap window
2. Start signing new tokens with the new private key
3. Old tokens still verify using the old public key (still in JWKS)
4. Wait for old tokens to expire (15 min with current settings)
5. Remove the old public key from JWKS

Sentinel currently supports one key at a time (`sentinel-key-1`). Multi-key rotation is a future addition.

---

## Summary

| | Dev | Production |
|---|---|---|
| Key source | Generated on startup | Loaded from env/secrets manager |
| Persists across restarts | No | Yes |
| Users get logged out on restart | Yes | No |
| Private key location | Memory only | Secrets manager |
| Public key location | JWKS endpoint (public) | JWKS endpoint (public) |

---

Back to: [07 — JWKS](./07-jwks.md)
