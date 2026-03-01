const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { signAccessToken, verifyAccessToken } = require('./jwtService');
const { getClient } = require('./clientService');

const prisma = new PrismaClient();

const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

// ─── User auth ────────────────────────────────────────────────────────────────

const verifyUser = async (email, password) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return null;

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) return null;

  return user;
};

// ─── Auth code ────────────────────────────────────────────────────────────────

const createAuthCode = async ({ userId, clientId, redirectUri, codeChallenge, codeChallengeMethod, scope }) => {
  const code = crypto.randomBytes(32).toString('hex');

  const authCode = await prisma.authCode.create({
    data: {
      code,
      userId,
      clientId,
      redirectUri,
      codeChallenge,
      codeChallengeMethod,
      scope: scope || 'openid',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    },
  });

  return authCode.code;
};

// ─── Token issuance ───────────────────────────────────────────────────────────

const issueTokenPair = async ({ userId, email, clientId, scope, tokenFormat }) => {
  let accessToken;

  if (tokenFormat === 'jwt') {
    // JWT access token — self-contained, verified locally via JWKS
    accessToken = signAccessToken({ userId, email, clientId, scope });

    await prisma.token.create({
      data: {
        token: accessToken,
        userId,
        clientId,
        scope,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 min
      },
    });
  } else {
    // ── OPAQUE TOKEN (legacy path — kept for reference) ──────────────────────
    // accessToken = crypto.randomBytes(32).toString('hex');
    //
    // await prisma.token.create({
    //   data: {
    //     token: accessToken,
    //     userId,
    //     clientId,
    //     scope,
    //     expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    //   },
    // });
    // ─────────────────────────────────────────────────────────────────────────

    // Opaque clients fall back to JWT for now until opaque path is re-enabled
    accessToken = signAccessToken({ userId, email, clientId, scope });
    await prisma.token.create({
      data: {
        token: accessToken,
        userId,
        clientId,
        scope,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });
  }

  // Refresh token — always opaque, stored hashed, 30 days
  const refreshTokenRaw = crypto.randomBytes(40).toString('hex');
  await prisma.refreshToken.create({
    data: {
      tokenHash: hashToken(refreshTokenRaw),
      userId,
      clientId,
      scope,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  return { accessToken, refreshToken: refreshTokenRaw };
};

// ─── Code exchange ────────────────────────────────────────────────────────────

const exchangeCodeForToken = async ({ code, clientId, redirectUri, codeVerifier }) => {
  const authCode = await prisma.authCode.findUnique({
    where: { code },
    include: { user: true },
  });

  if (!authCode) throw new Error('Invalid code');
  if (authCode.used) throw new Error('Code already used');
  if (authCode.expiresAt < new Date()) throw new Error('Code expired');
  if (authCode.clientId !== clientId) throw new Error('client_id mismatch');
  if (authCode.redirectUri !== redirectUri) throw new Error('redirect_uri mismatch');

  const hash = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  if (hash !== authCode.codeChallenge) throw new Error('PKCE verification failed');

  await prisma.authCode.update({ where: { code }, data: { used: true } });

  const client = await getClient(clientId);

  return issueTokenPair({
    userId: authCode.userId,
    email: authCode.user.email,
    clientId,
    scope: authCode.scope,
    tokenFormat: client.tokenFormat,
  });
};

// ─── Refresh ──────────────────────────────────────────────────────────────────

const refreshAccessToken = async ({ refreshToken, clientId }) => {
  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(refreshToken) },
    include: { user: true },
  });

  if (!record) throw new Error('Invalid refresh token');
  if (record.used) throw new Error('Refresh token already used');
  if (record.expiresAt < new Date()) throw new Error('Refresh token expired');
  if (record.clientId !== clientId) throw new Error('client_id mismatch');

  // Rotate: mark old token used
  await prisma.refreshToken.update({
    where: { tokenHash: hashToken(refreshToken) },
    data: { used: true },
  });

  const client = await getClient(clientId);

  return issueTokenPair({
    userId: record.userId,
    email: record.user.email,
    clientId: record.clientId,
    scope: record.scope,
    tokenFormat: client.tokenFormat,
  });
};

// ─── Revoke ───────────────────────────────────────────────────────────────────

const revokeRefreshToken = async ({ refreshToken, clientId }) => {
  await prisma.refreshToken.deleteMany({
    where: { tokenHash: hashToken(refreshToken), clientId },
  });
};

// ─── Introspect ───────────────────────────────────────────────────────────────

const introspectToken = async (token) => {
  // JWT path — verify signature locally, no DB needed
  if (token.startsWith('eyJ')) {
    try {
      const decoded = verifyAccessToken(token);
      return {
        active: true,
        sub: decoded.sub,
        scope: decoded.scope,
        client_id: decoded.aud,
        username: decoded.email,
        exp: decoded.exp,
        iat: decoded.iat,
      };
    } catch {
      return { active: false };
    }
  }

  // ── OPAQUE TOKEN path (legacy) ────────────────────────────────────────────
  // const tokenRecord = await prisma.token.findUnique({
  //   where: { token },
  //   include: { user: true },
  // });
  //
  // if (!tokenRecord) return { active: false };
  // if (tokenRecord.expiresAt < new Date()) return { active: false };
  //
  // return {
  //   active: true,
  //   scope: tokenRecord.scope,
  //   client_id: tokenRecord.clientId,
  //   username: tokenRecord.user.email,
  //   user_id: tokenRecord.userId,
  //   exp: Math.floor(tokenRecord.expiresAt.getTime() / 1000),
  //   iat: Math.floor(tokenRecord.createdAt.getTime() / 1000),
  // };
  // ─────────────────────────────────────────────────────────────────────────

  return { active: false };
};

module.exports = {
  verifyUser,
  createAuthCode,
  exchangeCodeForToken,
  refreshAccessToken,
  revokeRefreshToken,
  introspectToken,
};
