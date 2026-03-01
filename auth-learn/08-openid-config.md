# 08 — OpenID Configuration: The Discovery Document

Without discovery, integrating an auth server means reading documentation and manually configuring five or six endpoint URLs. Every library you use needs these values. Every environment (dev, staging, prod) needs its own config. It's tedious and error-prone.

The discovery document solves this entirely.

---

## The Endpoint

```
GET /.well-known/openid-configuration
```

One GET request. The auth server describes itself — every endpoint, every supported algorithm, every supported scope and grant type.

This URL is standardized by RFC 8414 and the OIDC spec. Every compliant auth server publishes it at exactly this path.

---

## A Full Discovery Document

```json
{
  "issuer": "https://auth.yourservice.com",

  "authorization_endpoint": "https://auth.yourservice.com/oauth/authorize",
  "token_endpoint": "https://auth.yourservice.com/oauth/token",
  "userinfo_endpoint": "https://auth.yourservice.com/userinfo",
  "introspection_endpoint": "https://auth.yourservice.com/oauth/introspect",
  "revocation_endpoint": "https://auth.yourservice.com/oauth/revoke",
  "end_session_endpoint": "https://auth.yourservice.com/oauth/logout",
  "jwks_uri": "https://auth.yourservice.com/.well-known/jwks.json",

  "scopes_supported": ["openid", "profile", "email", "offline_access"],
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token", "client_credentials"],

  "token_endpoint_auth_methods_supported": ["none", "client_secret_basic", "client_secret_post", "private_key_jwt"],

  "subject_types_supported": ["public"],
  "id_token_signing_alg_values_supported": ["RS256", "ES256"],
  "userinfo_signing_alg_values_supported": ["none", "RS256"],

  "code_challenge_methods_supported": ["S256"],

  "claims_supported": ["sub", "iss", "aud", "iat", "exp", "email", "email_verified", "name", "given_name", "family_name"],

  "request_parameter_supported": false,
  "request_uri_parameter_supported": false
}
```

---

## Field by Field

### Identity

| Field | Meaning |
|---|---|
| `issuer` | The canonical URL of this auth server. Every JWT issued has this as the `iss` claim. Clients validate that `iss` in a token matches the issuer they configured. |

### Endpoints

| Field | Meaning |
|---|---|
| `authorization_endpoint` | Where to send users to start the login flow |
| `token_endpoint` | Where to exchange codes for tokens |
| `userinfo_endpoint` | Where to get user profile data with an access token |
| `introspection_endpoint` | Where to validate opaque tokens |
| `revocation_endpoint` | Where to invalidate tokens (logout, security event) |
| `end_session_endpoint` | Where to send users to log out (clears the session on the auth server) |
| `jwks_uri` | Where to get the public keys for verifying JWT signatures |

### What's Supported

| Field | Meaning |
|---|---|
| `scopes_supported` | Which scopes clients can request |
| `response_types_supported` | `code` for authorization code flow, `token` for implicit (deprecated), `code id_token` for hybrid |
| `grant_types_supported` | Which grant types are enabled |
| `code_challenge_methods_supported` | Which PKCE methods work. `S256` is the only one you should use. |

### Authentication Methods

`token_endpoint_auth_methods_supported` describes how clients prove their identity when calling the token endpoint:

| Method | How it works |
|---|---|
| `none` | No secret. Public clients using PKCE. |
| `client_secret_basic` | `Authorization: Basic base64(client_id:client_secret)` header |
| `client_secret_post` | `client_id` and `client_secret` in the POST body |
| `private_key_jwt` | Client signs a JWT with its own private key — strongest option |

### Token Signing

| Field | Meaning |
|---|---|
| `id_token_signing_alg_values_supported` | Algorithms the server may use to sign `id_tokens`. Client picks at registration. |
| `subject_types_supported` | `public` = same `sub` for the user across all clients. `pairwise` = different `sub` per client (privacy-preserving). |

### Claims

`claims_supported` tells clients which JWT/userinfo claims they can expect to receive. If `picture` isn't in this list, don't try to use it.

---

## How SDKs Use This

This is where the developer experience payoff happens.

Without discovery, configuring an OAuth library looks like this:

```js
const client = new OAuthClient({
  clientId: 'my-app',
  authorizationEndpoint: 'https://auth.yourservice.com/oauth/authorize',
  tokenEndpoint: 'https://auth.yourservice.com/oauth/token',
  userinfoEndpoint: 'https://auth.yourservice.com/userinfo',
  jwksUri: 'https://auth.yourservice.com/.well-known/jwks.json',
});
```

With discovery:

```js
const client = await OAuthClient.discover('https://auth.yourservice.com', {
  clientId: 'my-app',
});
```

The library fetches `/.well-known/openid-configuration` itself, reads all the endpoints, and configures everything. You give it one URL.

Libraries like `openid-client` (Node.js), Auth.js, and every major language SDK support this. It's the reason OIDC-compliant auth servers all feel the same from the developer side — the protocol handles the plumbing.

---

## The `issuer` Field Is Critical

The `issuer` value does double duty:

1. It's published in the discovery document
2. It must match the `iss` claim in every JWT issued by this server

When a library validates a JWT, it checks:
- Did I get this public key from the issuer I trust? (via JWKS)
- Does the `iss` claim in the JWT match that issuer?

This prevents a token issued by `auth.evil.com` from being accepted by a service that trusts `auth.yourservice.com`, even if both use RS256 and the attacker can produce a valid signature for their own key.

---

## The `/.well-known/` Convention

The path prefix `/.well-known/` is an IETF standard (RFC 8615) for "well-known" metadata endpoints — documents describing how a server works, without needing prior knowledge of the URL structure.

Other examples:
- `/.well-known/jwks.json` — public signing keys
- `/.well-known/security.txt` — security vulnerability contact info
- `/.well-known/acme-challenge/` — Let's Encrypt domain verification

The convention: if you know a server follows a given standard, you know exactly where to look without any documentation.

---

## What a Minimal Discovery Document Looks Like

Not every field is required. For a server that only does authorization code flow + PKCE:

```json
{
  "issuer": "https://auth.yourservice.com",
  "authorization_endpoint": "https://auth.yourservice.com/oauth/authorize",
  "token_endpoint": "https://auth.yourservice.com/oauth/token",
  "jwks_uri": "https://auth.yourservice.com/.well-known/jwks.json",
  "response_types_supported": ["code"],
  "subject_types_supported": ["public"],
  "id_token_signing_alg_values_supported": ["RS256"]
}
```

`issuer`, `authorization_endpoint`, `token_endpoint`, `jwks_uri`, `response_types_supported`, `subject_types_supported`, and `id_token_signing_alg_values_supported` are the required fields per the OIDC spec.

---

## What Sentinel Would Need to Serve This

Sentinel currently doesn't have a discovery endpoint. Adding one is straightforward since all the values are static:

```js
app.get('/.well-known/openid-configuration', (req, res) => {
  const base = process.env.ISSUER_URL; // e.g. https://auth.yourservice.com
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

The only blocker: Sentinel uses opaque tokens, not JWTs. The `jwks_uri` field implies JWT support. The discovery document can still list it (pointing to an empty or future endpoint), but until JWTs are implemented, clients can't actually verify tokens locally.

---

Next: [09 — Token Format Choice: Opaque vs JWT Per Client](./09-token-format-choice.md)
