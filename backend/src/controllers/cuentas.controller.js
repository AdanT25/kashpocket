const pool = require('../config/db');

exports.listar = async (req, res) => {
  const [rows] = await pool.query(
    'SELECT id_cuenta, nombre, saldo FROM cuentas WHERE id_usuario = ?',
    [req.usuario.id]
  );
  res.json(rows);
};

exports.crear = async (req, res) => {
  const { nombre, saldo = 0 } = req.body;
  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ error: 'El nombre es obligatorio' });
  }
  if (typeof saldo !== 'number' || saldo < 0) {
    return res.status(400).json({ error: 'El saldo inicial debe ser un número mayor o igual a 0' });
  }
  const [r] = await pool.query(
    'INSERT INTO cuentas (id_usuario, nombre, saldo) VALUES (?, ?, ?)',
    [req.usuario.id, nombre.trim(), saldo]
  );
  res.status(201).json({ id_cuenta: r.insertId, nombre: nombre.trim(), saldo });
};

// El saldo NO se edita aquí: solo cambia con transacciones
exports.actualizar = async (req, res) => {
  const { nombre } = req.body;
  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ error: 'El nombre es obligatorio' });
  }
  const [r] = await pool.query(
    'UPDATE cuentas SET nombre = ? WHERE id_cuenta = ? AND id_usuario = ?',
    [nombre.trim(), req.params.id, req.usuario.id]
  );
  if (r.affectedRows === 0) return res.status(404).json({ error: 'Cuenta no encontrada' });
  res.json({ mensaje: 'Cuenta actualizada' });
};

exports.eliminar = async (req, res) => {
  try {
    const [r] = await pool.query(
      'DELETE FROM cuentas WHERE id_cuenta = ? AND id_usuario = ?',
      [req.params.id, req.usuario.id]
    );
    if (r.affectedRows === 0) return res.status(404).json({ error: 'Cuenta no encontrada' });
    res.json({ mensaje: 'Cuenta eliminada' });
  } catch (error) {
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({ error: 'No se puede eliminar: la cuenta tiene transacciones' });
    }
    throw error;
  }
};