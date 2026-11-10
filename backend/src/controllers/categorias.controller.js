const pool = require('../config/db');

const TIPOS = ['Ingreso', 'Gasto'];

// Devuelve las del sistema (id_usuario NULL) y las propias del usuario
exports.listar = async (req, res) => {
  const [rows] = await pool.query(
    `SELECT id_categoria, nombre, tipo, icono, (id_usuario IS NULL) AS es_sistema
     FROM categorias
     WHERE id_usuario IS NULL OR id_usuario = ?
     ORDER BY tipo, nombre`,
    [req.usuario.id]
  );
  res.json(rows);
};

exports.crear = async (req, res) => {
  const { nombre, tipo, icono = null } = req.body;
  if (!nombre || !nombre.trim() || !TIPOS.includes(tipo)) {
    return res.status(400).json({ error: 'Nombre y tipo (Ingreso o Gasto) son obligatorios' });
  }
  const [r] = await pool.query(
    'INSERT INTO categorias (id_usuario, nombre, tipo, icono) VALUES (?, ?, ?, ?)',
    [req.usuario.id, nombre.trim(), tipo, icono]
  );
  res.status(201).json({ id_categoria: r.insertId, nombre: nombre.trim(), tipo, icono });
};

// Solo se pueden editar las propias; las del sistema las maneja el admin
exports.actualizar = async (req, res) => {
  const { nombre, tipo, icono = null } = req.body;
  if (!nombre || !nombre.trim() || !TIPOS.includes(tipo)) {
    return res.status(400).json({ error: 'Nombre y tipo (Ingreso o Gasto) son obligatorios' });
  }
  const [r] = await pool.query(
    'UPDATE categorias SET nombre = ?, tipo = ?, icono = ? WHERE id_categoria = ? AND id_usuario = ?',
    [nombre.trim(), tipo, icono, req.params.id, req.usuario.id]
  );
  if (r.affectedRows === 0) return res.status(404).json({ error: 'Categoría no encontrada o no editable' });
  res.json({ mensaje: 'Categoría actualizada' });
};

exports.eliminar = async (req, res) => {
  try {
    const [r] = await pool.query(
      'DELETE FROM categorias WHERE id_categoria = ? AND id_usuario = ?',
      [req.params.id, req.usuario.id]
    );
    if (r.affectedRows === 0) return res.status(404).json({ error: 'Categoría no encontrada o no eliminable' });
    res.json({ mensaje: 'Categoría eliminada' });
  } catch (error) {
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({ error: 'No se puede eliminar: tiene transacciones asociadas' });
    }
    throw error;
  }
};