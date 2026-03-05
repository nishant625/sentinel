# Silent Refresh

## The problem

Access tokens expire. In Sentinel they expire in 15 minutes.

When the token expires, every API call starts returning `401`. The user didn't do anything wrong — their session is fine — but from the app's perspective they're suddenly "logged out". If you just redirect them to login, that's a bad experience.

The solution is **silent refresh**: automatically get a new access token using the refresh token, without the user noticing.

---

## What you have right now

```
login → access_token (15 min) + refresh_token (30 days)
```

`auth-react` stores both in `localStorage`. `getAccessToken()` just returns whatever is in storage — it doesn't check if it's expired. So after 15 minutes:

- `getAccessToken()` returns an expired JWT
- API call gets a `401`
- Nothing handles it
- User is stuck

---

## What silent refresh looks like

Instead of `getAccessToken()` just reading from storage, it should:

1. Decode the token and check `exp`
2. If it's still valid → return it
3. If it's expired (or about to expire) → call `POST /oauth/token` with `grant_type=refresh_token`
4. Store the new access token and refresh token
5. Return the new access token

From the user's perspective nothing happens. The token just silently rotates.

```
getAccessToken()
  ├── token valid? → return it
  └── token expired?
        ├── have refresh_token?
        │     ├── POST /oauth/token  (refresh_token grant)
        │     ├── store new tokens
        │     └── return new access_token
        └── no refresh_token? → return null (force login)
```

---

## Two approaches

### 1. On-demand refresh (lazy)

`getAccessToken()` becomes async. Every time a component calls it, the token is checked and refreshed if needed. Simple to implement.

**Downside:** every caller has to `await getAccessToken()`. If you forget, you pass a Promise to `Authorization: Bearer`.

### 2. Proactive refresh (scheduled)

On login, schedule a `setTimeout` to refresh the token ~1 minute before it expires. The access token in state is always fresh by the time anyone uses it.

```
token issued at t=0, expires at t=900s
schedule refresh at t=840s (14 min)
```

**Downside:** if the tab is backgrounded/sleeping the timeout might not fire on time. Need a fallback check on-demand anyway.

### 3. Interceptor approach (most common)

Wrap your API client (axios/fetch). When any request gets a `401`, try refreshing once and retry the original request. If the refresh also fails, log the user out.

```
request → 401?
  → try refresh
    → success? retry original request
    → fail?    logout()
```

This is what most production apps do (Axios interceptors are built for this).

---

## The refresh token grant

The actual HTTP call to refresh:

```
POST /oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token
&refresh_token=<raw_refresh_token>
&client_id=<client_id>
```

Sentinel's token endpoint handles this already. It rotates the refresh token — the old one is marked `used`, a new pair is issued. So after every refresh you must store both the new `access_token` AND the new `refresh_token`.

If you reuse an old refresh token (already marked used), Sentinel throws `Refresh token already used` → `401`.

---

## What needs to change in auth-react

Currently:

```js
const getAccessToken = () => localStorage.getItem('access_token');
```

After the fix, `getAccessToken` needs to:

- Be async
- Check expiry
- Call the token endpoint with the refresh token if expired
- Update storage with the new tokens
- Return the fresh access token

The `AuthContext` also needs to expose `refreshToken` state internally so the refresh call knows what to send.

---

## Why this matters for security

Refresh tokens are long-lived (30 days here). They're the real credential. Access tokens being short-lived (15 min) limits the damage if one is stolen — it expires quickly. But if the refresh token is stolen from `localStorage`, the attacker has 30 days of access and can keep silently refreshing. This is the core trade-off of token storage in `localStorage`.

The industry answer is: keep the refresh token in an `HttpOnly` cookie (JS can't read it) and do the refresh via a same-origin backend endpoint. But that's a bigger architectural change.
