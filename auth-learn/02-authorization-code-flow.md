# 02 — Authorization Code Flow: Step by Step

This is the standard flow for any app that has a human logging in. Web apps, SPAs, mobile apps — all use this. Let's walk through every step.

---

## Step 1 — App Redirects the User to the Auth Server

When the user clicks login, your app builds a URL and redirects the browser to the auth server's authorization endpoint.

```
https://auth.yourservice.com/oauth/authorize
  ?client_id=my-app
  &redirect_uri=https://yourapp.com/callback
  &response_type=code
  &state=xK9mP2qR
  &scope=openid
  &code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM
  &code_challenge_method=S256
```

| Param | What it is |
|---|---|
| `client_id` | Which registered app is asking |
| `redirect_uri` | Where to send the user after login |
| `response_type=code` | "Give me an authorization code, not a token directly" |
| `state` | Random string your app generated — for CSRF protection |
| `scope` | What permissions are being requested |
| `code_challenge` | PKCE — explained fully in the next file |
| `code_challenge_method` | How the challenge was computed (S256 = SHA-256) |

*This is exactly what Sentinel receives at `/oauth/authorize`.*

---

## Step 2 — Auth Server Shows the Login Page

The auth server:
1. Validates `client_id` exists and is registered
2. Validates `redirect_uri` matches what's registered for that client
3. Stores the request params for use after login
4. Shows the login form

**The login page is hosted on the auth server's domain — not your app's domain.** This is the whole point. Your app never sees the password. The user types credentials directly into the auth server's page.

The hidden fields you see on the form? The auth server embeds the request context — which client, which scopes, which code_challenge — so when the form submits, it knows which OAuth request this login belongs to.

---

## Step 3 — User Authenticates

User submits email + password. The auth server:

1. Looks up the user
2. Verifies the password (bcrypt comparison against the stored hash — never plain text)
3. Optionally prompts for MFA
4. Creates an **authorization code** — a short-lived, one-time-use random string stored in the DB alongside the request context

Best practice for the auth code:
- Short lived: 5 minutes max (Sentinel: 5 minutes ✓)
- Single use: invalidated immediately after exchange (Sentinel: `used` flag ✓)
- Tied to the code_challenge so only the original requester can exchange it

---

## Step 4 — Auth Server Redirects Back to Your App

```
https://yourapp.com/callback
  ?code=a7f3b2c1d9e4f5a6
  &state=xK9mP2qR
```

Your app:
1. **Checks `state` matches** what it stored before the redirect — if it doesn't match, abort. This prevents CSRF.
2. Grabs the `code`

---

## Step 5 — App Exchanges the Code for a Token

Your app makes a direct POST (not a redirect — a real HTTP request) to the auth server's token endpoint:

```http
POST /oauth/token
Content-Type: application/json

{
  "grant_type": "authorization_code",
  "code": "a7f3b2c1d9e4f5a6",
  "redirect_uri": "https://yourapp.com/callback",
  "client_id": "my-app",
  "code_verifier": "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
}
```

The auth server:
1. Finds the code in the DB
2. Checks it's not expired
3. Checks it hasn't been used before
4. Verifies the `code_verifier` against the stored `code_challenge` (PKCE)
5. Marks the code as used
6. Issues tokens

Response:
```json
{
  "access_token": "...",
  "id_token": "...",
  "refresh_token": "...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

*Sentinel returns `access_token` only. `id_token` and `refresh_token` are not yet implemented.*

---

## Step 6 — App Uses the Token

Every API call your app makes:

```http
GET /api/profile
Authorization: Bearer <access_token>
```

Your API extracts the token, validates it, gets the user identity, responds.

---

## Why the Code → Exchange Dance?

Why not just return a token directly in Step 4 (the redirect)?

Because **redirects go through the browser URL bar** — visible in browser history, server access logs, the `Referer` header. A token in a URL is a token anyone can steal from logs.

The code is a **throwaway voucher**:
- It expires in 5 minutes
- It can only be used once
- Even if stolen, the attacker needs the `code_verifier` to use it (which never goes in a URL)

The token is the real credential. It only travels in POST body and HTTP headers — not in URLs.

---

## The Implicit Flow (Don't Use It)

There was an older flow that skipped the code exchange and returned the token directly in the redirect URL. This is the "Implicit Flow." It's deprecated. Don't use it. All the reasons above are why.

Modern best practice: **Authorization Code Flow + PKCE, always.**

---

Next: [03 — PKCE: The Math Explained](./03-pkce.md)
