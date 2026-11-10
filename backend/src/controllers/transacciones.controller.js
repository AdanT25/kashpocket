const pool = require('../config/db');

const TIPOS = ['Ingreso', 'Gasto'];
const fechaRegex = /^\d{4}-\d{2}-\d{2}$/;
const redondear = (n) => Math.round(n * 100) / 100;

// Acumula cambios de saldo. signo = 1 aplica la transacción, -1 la revierte
function acumular(deltas, t, signo) {
  const f = (t.tipo === 'Ingreso' ? 1 : -1) * signo * Number(t.monto);
  const kc = `cuenta:${t.id_cuenta}`;
  deltas[kc] = (deltas[kc] || 0) + f;
  if (t.id_sobre) {
    const ks = `sobre:${t.id_sobre}`;
    deltas[ks] = (deltas[ks] || 0) + f;
  }
}

async function aplicarDeltas(conn, deltas) {
  for (const clave of Object.keys(deltas).sort()) {
    const delta = redondear(deltas[clave]);
    if (delta === 0) continue;
    const [tipo, id] = clave.split(':');
    if (tipo === 'cuenta') {
      await conn.query('UPDATE cuentas SET saldo = saldo + ? WHERE id_cuenta = ?', [delta, id]);
        } else {
      await conn.query('UPDATE sobres SET balance_actual = balance_actual + ? WHERE id_sobre = ?', [delta, id]);
      await conn.query(
        `UPDATE sobres SET estado = IF(balance_actual >= monto_objetivo, 'Completado', 'Activo')
         WHERE id_sobre = ?`, [id]);
    }
  }
}

async function validar(conn, idUsuario, body = {}) {
  const { id_cuenta, id_categoria, id_sobre = null, tipo, monto, fecha, descripcion = null } = body;

  if (!TIPOS.includes(tipo)) return { error: 'El tipo debe ser Ingreso o Gasto' };
  if (typeof monto !== 'number' || !(monto > 0)) return { error: 'El monto debe ser un número mayor a 0' };
  if (!fecha || !fechaRegex.test(fecha) || isNaN(new Date(fecha))) {
    return { error: 'La fecha debe tener formato AAAA-MM-DD' };
  }
  if (!id_cuenta || !id_categoria) return { error: 'La cuenta y la categoría son obligatorias' };
  if (descripcion && descripcion.length > 255) return { error: 'La descripción no puede pasar de 255 caracteres' };

  const [cuenta] = await conn.query(
    'SELECT 1 FROM cuentas WHERE id_cuenta = ? AND id_usuario = ?', [id_cuenta, idUsuario]);
  if (!cuenta.length) return { error: 'Cuenta no encontrada' };

  const [cat] = await conn.query(
    'SELECT tipo FROM categorias WHERE id_categoria = ? AND (id_usuario IS NULL OR id_usuario = ?)',
    [id_categoria, idUsuario]);
  if (!cat.length) return { error: 'Categoría no encontrada' };
  if (cat[0].tipo !== tipo) return { error: `Esa categoría es de tipo ${cat[0].tipo}` };

  if (id_sobre) {
    const [sobre] = await conn.query(
      'SELECT 1 FROM sobres WHERE id_sobre = ? AND id_usuario = ?', [id_sobre, idUsuario]);
    if (!sobre.length) return { error: 'Sobre no encontrado' };
  }

  return {
    datos: { id_cuenta, id_categoria, id_sobre: id_sobre || null, tipo, monto: redondear(monto), fecha, descripcion }
  };
}

// Si el CHECK de la base rechaza el saldo, respondemos 409; cualquier otro error sube al manejador global
function saldoInsuficiente(error, res) {
  if (error.code === 'ER_CHECK_CONSTRAINT_VIOLATED') {
    res.status(409).json({ error: 'Saldo insuficiente en la cuenta o en el sobre' });
    return true;
  }
  return false;
}

exports.listar = async (req, res) => {
  const { tipo, id_cuenta, id_categoria, id_sobre, desde, hasta } = req.query;
  const condiciones = ['t.id_usuario = ?'];
  const params = [req.usuario.id];

  if (tipo) { condiciones.push('t.tipo = ?'); params.push(tipo); }
  if (id_cuenta) { condiciones.push('t.id_cuenta = ?'); params.push(id_cuenta); }
  if (id_categoria) { condiciones.push('t.id_categoria = ?'); params.push(id_categoria); }
  if (id_sobre) { condiciones.push('t.id_sobre = ?'); params.push(id_sobre); }
  if (desde) { condiciones.push('t.fecha >= ?'); params.push(desde); }
  if (hasta) { condiciones.push('t.fecha <= ?'); params.push(hasta); }

  const [rows] = await pool.query(
    `SELECT t.id_transaccion, t.tipo, t.monto, t.fecha, t.descripcion,
            t.id_cuenta, c.nombre AS cuenta,
            t.id_categoria, cat.nombre AS categoria,
            t.id_sobre, s.nombre AS sobre
     FROM transacciones t
     JOIN cuentas c ON c.id_cuenta = t.id_cuenta
     JOIN categorias cat ON cat.id_categoria = t.id_categoria
     LEFT JOIN sobres s ON s.id_sobre = t.id_sobre
     WHERE ${condiciones.join(' AND ')}
     ORDER BY t.fecha DESC, t.id_transaccion DESC`,
    params
  );
  res.json(rows);
};

exports.crear = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { error, datos } = await validar(conn, req.usuario.id, req.body);
    if (error) return res.status(400).json({ error });

    await conn.beginTransaction();
    const [r] = await conn.query(
      `INSERT INTO transacciones (id_usuario, id_cuenta, id_categoria, id_sobre, tipo, monto, fecha, descripcion)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.usuario.id, datos.id_cuenta, datos.id_categoria, datos.id_sobre, datos.tipo, datos.monto, datos.fecha, datos.descripcion]
    );
    const deltas = {};
    acumular(deltas, datos, 1);
    await aplicarDeltas(conn, deltas);
    await conn.commit();

    res.status(201).json({ id_transaccion: r.insertId, ...datos });
  } catch (error) {
    await conn.rollback();
    if (!saldoInsuficiente(error, res)) throw error;
  } finally {
    conn.release();
  }
};

exports.actualizar = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { error, datos } = await validar(conn, req.usuario.id, req.body);
    if (error) return res.status(400).json({ error });

    await conn.beginTransaction();
    const [viejas] = await conn.query(
      'SELECT * FROM transacciones WHERE id_transaccion = ? AND id_usuario = ? FOR UPDATE',
      [req.params.id, req.usuario.id]
    );
    if (!viejas.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Transacción no encontrada' });
    }

    await conn.query(
      `UPDATE transacciones SET id_cuenta = ?, id_categoria = ?, id_sobre = ?, tipo = ?, monto = ?, fecha = ?, descripcion = ?
       WHERE id_transaccion = ?`,
      [datos.id_cuenta, datos.id_categoria, datos.id_sobre, datos.tipo, datos.monto, datos.fecha, datos.descripcion, req.params.id]
    );

    // Un solo ajuste neto: revierte la anterior y aplica la nueva
    const deltas = {};
    acumular(deltas, viejas[0], -1);
    acumular(deltas, datos, 1);
    await aplicarDeltas(conn, deltas);
    await conn.commit();

    res.json({ mensaje: 'Transacción actualizada' });
  } catch (error) {
    await conn.rollback();
    if (!saldoInsuficiente(error, res)) throw error;
  } finally {
    conn.release();
  }
};

exports.eliminar = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [viejas] = await conn.query(
      'SELECT * FROM transacciones WHERE id_transaccion = ? AND id_usuario = ? FOR UPDATE',
      [req.params.id, req.usuario.id]
    );
    if (!viejas.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Transacción no encontrada' });
    }

    await conn.query('DELETE FROM transacciones WHERE id_transaccion = ?', [req.params.id]);
    const deltas = {};
    acumular(deltas, viejas[0], -1);
    await aplicarDeltas(conn, deltas);
    await conn.commit();

    res.json({ mensaje: 'Transacción eliminada' });
  } catch (error) {
    await conn.rollback();
    if (!saldoInsuficiente(error, res)) throw error;
  } finally {
    conn.release();
  }
};