const express = require('express');
const router = express.Router();
const oauthController = require('../controllers/oauthController');

router.get('/authorize', oauthController.authorize);
router.post('/authz-direct', oauthController.authzDirect);
router.post('/token', oauthController.token);
router.post('/introspect', oauthController.introspect);
router.post('/revoke', oauthController.revoke);

module.exports = router;
