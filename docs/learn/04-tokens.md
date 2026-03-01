# 04 — Tokens: Types and Trade-offs

After login, your app gets a token. But not all tokens are the same. There are two fundamentally different approaches, and each has real consequences for how you build your system.

---

## Opaque Tokens

An opaque token is a random string with no meaning baked in:

```
8f3a2b1c9d4e5f6a7b8c9d0e1f2a3b4c
```

It's like a cloakroom ticket. The ticket itself tells you nothing. You hand it to the attendant, they look up what it maps to, and hand back the coat.

**Validation requires a network call:**

```
Your API receives token
  → POST /introspect to auth server
  → auth server checks DB
  → returns { active: true, user: "alice", scope: "openid" }
```

Every request to your API = one extra request to the auth server.

*This is what Sentinel uses. The `/oauth/introspect` endpoint is that attendant.*

**When opaque tokens make sense:**
- You need instant revocation — delete the token from DB, it's dead immediately
- Simpler to implement
- Works fine for small scale / single region

**The downside:**
- Every API call depends on the auth server being up
- Latency on every request
- Doesn't scale well — your auth server becomes a bottleneck

---

## JWT (JSON Web Token)

A JWT is a self-contained token. It has the data baked in and a cryptographic signature to prove it's legit.

It looks like three Base64 strings separated by dots:

```
eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhbGljZSIsImV4cCI6MTcwOH0.SflKxwRJ...
```

Split it:

```
HEADER.PAYLOAD.SIGNATURE
```

Decoded:

```json
// Header
{ "alg": "RS256", "typ": "JWT" }

// Payload (the actual data)
{
  "sub": "user-123",
  "email": "alice@example.com",
  "scope": "openid profile",
  "iss": "https://auth.yourservice.com",
  "aud": "my-app",
  "iat": 1708531200,
  "exp": 1708534800
}

// Signature
// = RS256(header + "." + payload, private_key)
```

**Validation is local — no network call:**

```
Your API receives JWT
  → decode the payload (public info)
  → verify the signature using auth server's public key
  → check exp hasn't passed
  → done. No network call.
```

The private key lives on the auth server. The public key is published at a JWKS endpoint. Your API fetches the public key once, caches it, verifies every token locally.

**When JWTs make sense:**
- Scale — no auth server bottleneck
- Microservices — each service validates independently
- Works even if auth server is temporarily unreachable

**The downside:**
- Revocation is hard — a stolen JWT is valid until it expires
- Solution: short expiry (15 min) + refresh tokens
- If you need instant revocation, you need a token blocklist (which brings back the DB lookup)

---

## Refresh Tokens

Access tokens should be short-lived. 15–60 minutes is standard practice. If a token is stolen, you want it to stop working soon.

But short-lived tokens mean users get logged out constantly. That's terrible UX.

Solution: **refresh tokens**.

The auth server issues two things at login:
- Access token — short-lived (15 min), used for API calls
- Refresh token — long-lived (days/weeks), used only to get a new access token

```http
POST /oauth/token
{
  "grant_type": "refresh_token",
  "refresh_token": "long_lived_token_here",
  "client_id": "my-app"
}
```

Response:
```json
{
  "access_token": "new short-lived token",
  "expires_in": 900,
  "refresh_token": "optionally rotated"
}
```

Best practice — **refresh token rotation**: every time you use a refresh token, it's invalidated and a new one is issued. This means a stolen refresh token can only be used once before the legitimate user's next request invalidates it.

*Sentinel doesn't implement refresh tokens yet. The 24-hour access token lifetime is compensating for this.*

---

## The `id_token`

This is an OIDC concept (covered fully in file 06) but worth knowing here.

When the scope includes `openid`, the auth server issues a second token alongside the access token:

```json
{
  "access_token": "used to call APIs",
  "id_token": "JWT with user identity",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

The `id_token` is always a JWT. Your **frontend** reads it to know who logged in — without making any API call.

The `access_token` is for your API.
The `id_token` is for your frontend.

They're different things used by different parts of your system.

*Sentinel doesn't issue an `id_token` yet even though it accepts `scope=openid`.*

---

## Token Storage in the Browser (Best Practice)

Where your frontend stores the token matters a lot:

| Storage | XSS Risk | CSRF Risk | Notes |
|---|---|---|---|
| `localStorage` | High — any JS can read it | None | Avoid for sensitive tokens |
| `sessionStorage` | High — any JS can read it | None | Slightly better, gone on tab close |
| Memory (JS var) | Low — not persistent | None | Best for SPAs, lost on refresh |
| `HttpOnly` cookie | None — JS can't read it | Present | Best for refresh tokens |

Common pattern:
- Keep access token in memory (JS variable)
- Keep refresh token in an HttpOnly cookie
- On page load, use the refresh token to get a new access token silently

---

## Summary

| | Opaque | JWT |
|---|---|---|
| Readable | No | Yes (Base64 decoded) |
| Validation | Network call to auth server | Local signature check |
| Revocation | Easy — delete from DB | Hard — wait for expiry or use blocklist |
| Scale | Limited by auth server | Scales independently |
| What Sentinel uses | Yes | Not yet |

---

Next: [05 — Clients: Registration and Trust](./05-clients.md)
