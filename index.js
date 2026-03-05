require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initKeys, getPublicJwk } = require('./services/keyService');
const oauthRoutes = require('./routes/oauth');
const adminRoutes = require('./routes/admin');

initKeys();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/oauth', oauthRoutes);
app.use('/admin', adminRoutes);
app.use(express.static(path.join(__dirname, 'public')));

app.get('/.well-known/jwks.json', (req, res) => {
  res.json({ keys: [getPublicJwk()] });
});

app.get('/.well-known/openid-configuration', (req, res) => {
  const base = process.env.ISSUER_URL;
  res.json({
    issuer: base,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/oauth/token`,
    introspection_endpoint: `${base}/oauth/introspect`,
    revocation_endpoint: `${base}/oauth/revoke`,
    jwks_uri: `${base}/.well-known/jwks.json`,
    scopes_supported: ['openid'],
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(process.env.PORT, () => {
  console.log(`Server listening on port ${process.env.PORT}`);
});
