const jwt = require('jsonwebtoken');
const pool = require('../config/db');

exports.verificarToken = async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Token requerido' });

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }

  const [rows] = await pool.query('SELECT rol, activo FROM usuarios WHERE id_usuario = ?', [payload.id]);
  if (!rows.length) return res.status(401).json({ error: 'El usuario ya no existe' });
  if (!rows[0].activo) return res.status(403).json({ error: 'Cuenta suspendida' });

  req.usuario = { id: payload.id, rol: rows[0].rol };
  next();
};

exports.soloAdmin = (req, res, next) => {
  if (req.usuario.rol !== 'admin') {
    return res.status(403).json({ error: 'Acceso solo para administradores' });
  }
  next();
};