const pool = require('../config/db');

const TIPOS = ['Ingreso', 'Gasto'];

// ---------- Usuarios ----------

exports.listarUsuarios = async (req, res) => {
  const [rows] = await pool.query(
    `SELECT u.id_usuario, u.nombre, u.correo, u.rol, u.activo, u.fecha_registro,
            (SELECT COUNT(*) FROM transacciones t WHERE t.id_usuario = u.id_usuario) AS transacciones
     FROM usuarios u
     ORDER BY u.fecha_registro DESC`
  );
  res.json(rows);
};

// Suspender (activo: false) o reactivar (activo: true)
exports.cambiarEstado = async (req, res) => {
  const { activo } = req.body;
  if (typeof activo !== 'boolean') {
    return res.status(400).json({ error: 'El campo activo debe ser true o false' });
  }
  if (Number(req.params.id) === req.usuario.id) {
    return res.status(400).json({ error: 'No puedes suspender tu propia cuenta' });
  }
  const [r] = await pool.query('UPDATE usuarios SET activo = ? WHERE id_usuario = ?', [activo, req.params.id]);
  if (r.affectedRows === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json({ mensaje: activo ? 'Usuario reactivado' : 'Usuario suspendido' });
};

// Elimina al usuario y todos sus datos, en el orden que respeta las llaves foráneas
exports.eliminarUsuario = async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.usuario.id) {
    return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM transacciones WHERE id_usuario = ?', [id]);
    await conn.query('DELETE FROM sobres WHERE id_usuario = ?', [id]);
    await conn.query('DELETE FROM cuentas WHERE id_usuario = ?', [id]);
    await conn.query('DELETE FROM categorias WHERE id_usuario = ?', [id]);
    const [r] = await conn.query('DELETE FROM usuarios WHERE id_usuario = ?', [id]);
    if (r.affectedRows === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    await conn.commit();
    res.json({ mensaje: 'Usuario eliminado' });
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

// ---------- Categorías del sistema ----------

exports.listarCategorias = async (req, res) => {
  const [rows] = await pool.query(
    'SELECT id_categoria, nombre, tipo, icono FROM categorias WHERE id_usuario IS NULL ORDER BY tipo, nombre'
  );
  res.json(rows);
};

exports.crearCategoria = async (req, res) => {
  const { nombre, tipo, icono = null } = req.body;
  if (!nombre || !nombre.trim() || !TIPOS.includes(tipo)) {
    return res.status(400).json({ error: 'Nombre y tipo (Ingreso o Gasto) son obligatorios' });
  }
  const [r] = await pool.query(
    'INSERT INTO categorias (id_usuario, nombre, tipo, icono) VALUES (NULL, ?, ?, ?)',
    [nombre.trim(), tipo, icono]
  );
  res.status(201).json({ id_categoria: r.insertId, nombre: nombre.trim(), tipo, icono });
};

// El tipo no se cambia: podría dejar inconsistentes las transacciones que ya la usan
exports.actualizarCategoria = async (req, res) => {
  const { nombre, icono = null } = req.body;
  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ error: 'El nombre es obligatorio' });
  }
  const [r] = await pool.query(
    'UPDATE categorias SET nombre = ?, icono = ? WHERE id_categoria = ? AND id_usuario IS NULL',
    [nombre.trim(), icono, req.params.id]
  );
  if (r.affectedRows === 0) return res.status(404).json({ error: 'Categoría del sistema no encontrada' });
  res.json({ mensaje: 'Categoría actualizada' });
};

exports.eliminarCategoria = async (req, res) => {
  try {
    const [r] = await pool.query(
      'DELETE FROM categorias WHERE id_categoria = ? AND id_usuario IS NULL',
      [req.params.id]
    );
    if (r.affectedRows === 0) return res.status(404).json({ error: 'Categoría del sistema no encontrada' });
    res.json({ mensaje: 'Categoría eliminada' });
  } catch (error) {
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({ error: 'No se puede eliminar: hay transacciones que la usan' });
    }
    throw error;
  }
};

// ---------- Estadísticas globales ----------

exports.estadisticas = async (req, res) => {
  const [[u]] = await pool.query(
    `SELECT COUNT(*) AS total, COALESCE(SUM(activo), 0) AS activos FROM usuarios`
  );
  const [[t]] = await pool.query('SELECT COUNT(*) AS total FROM transacciones');
  res.json({
    usuarios: Number(u.total),
    activos: Number(u.activos),
    suspendidos: Number(u.total) - Number(u.activos),
    transacciones: Number(t.total)
  });
};