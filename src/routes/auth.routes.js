const express = require('express');
const router = express.Router();
const { register, login } = require('../controllers/auth.controller');
const { registerAdmin, loginAdmin } = require('../controllers/admin.contollers');

router.post('/register', register);
router.post('/login', login);

router.post('/admin/register', registerAdmin);
router.post('/admin/login', loginAdmin);

module.exports = router;
