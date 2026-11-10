const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

exports.register = async (req, res) => {
  const { nombre, correo, password } = req.body;

  if (!nombre || !correo || !password) {
    return res.status(400).json({ error: 'Nombre, correo y contraseña son obligatorios' });
  }
  if (!emailRegex.test(correo)) {
    return res.status(400).json({ error: 'Correo no válido' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
  }

  const conn = await pool.getConnection();
  try {
    const [existe] = await conn.query('SELECT id_usuario FROM usuarios WHERE correo = ?', [correo]);
    if (existe.length) {
      return res.status(409).json({ error: 'Ese correo ya está registrado' });
    }

    const hash = await bcrypt.hash(password, 10);

    await conn.beginTransaction();
    const [r] = await conn.query(
      'INSERT INTO usuarios (nombre, correo, password) VALUES (?, ?, ?)',
      [nombre, correo, hash]
    );
    // Cada usuario nuevo arranca con una cuenta (billetera) por defecto
    await conn.query('INSERT INTO cuentas (id_usuario, nombre) VALUES (?, ?)', [r.insertId, 'Efectivo']);
    await conn.commit();

    res.status(201).json({ mensaje: 'Usuario registrado', id_usuario: r.insertId });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ error: 'Error al registrar usuario' });
  } finally {
    conn.release();
  }
};

exports.login = async (req, res) => {
  const { correo, password } = req.body;

  if (!correo || !password) {
    return res.status(400).json({ error: 'Correo y contraseña son obligatorios' });
  }

  try {
    const [rows] = await pool.query('SELECT * FROM usuarios WHERE correo = ?', [correo]);
    const usuario = rows[0];

    // Mismo mensaje en ambos casos para no revelar si el correo existe
    if (!usuario || !(await bcrypt.compare(password, usuario.password))) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }
    if (!usuario.activo) {
      return res.status(403).json({ error: 'Cuenta suspendida' });
    }

    const token = jwt.sign(
      { id: usuario.id_usuario, rol: usuario.rol },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      usuario: { id: usuario.id_usuario, nombre: usuario.nombre, correo: usuario.correo, rol: usuario.rol }
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
};

exports.me = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id_usuario, nombre, correo, rol, moneda FROM usuarios WHERE id_usuario = ?',
      [req.usuario.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al consultar el perfil' });
  }
};