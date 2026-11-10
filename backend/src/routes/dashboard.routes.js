const router = require('express').Router();
const c = require('../controllers/dashboard.controller');
const { verificarToken } = require('../middlewares/auth');

router.get('/', verificarToken, c.resumen);

module.exports = router;