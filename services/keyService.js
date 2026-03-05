const crypto = require('crypto');

const KEY_ID = 'sentinel-key-1';

let keyPair = null;

const initKeys = () => {
  if (process.env.PRIVATE_KEY_PEM && process.env.PUBLIC_KEY_PEM) {
    keyPair = {
      privateKey: process.env.PRIVATE_KEY_PEM.replace(/\\n/g, '\n'),
      publicKey:  process.env.PUBLIC_KEY_PEM.replace(/\\n/g, '\n'),
    };

    try {
      crypto.createPrivateKey(keyPair.privateKey);
      console.log('[keys] loaded from environment  kid=%s', KEY_ID);
    } catch (err) {
      console.error('[keys] private key parse failed:', err.message);
      throw err;
    }
  } else {
    keyPair = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding:  { type: 'spki',  format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    console.log('[keys] generated ephemeral key pair  kid=%s  (set PRIVATE_KEY_PEM to persist)', KEY_ID);
  }
};

const getKeyPair = () => {
  if (!keyPair) throw new Error('Keys not initialised — call initKeys() first');
  return keyPair;
};

// Returns the public key as a JWK object for the JWKS endpoint
const getPublicJwk = () => {
  const { publicKey } = getKeyPair();
  const keyObject = crypto.createPublicKey(publicKey);
  const jwk = keyObject.export({ format: 'jwk' });
  return {
    kty: jwk.kty,
    use: 'sig',
    kid: KEY_ID,
    alg: 'RS256',
    n: jwk.n,
    e: jwk.e,
  };
};

module.exports = { initKeys, getKeyPair, getPublicJwk, KEY_ID };
