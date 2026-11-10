const pool = require('../config/db');

const UMBRAL_AMARILLO = 70;
const UMBRAL_ROJO = 90;

const redondear = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

// Devuelve { mes, desde, hasta } o null si el formato es inválido
function rangoMes(mes) {
  const hoy = new Date();
  const base = mes || `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(base)) return null;
  const [a, m] = base.split('-').map(Number);
  const siguiente = m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, '0')}`;
  return { mes: base, desde: `${base}-01`, hasta: `${siguiente}-01` };
}

function calcularSemaforo(balance, gastado) {
  const asignado = balance + gastado;
  if (asignado <= 0) return { uso: 0, semaforo: 'verde' };
  const uso = redondear((gastado / asignado) * 100, 1);
  const semaforo = uso >= UMBRAL_ROJO ? 'rojo' : uso >= UMBRAL_AMARILLO ? 'amarillo' : 'verde';
  return { uso, semaforo };
}

exports.resumen = async (req, res) => {
  const rango = rangoMes(req.query.mes);
  if (!rango) return res.status(400).json({ error: 'El mes debe tener formato AAAA-MM' });

  const idUsuario = req.usuario.id;

  const [[cuentas]] = await pool.query(
    'SELECT COALESCE(SUM(saldo), 0) AS saldo_total FROM cuentas WHERE id_usuario = ?',
    [idUsuario]
  );

  const [movimientos] = await pool.query(
    `SELECT tipo, COALESCE(SUM(monto), 0) AS total
     FROM transacciones
     WHERE id_usuario = ? AND fecha >= ? AND fecha < ?
     GROUP BY tipo`,
    [idUsuario, rango.desde, rango.hasta]
  );
  const ingresos = movimientos.find((m) => m.tipo === 'Ingreso')?.total || 0;
  const gastos = movimientos.find((m) => m.tipo === 'Gasto')?.total || 0;

  const [porCategoria] = await pool.query(
    `SELECT c.id_categoria, c.nombre, c.icono, SUM(t.monto) AS total
     FROM transacciones t
     JOIN categorias c ON c.id_categoria = t.id_categoria
     WHERE t.id_usuario = ? AND t.tipo = 'Gasto' AND t.fecha >= ? AND t.fecha < ?
     GROUP BY c.id_categoria, c.nombre, c.icono
     ORDER BY total DESC`,
    [idUsuario, rango.desde, rango.hasta]
  );
  const gastosPorCategoria = porCategoria.map((c) => ({
    ...c,
    porcentaje: gastos > 0 ? redondear((c.total / gastos) * 100, 1) : 0
  }));

  // Los sobres se calculan con todo su historial, no solo el mes
  const [filasSobres] = await pool.query(
    `SELECT s.id_sobre, s.nombre, s.monto_objetivo, s.balance_actual, s.fecha_limite,
            s.estado, s.color_etiqueta,
            ROUND(s.balance_actual / s.monto_objetivo * 100, 1) AS progreso,
            COALESCE(SUM(CASE WHEN t.tipo = 'Gasto' THEN t.monto END), 0) AS gastado
     FROM sobres s
     LEFT JOIN transacciones t ON t.id_sobre = s.id_sobre
     WHERE s.id_usuario = ?
     GROUP BY s.id_sobre
     ORDER BY s.nombre`,
    [idUsuario]
  );
  const sobres = filasSobres.map((s) => ({
    ...s,
    ...calcularSemaforo(s.balance_actual, s.gastado)
  }));

  res.json({
    mes: rango.mes,
    resumen: {
      saldo_total: cuentas.saldo_total,
      ingresos,
      gastos,
      balance_mes: redondear(ingresos - gastos),
      ahorrado_en_sobres: redondear(sobres.reduce((suma, s) => suma + s.balance_actual, 0))
    },
    gastos_por_categoria: gastosPorCategoria,
    sobres,
    alertas: sobres.filter((s) => s.semaforo !== 'verde')
  });
};