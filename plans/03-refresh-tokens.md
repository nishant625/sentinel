# Plan 03 — Refresh Tokens

## Goal

Issue refresh tokens alongside access tokens. Short-lived access tokens (15 min). Long-lived refresh tokens (30 days, stored hashed in DB). Token rotation on every use. A `/oauth/revoke` endpoint for logout.

---

## Prerequisites

Phase 01 (Client Registry) and Phase 02 (JWT) should be done. Phase 02 drops access token lifetime to 15 min — without refresh tokens, users would get logged out every 15 minutes. This phase fixes that.

---

## Schema Change

Add `RefreshToken` model:

```prisma
model RefreshToken {
  id        Int      @id @default(autoincrement())
  tokenHash String   @unique    // bcrypt hash of the actual token
  userId    Int
  clientId  String
  scope     String
  expiresAt DateTime
  used      Boolean  @default(false)
  createdAt DateTime @default(now())

  user   User   @relation(fields: [userId], references: [id])
  client Client @relation(fields: [clientId], references: [clientId])
}
```

**Why store the hash, not the token itself?**

If your DB is breached, an attacker shouldn't be able to use the leaked refresh tokens directly. You hash them (SHA-256 is fine here, bcrypt is slower than needed) and compare on lookup.

```js
const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');
```

---

## Changes to Token Issuance

In `authService.js` — `exchangeCodeForToken`:

Currently returns just an access token string.

After: returns an object with both:

```js
const issueTokenPair = async ({ userId, clientId, scope }) => {
  // Access token (JWT or opaque depending on client.tokenFormat)
  const accessToken = ...; // existing logic

  // Refresh token — always opaque
  const refreshToken = crypto.randomBytes(40).toString('hex');
  const refreshTokenHash = hashToken(refreshToken);

  await prisma.refreshToken.create({
    data: {
      tokenHash: refreshTokenHash,
      userId,
      clientId,
      scope,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
  });

  return { accessToken, refreshToken };
};
```

The `/oauth/token` response changes from:
```json
{
  "access_token": "...",
  "token_type": "Bearer",
  "expires_in": 86400
}
```

To:
```json
{
  "access_token": "...",
  "token_type": "Bearer",
  "expires_in": 900,
  "refresh_token": "...",
  "refresh_token_expires_in": 2592000
}
```

---

## New Grant Type: `refresh_token`

In `oauthController.js` — `token`:

```js
if (grant_type === 'refresh_token') {
  const { refresh_token, client_id } = req.body;

  if (!refresh_token || !client_id) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    const result = await authService.refreshAccessToken({ refreshToken: refresh_token, clientId: client_id });
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}
```

In `authService.js` — new `refreshAccessToken`:

```js
const refreshAccessToken = async ({ refreshToken, clientId }) => {
  const tokenHash = hashToken(refreshToken);

  const record = await prisma.refreshToken.findUnique({ where: { tokenHash } });

  if (!record) throw new Error('Invalid refresh token');
  if (record.used) throw new Error('Refresh token already used');
  if (record.expiresAt < new Date()) throw new Error('Refresh token expired');
  if (record.clientId !== clientId) throw new Error('client_id mismatch');

  // Rotation: mark old token as used
  await prisma.refreshToken.update({
    where: { tokenHash },
    data: { used: true },
  });

  // Issue new pair
  return issueTokenPair({
    userId: record.userId,
    clientId: record.clientId,
    scope: record.scope,
  });
};
```

**Why mark as used instead of delete?**

If an attacker steals a refresh token and uses it before the legitimate user does, the legitimate user's next request will see the token is already `used`. You can then detect this as a potential token theft — both parties tried to use the same token. You can revoke the entire session. This is called "refresh token reuse detection."

---

## New Endpoint: `POST /oauth/revoke`

For logout. Client sends the refresh token, Sentinel marks it used (or deletes it — deleted is cleaner for revoke).

```js
// routes/oauth.js
router.post('/revoke', oauthController.revoke);

// controllers/oauthController.js
const revoke = async (req, res) => {
  const { token, client_id } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Missing token' });
  }

  await authService.revokeRefreshToken({ token, clientId: client_id });

  // Per RFC 7009: always return 200 even if token doesn't exist
  res.json({});
};
```

```js
// authService.js
const revokeRefreshToken = async ({ token, clientId }) => {
  const tokenHash = hashToken(token);
  await prisma.refreshToken.deleteMany({
    where: { tokenHash, clientId },
  });
};
```

---

## Update Discovery Document

Add to `/.well-known/openid-configuration`:

```json
{
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "revocation_endpoint": "https://auth.yourservice.com/oauth/revoke"
}
```

---

## Update Seed

The seed currently hardcodes users. After Phase 01, it should also seed a test client. After Phase 03, you can document the full flow for manual testing.

---

## Files to Create / Modify

| File | Action |
|---|---|
| `prisma/schema.prisma` | Add `RefreshToken` model |
| `services/authService.js` | Add `refreshAccessToken`, `revokeRefreshToken`, update `exchangeCodeForToken` to return token pair |
| `controllers/oauthController.js` | Handle `grant_type=refresh_token`; add `revoke` handler |
| `routes/oauth.js` | Add `POST /revoke` |
| `index.js` | Update discovery document response |

---

## Test Flow After This Phase

```bash
# Full flow — get both tokens
POST /oauth/token
  grant_type=authorization_code&code=xxx&...
# → { access_token, refresh_token, expires_in: 900 }

# Wait or simulate expiry — use refresh token to get new pair
POST /oauth/token
  grant_type=refresh_token&refresh_token=xxx&client_id=clt_xxx
# → { access_token (new), refresh_token (new, rotated), expires_in: 900 }

# Old refresh token is now invalid
POST /oauth/token
  grant_type=refresh_token&refresh_token=xxx (old one)
# → 400 { error: "Refresh token already used" }

# Revoke (logout)
POST /oauth/revoke
  token=xxx (current refresh token)&client_id=clt_xxx
# → 200 {}

# Revoked token no longer works
POST /oauth/token
  grant_type=refresh_token&refresh_token=xxx (revoked)
# → 400 { error: "Invalid refresh token" }
```
