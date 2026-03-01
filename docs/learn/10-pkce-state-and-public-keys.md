# 10 — PKCE + State: Is This Standard? And the Public Key Question

Two things answered here.

---

## Part 1: Does Everyone Use PKCE + State?

Yes. This is now the standard across the entire industry.

### Auth0

Auth0 requires PKCE for all SPAs and mobile apps. Their documentation says:

> "For most cases, we recommend using the Authorization Code Flow with PKCE. For server-side apps that can keep a secret, client credentials or Authorization Code with client secret is also acceptable."

When you create a new application in Auth0 and choose "Single Page Application" — PKCE is on by default. You cannot turn it off for public clients.

`state` is also required and their SDK generates it automatically.

### Okta

Same. PKCE required for all public clients. Their SDK generates both `state` and PKCE params automatically. You'd have to go out of your way to skip them.

### Google OAuth

Google's OAuth for browser/mobile apps has required PKCE since 2021. Their own getting-started examples all include it.

### Keycloak

PKCE enforced per-client. You can configure `PKCE Code Challenge Method: S256` on a client and it will then reject any authorization request that doesn't include a valid `code_challenge`.

### OAuth 2.1

OAuth 2.1 is the in-progress successor to OAuth 2.0. One of its core changes: **PKCE is mandatory for all clients**, not just public ones. Even confidential clients with a `client_secret` must use PKCE in OAuth 2.1.

This is because PKCE protects against a different threat than the client secret does — even if a secret is somehow leaked, PKCE ensures the code can only be exchanged by whoever initiated the flow.

### State

`state` has been required by the OAuth 2.0 spec since its original publication in 2012. Any client that skips `state` is not compliant and is vulnerable to CSRF. Every major library generates it automatically.

### So Yes — This Is The Standard

If you're using a modern OAuth library (Auth.js, Passport, MSAL, etc.) you don't even think about PKCE and `state`. The library handles it. You just see two extra parameters get sent and you trust they're doing their job.

The only context where you'd configure or think about this is when you're building the auth server (like Sentinel) or integrating with a legacy system that predates PKCE.

---

## Part 2: The Public Key Is Public — Isn't That a Problem?

No. And understanding why is the most important thing about asymmetric cryptography.

### The Mental Model

There are two keys. They're mathematically linked. What one encrypts, only the other can decrypt. What one signs, only the other can verify.

```
Private key → used to SIGN things
Public key  → used to VERIFY things
```

The auth server signs JWTs with the private key. Anyone with the public key can verify that the signature is real. But:

**Having the public key does not let you create a valid signature.**

You can verify all day long. You cannot forge.

### The Padlock Analogy

Imagine the auth server mass-produces open padlocks and gives them to everyone. Each padlock can only be opened by one key — the private key that stays on the auth server.

Anyone can snap a padlock shut (verify a signature). Only the key holder can open it (create a new valid signature).

So the JWKS endpoint is like distributing these padlocks freely. Every API that needs to verify JWTs grabs one. They can check whether a token's signature is genuine. They cannot make a new genuine signature.

### What an Attacker Gets From Your Public Key

Let's say someone finds your JWKS URL and downloads your public key. What can they do?

```
✓ Verify existing JWTs — they can check if tokens are genuine
✗ Forge new JWTs — impossible without the private key
✗ Decode extra information — the public key just tells them your algorithm
✗ Impersonate your auth server — they'd need the private key to sign tokens
```

They've learned: you use RS256 and here's your modulus. That's it.

### Why This Design is Actually Required

Your APIs need the public key to verify tokens. If the public key weren't publicly accessible, you'd have to distribute it manually to every service that validates tokens — which creates an ops problem and doesn't actually add security.

Making JWKS public means:
- Services self-configure by fetching it
- New services can be added without manual key distribution
- Key rotation is seamless (the endpoint just returns the new key)
- Third-party integrations work without you giving them special access

The design is intentional. The public key being public is the point.

### The Private Key — That One Actually Matters

The private key never leaves the auth server. It's not in the codebase. It's not in environment variables in plaintext. In production systems it's typically:

- Stored in a secrets manager (AWS Secrets Manager, HashiCorp Vault, GCP Secret Manager)
- Or stored in an HSM (Hardware Security Module) — a physical device that holds the key and performs signing, but never exposes the key directly even to the software running on the same machine

If the private key is leaked, an attacker can sign their own JWTs and they'll pass verification at every service. That's a full compromise. Rotating the key pair and redeploying is the response — all old tokens become invalid, which causes a forced logout across your whole system.

### Comparison With Opaque Tokens and Symmetric Keys

| | Opaque tokens | JWT with HS256 (symmetric) | JWT with RS256 (asymmetric) |
|---|---|---|---|
| Secret that matters | Token value in DB | Shared signing secret | Private key on auth server |
| Validation requires | Network call to auth server | Shared secret at each service | Public key (freely distributable) |
| If secret leaks | Tokens can be forged by DB access | Any service with the key can forge tokens | Only private key holder can forge |
| JWKS endpoint | Not applicable | Not applicable | Public, intentionally |

HS256 with a shared secret has a real problem: every service that validates tokens must know the secret. If one service is compromised, the secret leaks and tokens can be forged by anyone who got it. RS256 eliminates this — services only hold the public key, which can't forge anything.

### So in Short

- The JWKS URL being public is correct and by design
- Anyone can open it. That's fine.
- It only contains the public key
- The public key can only verify, not sign
- The private key never leaves the auth server and is never in that URL

---

Back to: [07 — JWKS](./07-jwks.md)
