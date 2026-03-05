# Auth Learn — Sentinel Edition

Everything you need to understand how Sentinel works and the auth concepts behind it.
Each file covers one topic. Read them in order.

---

## Topics

| # | File | What it covers |
|---|---|---|
| 01 | [OAuth Basics](./01-oauth-basics.md) | Why OAuth exists, the 4 actors, what a token is, the big picture |
| 02 | [Authorization Code Flow](./02-authorization-code-flow.md) | Every step of your login flow with real URLs |
| 03 | [PKCE](./03-pkce.md) | The math behind PKCE — code_verifier, code_challenge, SHA-256 |
| 04 | [Tokens](./04-tokens.md) | Opaque vs JWT, id_token, refresh tokens |
| 05 | [Clients](./05-clients.md) | What a client is, registration, public vs confidential, state/CSRF |
| 06 | [OIDC](./06-oidc.md) | Identity layer on top of OAuth, id_token, userinfo, discovery |
| 07 | [JWKS](./07-jwks.md) | Public key endpoints, key rotation, kid, RS256 vs ES256 vs HS256 |
| 08 | [OpenID Configuration](./08-openid-config.md) | The discovery document — every field, how SDKs use it |
| 09 | [Token Format Choice](./09-token-format-choice.md) | How auth servers let clients pick opaque vs JWT, when to use each |
| 10 | [PKCE + State + Public Keys](./10-pkce-state-and-public-keys.md) | Is PKCE the standard? Yes. Why the public JWKS URL is not a security risk. |
| 11 | [Client Registry and Tenancy](./11-client-registry-and-tenancy.md) | Should the server generate client IDs? Auth0 model vs Keycloak model explained. |
| 12 | [Persistent Keys](./12-persistent-keys.md) | Why public keys are exposed, how to generate + load RSA keys in production. |

---

## Quick Glossary

| Term | One-line definition |
|---|---|
| **OAuth 2.0** | Protocol for delegated authorization — apps acting on behalf of users |
| **OIDC** | OpenID Connect — identity layer on top of OAuth |
| **Authorization Server** | Sentinel — handles login, issues tokens |
| **Client** | Your frontend app — registered in Sentinel |
| **Resource Owner** | The user — Alice, Bob |
| **Resource Server** | Your backend API — validates tokens |
| **Authorization Code** | Short-lived one-time code — exchanged for a token |
| **Access Token** | The actual credential used to call APIs |
| **id_token** | JWT with user identity info (OIDC) |
| **Refresh Token** | Long-lived token to get new access tokens |
| **PKCE** | Proof Key for Code Exchange — secures public clients |
| **code_verifier** | Random secret your frontend generates |
| **code_challenge** | SHA256(code_verifier) — sent to auth server upfront |
| **Scope** | Permission label (openid, profile, email) |
| **Opaque token** | Random string — meaning lives in the DB |
| **JWT** | Self-contained token — meaning is encoded inside it |
| **Introspection** | Asking the auth server "is this token valid?" |
| **JWKS** | Public keys for verifying JWT signatures |
| **state** | Random string to prevent CSRF in the OAuth flow |
