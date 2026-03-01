const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

const adminAuth = (req, res, next) => {
  const secret = req.headers['x-admin-secret'];
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

router.use(adminAuth);

router.post('/clients', adminController.createClient);
router.get('/clients', adminController.listClients);
router.delete('/clients/:clientId', adminController.deleteClient);

module.exports = router;
