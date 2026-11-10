const router = require('express').Router();
const c = require('../controllers/admin.controller');
const { verificarToken, soloAdmin } = require('../middlewares/auth');

router.use(verificarToken, soloAdmin);

router.get('/estadisticas', c.estadisticas);

router.get('/usuarios', c.listarUsuarios);
router.patch('/usuarios/:id/estado', c.cambiarEstado);
router.delete('/usuarios/:id', c.eliminarUsuario);

router.get('/categorias', c.listarCategorias);
router.post('/categorias', c.crearCategoria);
router.put('/categorias/:id', c.actualizarCategoria);
router.delete('/categorias/:id', c.eliminarCategoria);

module.exports = router;