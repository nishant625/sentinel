# 06 — OIDC: Identity on Top of OAuth

OAuth 2.0 is an authorization protocol. It answers: **"Can this app do X on behalf of this user?"**

It does not answer: **"Who is the user?"**

This sounds strange. If the user just logged in, why don't we know who they are? OAuth was designed for delegation — letting Spotify access your Google contacts — not for proving identity. The access token just says "permission granted." It doesn't say who the person is.

OIDC (OpenID Connect) adds the identity layer.

---

## What OIDC Is

OIDC is not a separate protocol. It's a thin layer on top of OAuth 2.0.

Same flows. Same endpoints. OIDC just adds:
1. A standard way to express user identity (the `id_token`)
2. Standard claim names for user attributes
3. A `/userinfo` endpoint
4. A discovery endpoint so clients can auto-configure

That's it.

---

## The `id_token`

When the scope includes `openid`, the auth server issues an `id_token` alongside the `access_token`.

```json
{
  "access_token": "8f3a2b1c...",
  "id_token": "eyJhbGci...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

The `id_token` is always a JWT. Your **frontend** decodes it to get the user's identity — no network call needed.

```json
{
  "iss": "https://auth.yourservice.com",
  "sub": "user-123",
  "aud": "my-react-app",
  "iat": 1708531200,
  "exp": 1708534800,
  "email": "alice@example.com",
  "name": "Alice"
}
```

Your frontend reads this. Now it knows who logged in. No API call. Just decode.

*Sentinel accepts `scope=openid` but doesn't issue an `id_token` yet. It's one of the main things missing to be OIDC-compliant.*

---

## Standard Claims

OIDC defines standard names for user attributes so every auth server speaks the same language:

| Claim | Meaning |
|---|---|
| `sub` | Subject — the user's unique, stable ID. Use this to identify the user, not email. |
| `iss` | Issuer — which auth server created this token |
| `aud` | Audience — which client this token is meant for |
| `iat` | Issued at (Unix timestamp) |
| `exp` | Expires at (Unix timestamp) |
| `email` | User's email address |
| `email_verified` | Whether the email was verified |
| `name` | Full name |
| `given_name` | First name |
| `family_name` | Last name |
| `picture` | Profile picture URL |

Why use `sub` instead of email as the user identifier? Because emails change. `sub` is assigned by the auth server and never changes for that user.

---

## The `/userinfo` Endpoint

If the access token is a JWT, the frontend already has user info. But if it's opaque, or if you need fresher/more detailed data, you call `/userinfo`:

```http
GET /userinfo
Authorization: Bearer <access_token>
```

Response:
```json
{
  "sub": "user-123",
  "email": "alice@example.com",
  "name": "Alice",
  "email_verified": true
}
```

What claims you get back depends on what scopes were granted:
- `openid` → `sub` only
- `openid profile` → `sub`, `name`, `given_name`, `picture`
- `openid email` → `sub`, `email`, `email_verified`

*Sentinel doesn't have `/userinfo`. The introspection endpoint partially fills this gap, but it's not the same thing and it's not OIDC-standard.*

---

## Discovery: `/.well-known/openid-configuration`

This is a massive developer experience win.

Instead of telling developers "the authorize endpoint is here, the token endpoint is there, the JWKS is over here" — you publish one document:

```
GET /.well-known/openid-configuration
```

Response:
```json
{
  "issuer": "https://auth.yourservice.com",
  "authorization_endpoint": "https://auth.yourservice.com/oauth/authorize",
  "token_endpoint": "https://auth.yourservice.com/oauth/token",
  "userinfo_endpoint": "https://auth.yourservice.com/userinfo",
  "jwks_uri": "https://auth.yourservice.com/.well-known/jwks.json",
  "introspection_endpoint": "https://auth.yourservice.com/oauth/introspect",
  "scopes_supported": ["openid", "profile", "email"],
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "token_endpoint_auth_methods_supported": ["none", "client_secret_basic"]
}
```

Every major OAuth/OIDC library accepts just an `issuer` URL. It fetches this document automatically and configures all the endpoints. One line of config instead of five.

*Sentinel doesn't have this yet. It's not required for basic operation but it's what separates "OAuth server" from "proper OIDC provider."*

---

## JWKS: `/.well-known/jwks.json`

If your auth server issues JWT access tokens or `id_tokens`, it signs them with a private key (RS256 = RSA with SHA-256).

To validate those tokens, your APIs and frontends need the corresponding public key. Instead of distributing it manually, you publish it at a standard location:

```
GET /.well-known/jwks.json
```

Response:
```json
{
  "keys": [{
    "kty": "RSA",
    "use": "sig",
    "kid": "key-1",
    "n": "...base64 encoded modulus...",
    "e": "AQAB"
  }]
}
```

Libraries fetch this once, cache it, and use it to verify every JWT locally.

---

## OAuth vs OIDC: One Line Each

**OAuth**: "This app has permission to do X on behalf of a user." → `access_token`

**OIDC**: "Here is who the user is." → `id_token` + standard claims + userinfo

For any login system, you need both. OAuth runs the flow and handles permissions. OIDC gives you the user's identity.

---

## Where Sentinel Stands on OIDC

| Feature | Sentinel | OIDC Spec |
|---|---|---|
| `openid` scope | Accepted | Required |
| `id_token` | Not issued | Required |
| Standard claim names | N/A | Required |
| `/userinfo` | Not present | Required |
| Discovery endpoint | Not present | Recommended |
| JWKS endpoint | Not present | Required if using JWTs |

---

## What Makes a Complete Keycloak-Like Server

If you wanted Sentinel to be a proper drop-in self-hosted auth server, the remaining pieces are:

1. **JWT access tokens** — sign with RS256, expose JWKS
2. **`id_token`** — issue alongside access token when `scope=openid`
3. **Discovery endpoint** — so SDKs can auto-configure
4. **`/userinfo` endpoint**
5. **Refresh tokens** — so users stay logged in
6. **User registration + password reset** — full user lifecycle

That's it. The OAuth core is already done. Everything above is additive.

---

Back to: [01 — OAuth Basics](./01-oauth-basics.md)
