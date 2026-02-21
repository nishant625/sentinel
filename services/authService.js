const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const prisma = new PrismaClient();

const verifyUser = async (email, password) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return null;

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) return null;

  return user;
};

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
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
    },
  });

  return authCode.code;
};

const exchangeCodeForToken = async ({ code, clientId, redirectUri, codeVerifier }) => {
  const authCode = await prisma.authCode.findUnique({ where: { code } });

  if (!authCode) throw new Error('Invalid code');
  if (authCode.used) throw new Error('Code already used');
  if (authCode.expiresAt < new Date()) throw new Error('Code expired');
  if (authCode.clientId !== clientId) throw new Error('client_id mismatch');
  if (authCode.redirectUri !== redirectUri) throw new Error('redirect_uri mismatch');

  const hash = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');

  if (hash !== authCode.codeChallenge) throw new Error('PKCE verification failed');

  await prisma.authCode.update({
    where: { code },
    data: { used: true },
  });

  const token = crypto.randomBytes(32).toString('hex');

  await prisma.token.create({
    data: {
      token,
      userId: authCode.userId,
      clientId,
      scope: authCode.scope,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  return token;
};

const introspectToken = async (token) => {
  const tokenRecord = await prisma.token.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!tokenRecord) {
    return { active: false };
  }

  const isExpired = tokenRecord.expiresAt < new Date();
  if (isExpired) {
    return { active: false };
  }

  return {
    active: true,
    scope: tokenRecord.scope,
    client_id: tokenRecord.clientId,
    username: tokenRecord.user.email,
    user_id: tokenRecord.userId,
    exp: Math.floor(tokenRecord.expiresAt.getTime() / 1000),
    iat: Math.floor(tokenRecord.createdAt.getTime() / 1000),
  };
};

module.exports = { verifyUser, createAuthCode, exchangeCodeForToken, introspectToken };
