const jwt = require('jsonwebtoken');
const { getKeyPair, KEY_ID } = require('./keyService');

// Signs and returns a JWT access token (RS256, 15 min lifetime)
const signAccessToken = ({ userId, email, clientId, scope }) => {
  const { privateKey } = getKeyPair();
  const now = Math.floor(Date.now() / 1000);

  return jwt.sign(
    {
      sub: String(userId),
      email,
      aud: clientId,
      scope,
      iat: now,
      exp: now + 900, // 15 minutes
    },
    privateKey,
    {
      algorithm: 'RS256',
      issuer: process.env.ISSUER_URL,
      keyid: KEY_ID,
    }
  );
};

// Verifies a JWT, returns the decoded payload or throws
const verifyAccessToken = (token) => {
  const { publicKey } = getKeyPair();
  return jwt.verify(token, publicKey, {
    algorithms: ['RS256'],
    issuer: process.env.ISSUER_URL,
  });
};

module.exports = { signAccessToken, verifyAccessToken };
