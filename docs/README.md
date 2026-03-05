# Sentinel Docs

Three folders. Read them in whatever order you need.

---

## `learn/` — Concepts

Theory behind what Sentinel implements. Start here if you're learning.

| File | What it covers |
|---|---|
| [01 OAuth Basics](./learn/01-oauth-basics.md) | Why OAuth exists, the 4 actors |
| [02 Auth Code Flow](./learn/02-authorization-code-flow.md) | Every step with real URLs |
| [03 PKCE](./learn/03-pkce.md) | code_verifier, code_challenge, SHA-256 math |
| [04 Tokens](./learn/04-tokens.md) | Opaque vs JWT, refresh tokens |
| [05 Clients](./learn/05-clients.md) | Registration, public vs confidential |
| [06 OIDC](./learn/06-oidc.md) | Identity layer on top of OAuth |
| [07 JWKS](./learn/07-jwks.md) | Public keys, key rotation, kid |
| [08 OpenID Config](./learn/08-openid-config.md) | Discovery document breakdown |
| [09 Token Format Choice](./learn/09-token-format-choice.md) | Opaque vs JWT per client |
| [10 PKCE + State + Public Keys](./learn/10-pkce-state-and-public-keys.md) | Is PKCE standard? Public key question answered |
| [11 Client Registry & Tenancy](./learn/11-client-registry-and-tenancy.md) | Auth0 model vs Keycloak model |
| [12 Persistent Keys](./learn/12-persistent-keys.md) | Why public keys are exposed, generating + loading RSA keys in production |

---

## `implemented/` — Code Reference

Concept → schema → service → route. Where things actually live.

| File | What it covers |
|---|---|
| [01 Full Auth Flow](./implemented/01-full-auth-flow.md) | End-to-end trace, file by file |
| [02 Schema](./implemented/02-schema.md) | Every model, every field explained |
| [03 Tokens](./implemented/03-tokens.md) | JWT signing, refresh token, opaque commented path |
| [04 Client Registry](./implemented/04-client-registry.md) | Admin API, client validation, seed client |
| [05 Endpoints](./implemented/05-endpoints.md) | Every route, what it does, where it lives |

---

## `plans/` — What's Next

| File | Phase |
|---|---|
| [ROADMAP](./plans/ROADMAP.md) | All 6 phases overview |
| [01 Client Registry](./plans/01-client-registry.md) | ✅ Done |
| [02 JWT Tokens](./plans/02-jwt-tokens.md) | ✅ Done |
| [03 Refresh Tokens](./plans/03-refresh-tokens.md) | ✅ Done |
