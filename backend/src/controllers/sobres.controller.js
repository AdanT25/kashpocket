const pool = require('../config/db');

const colorRegex = /^#[0-9a-fA-F]{6}$/;
const fechaRegex = /^\d{4}-\d{2}-\d{2}$/;

function validar({ nombre, monto_objetivo, balance_actual = 0, fecha_limite = null, color_etiqueta = null }) {
  if (!nombre || !nombre.trim()) return 'El nombre es obligatorio';
  if (typeof monto_objetivo !== 'number' || monto_objetivo <= 0) return 'El monto objetivo debe ser un número mayor a 0';
  if (typeof balance_actual !== 'number' || balance_actual < 0) return 'El balance inicial debe ser un número mayor o igual a 0';
  if (fecha_limite && !fechaRegex.test(fecha_limite)) return 'La fecha límite debe tener formato AAAA-MM-DD';
  if (color_etiqueta && !colorRegex.test(color_etiqueta)) return 'El color debe tener formato #RRGGBB';
  return null;
}

const SELECT = `SELECT id_sobre, nombre, monto_objetivo, balance_actual, fecha_limite, estado, color_etiqueta,
  ROUND(balance_actual / monto_objetivo * 100, 1) AS progreso
  FROM sobres`;

exports.listar = async (req, res) => {
  const [rows] = await pool.query(`${SELECT} WHERE id_usuario = ? ORDER BY nombre`, [req.usuario.id]);
  res.json(rows);
};

exports.obtener = async (req, res) => {
  const [rows] = await pool.query(`${SELECT} WHERE id_sobre = ? AND id_usuario = ?`, [req.params.id, req.usuario.id]);
  if (!rows.length) return res.status(404).json({ error: 'Sobre no encontrado' });
  res.json(rows[0]);
};

exports.crear = async (req, res) => {
  const error = validar(req.body);
  if (error) return res.status(400).json({ error });

  const { nombre, monto_objetivo, balance_actual = 0, fecha_limite = null, color_etiqueta = null } = req.body;
  const estado = balance_actual >= monto_objetivo ? 'Completado' : 'Activo';

  const [r] = await pool.query(
    `INSERT INTO sobres (id_usuario, nombre, monto_objetivo, balance_actual, fecha_limite, estado, color_etiqueta)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [req.usuario.id, nombre.trim(), monto_objetivo, balance_actual, fecha_limite, estado, color_etiqueta]
  );
  res.status(201).json({ id_sobre: r.insertId, nombre: nombre.trim(), monto_objetivo, balance_actual, fecha_limite, color_etiqueta, estado });
};

// El balance y el estado NO se editan aquí: el balance cambia con transacciones
// y el estado se calcula solo (Completado al llegar a la meta)
exports.actualizar = async (req, res) => {
  const error = validar(req.body);
  if (error) return res.status(400).json({ error });

  const { nombre, monto_objetivo, fecha_limite = null, color_etiqueta = null } = req.body;

  const [r] = await pool.query(
    `UPDATE sobres
     SET nombre = ?, monto_objetivo = ?, fecha_limite = ?, color_etiqueta = ?,
         estado = IF(balance_actual >= ?, 'Completado', 'Activo')
     WHERE id_sobre = ? AND id_usuario = ?`,
    [nombre.trim(), monto_objetivo, fecha_limite, color_etiqueta, monto_objetivo, req.params.id, req.usuario.id]
  );
  if (r.affectedRows === 0) return res.status(404).json({ error: 'Sobre no encontrado' });
  res.json({ mensaje: 'Sobre actualizado' });
};

exports.eliminar = async (req, res) => {
  const [r] = await pool.query('DELETE FROM sobres WHERE id_sobre = ? AND id_usuario = ?', [req.params.id, req.usuario.id]);
  if (r.affectedRows === 0) return res.status(404).json({ error: 'Sobre no encontrado' });
  res.json({ mensaje: 'Sobre eliminado' });
};  