const oauthService = require('../services/oauthService');
const authService = require('../services/authService');

const authorize = (req, res) => {
  const {
    client_id,
    redirect_uri,
    response_type,
    scope,
    state,
    code_challenge,
    code_challenge_method,
  } = req.query;

  if (!client_id || !redirect_uri || !response_type || !state || !code_challenge) {
    return res.status(400).json({ error: 'Missing required OAuth parameters' });
  }

  if (response_type !== 'code') {
    return res.status(400).json({ error: 'Only response_type=code is supported' });
  }

  if (code_challenge_method !== 'S256') {
    return res.status(400).json({ error: 'Only code_challenge_method=S256 is supported' });
  }

  const requestId = oauthService.savePendingRequest({
    client_id,
    redirect_uri,
    scope,
    state,
    code_challenge,
    code_challenge_method,
  });

  res.send(`
    <!DOCTYPE html>
    <html>
      <head><title>Authentication Required</title></head>
      <body>
        <h2>Sign In</h2>
        <form method="POST" action="/oauth/authz-direct">
          <input type="hidden" name="requestId" value="${requestId}" />
          <label>Email</label><br/>
          <input type="email" name="email" required /><br/><br/>
          <label>Password</label><br/>
          <input type="password" name="password" required /><br/><br/>
          <button type="submit">Sign In</button>
        </form>
      </body>
    </html>
  `);
};

const authzDirect = async (req, res) => {
  const { requestId, email, password } = req.body;

  const pending = oauthService.getPendingRequest(requestId);
  if (!pending) {
    return res.status(400).json({ error: 'Invalid or expired request' });
  }

  const user = await authService.verifyUser(email, password);
  if (!user) {
    return res.status(401).json({ error: 'Authentication failed' });
  }

  const code = await authService.createAuthCode({
    userId: user.id,
    clientId: pending.client_id,
    redirectUri: pending.redirect_uri,
    codeChallenge: pending.code_challenge,
    codeChallengeMethod: pending.code_challenge_method,
    scope: pending.scope,
  });

  oauthService.deletePendingRequest(requestId);

  const redirectUrl = `${pending.redirect_uri}?code=${code}&state=${pending.state}`;
  res.redirect(redirectUrl);
};

const token = async (req, res) => {
  const { grant_type, code, redirect_uri, client_id, code_verifier } = req.body;

  if (grant_type !== 'authorization_code') {
    return res.status(400).json({ error: 'Unsupported grant_type' });
  }

  if (!code || !redirect_uri || !client_id || !code_verifier) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    const accessToken = await authService.exchangeCodeForToken({
      code,
      clientId: client_id,
      redirectUri: redirect_uri,
      codeVerifier: code_verifier,
    });

    res.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 86400,
      scope: 'openid',
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const introspect = async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Missing token parameter' });
  }

  try {
    const result = await authService.introspectToken(token);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { authorize, authzDirect, token, introspect };
