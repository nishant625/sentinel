# 09 — Token Format Choice: Opaque vs JWT Per Client

When you build or configure an auth server, one of the decisions you make — often per client — is what format the access token takes. This isn't a global setting you flip once. Different clients in the same system often get different token formats for different reasons.

---

## Where This Decision Lives

In a production auth server (Keycloak, Auth0, Okta, etc.), token format is configured at client registration time — in the admin UI or via the admin API.

In Keycloak:
```
Clients → [client name] → Settings → Access Token Lifespan / Advanced Settings
```

You can toggle between signed JWT and opaque per client. You can also configure which claims go in the JWT.

In Auth0:
```
APIs → [API name] → Settings → Token Dialect
```
Options: `access_token` (opaque) or `access_token_authz` (JWT with permissions).

The auth server can issue different token types to different clients simultaneously. Alice's mobile app might get a JWT. Bob's legacy backend integration might get an opaque token. Both users are on the same auth server.

---

## What Drives the Choice

### Give a client JWTs when:

**The client's backend does high-volume API validation**

If your API handles thousands of requests per second, adding a network call to the auth server on every request is a real bottleneck. JWT validation is local math — no network round trip.

**You have multiple independent services that all need to validate tokens**

In a microservices architecture, each service validates tokens independently. With opaque tokens, every service calls `/introspect`. With JWTs, every service fetches the JWKS once and validates locally. The auth server doesn't become a dependency for every internal service call.

**The client is a third-party integration**

Third parties running their own infrastructure shouldn't need to make network calls back to your auth server on every API call. Give them JWTs so they can validate independently.

**You want to include claims in the token itself**

JWTs carry data. You can include the user's role, organization, permissions, or any custom claim directly in the token. The resource server reads it without a database lookup.

```json
{
  "sub": "user-123",
  "email": "alice@example.com",
  "roles": ["admin", "editor"],
  "org_id": "org-456",
  "exp": 1708534800
}
```

### Give a client opaque tokens when:

**You need instant revocation**

A user reports their device was stolen. You want to invalidate their session right now, not in 15 minutes when the JWT expires. With opaque tokens, delete the record from the DB — done. With JWTs, you need a blocklist (which reintroduces the network call).

**The client is simple or internal**

A simple internal script, a cron job, or a server-side-only integration that rarely makes requests doesn't need the complexity of JWT handling. Opaque + introspect is simpler to implement correctly.

**You don't want to expose user data in the token**

JWTs are Base64-encoded, not encrypted by default. Anyone who intercepts the token can read the payload. If the token contains sensitive claims (roles, organization data, email), that's a consideration. Opaque tokens reveal nothing.

**The client can't update their JWT library**

Legacy clients sometimes can't handle JWT validation. Opaque tokens have a simpler contract: send the token to `/introspect`, get a JSON response.

---

## The Common Production Pattern

Most mature systems end up here:

```
Access token  → JWT
  Short-lived (15 min)
  Contains roles/permissions
  Validated locally at each service
  No network call per request

Refresh token → Opaque
  Long-lived (days/weeks)
  Stored in DB
  Used only to get new access tokens
  Instantly revocable by deleting from DB
```

You get the performance of JWTs for the hot path (API validation) and the revocability of opaque tokens for the refresh path (which is infrequent).

This is what Auth0, Keycloak, and most production OIDC servers do by default.

---

## What "Opaque" Actually Means to the Client

From the client's perspective, an opaque token is just a string. The client has no idea what's inside it — and shouldn't try to parse it.

```js
// Opaque — just a string, don't parse it
const token = "8f3a2b1c9d4e5f6a7b8c9d0e1f2a3b4c";

// JWT — three Base64 parts, client CAN decode the payload
const jwt = "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEyMyJ9.SflKxwRJ...";
const payload = JSON.parse(atob(jwt.split('.')[1]));
```

With an opaque token, to know who the user is, you must call `/introspect`. With a JWT, you decode the payload and read the claims directly.

---

## Client-Specific Token Settings in Practice

Here's what a Keycloak client config looks like for a client that gets JWTs:

```json
{
  "clientId": "my-react-app",
  "publicClient": true,
  "standardFlowEnabled": true,
  "attributes": {
    "access.token.lifespan": "900",
    "use.refresh.tokens": "true",
    "client.session.idle.timeout": "1800"
  },
  "protocolMappers": [
    {
      "name": "roles",
      "protocol": "openid-connect",
      "protocolMapper": "oidc-usermodel-realm-role-mapper",
      "config": {
        "claim.name": "roles",
        "access.token.claim": "true"
      }
    }
  ]
}
```

The `protocolMappers` section is where you control which claims go into the JWT. You can add custom claims (from user attributes, groups, external systems) or remove built-in ones.

---

## Token Introspection vs Local JWT Validation: The Real Difference

|  | Opaque + Introspect | JWT + JWKS |
|---|---|---|
| Validation per request | POST to `/introspect` | Local signature check |
| Network dependency | Yes — auth server must be up | Only for initial JWKS fetch |
| Revocation | Instant | At expiry (unless blocklist) |
| Claims available | Whatever `/introspect` returns | Whatever's in the JWT payload |
| Implementation complexity | Low | Medium (need JWT library + JWKS caching) |
| Auth server load | High (one call per API request) | Low (JWKS cached, tokens verified locally) |

---

## What Sentinel Does and What It Could Do

Currently Sentinel issues opaque tokens only. Every API call that needs to validate a token calls `/introspect`.

To support per-client token format choice, Sentinel would need:

1. A client registry (currently, any `client_id` is accepted — there's no DB of registered clients)
2. A `token_format` field on the registered client (`opaque` or `jwt`)
3. JWT issuance: sign tokens with a private key, expose JWKS
4. Logic in `exchangeCodeForToken`: check the client's format setting, issue accordingly

The introspect endpoint would stay for opaque tokens. JWT clients would validate locally via JWKS and never call `/introspect` at all.

---

Back to: [06 — OIDC](./06-oidc.md) | [07 — JWKS](./07-jwks.md) | [08 — OpenID Configuration](./08-openid-config.md)
