# 05 — Clients: Registration and Trust

"Client" is one of the most overloaded words in OAuth. It doesn't mean browser, it doesn't mean user — it means **registered application**.

---

## What a Client Is

A client is an application that is allowed to use your auth server.

Before any app can redirect users to your auth server, it must be registered. Registration creates a trust relationship: the auth server knows about this app, what it's allowed to do, and where it's allowed to send users.

Examples of clients:
- Your React frontend
- Your iOS mobile app
- Your backend service calling another internal service
- A third-party integration built by someone else

Each gets its own `client_id`. Each has its own rules.

---

## Why Registration Matters

Without registration, an attacker could build a URL:

```
/oauth/authorize
  ?client_id=fake-app
  &redirect_uri=https://evil.com/steal
  &scope=openid
```

Without checking, the auth server would redirect the user's auth code straight to `evil.com`. Done — stolen.

Client registration means the auth server has a **list of trusted apps**. If the `client_id` isn't on the list, reject. If the `redirect_uri` doesn't match what's registered for that client, reject.

*Sentinel validates both `client_id` and `redirect_uri` against its DB before showing the login page.*

---

## What Gets Registered

At minimum:

| Field | What it is |
|---|---|
| `client_id` | Unique identifier for the app (e.g. `my-react-app`) |
| `redirect_uris` | The exact URIs this app may redirect to — must match exactly |
| `allowed_scopes` | What scopes this client can request |
| `client_type` | Public or confidential (explained below) |

In production systems you'd also configure:
- Access token lifetime for this client
- Allowed grant types
- Refresh token settings
- Logo / display name (shown on consent screens)

---

## Public vs Confidential Clients

This is one of the most important distinctions in OAuth.

### Confidential Clients

Run on a server. The source code is not visible to end users. They can safely hold a secret.

They authenticate to the auth server using a `client_secret` — like a password for the app itself:

```http
POST /oauth/token
Authorization: Basic base64(client_id:client_secret)
```

Examples: server-rendered apps (Next.js SSR), backend services, machine-to-machine services.

### Public Clients

Run where code is visible — browsers, mobile apps. There's no way to embed a secret that can't be extracted.

Anyone can open DevTools, read your JS bundle, or decompile your mobile app. Any `client_secret` you put in there is effectively public.

Examples: React/Vue/Angular SPAs, native mobile apps.

**Public clients use PKCE instead of a client_secret.** PKCE doesn't require a pre-shared secret — it proves identity per-flow using the code_verifier/challenge mechanism.

*Your frontend with Sentinel is a public client using PKCE. There's no client_secret involved.*

---

## The `redirect_uri` Must Be Exact

This trips people up. The registered `redirect_uri` must match the one in the request **exactly**.

Registered: `https://yourapp.com/callback`

These will be rejected:
- `https://yourapp.com/callback?extra=param` — extra query param
- `https://yourapp.com/Callback` — different case
- `http://yourapp.com/callback` — different scheme
- `https://yourapp.com/callback/` — trailing slash

This strictness exists for a reason. If the auth server allowed partial matches or wildcards, an attacker could craft a URL that redirects to their server.

---

## The `state` Parameter — CSRF Protection

When your app starts the OAuth flow, it generates a random string and puts it in the `state` param:

```
/oauth/authorize?...&state=xK9mP2qR7vT2
```

Your app stores this locally (memory or sessionStorage).

After login, the auth server echoes it back in the redirect:

```
/callback?code=abc123&state=xK9mP2qR7vT2
```

Your app checks: does this `state` match what I stored?

**If yes** — this redirect is from a login I actually started. Continue.

**If no** — someone is trying a CSRF attack: tricking your browser into completing an OAuth flow you didn't initiate, potentially logging you in as the attacker. Reject and abort.

Always validate `state`. Always.

---

## Machine-to-Machine: Client Credentials Grant

When a backend service needs to call another service (no user involved), there's a separate flow: **client credentials**.

```http
POST /oauth/token
{
  "grant_type": "client_credentials",
  "client_id": "service-a",
  "client_secret": "secret123",
  "scope": "read:internal-api"
}
```

The auth server issues a token for the service itself, not on behalf of a user.

*Sentinel doesn't implement client credentials — it only does Authorization Code Flow.*

---

Next: [06 — OIDC: Identity on Top of OAuth](./06-oidc.md)
