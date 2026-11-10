require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./config/db');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Rutas
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/cuentas', require('./routes/cuentas.routes'));
app.use('/api/categorias', require('./routes/categorias.routes'));

// Ruta de prueba: verifica que la API y la BD funcionan
app.get('/api/health', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT 1 AS ok');
    res.json({ api: 'KashPocket funcionando', db: rows[0].ok === 1 });
  } catch (error) {
    res.status(500).json({ api: 'KashPocket funcionando', db: false, error: error.message });
  }
});
// Rutas de sobres
app.use('/api/sobres', require('./routes/sobres.routes'));

// Rutas de transacciones
app.use('/api/transacciones', require('./routes/transacciones.routes'));

// Rutas del dashboard
app.use('/api/dashboard', require('./routes/dashboard.routes'));

// Rutas de administración
app.use('/api/admin', require('./routes/admin.routes'));

// Manejador de errores: siempre después de todas las rutas
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor KashPocket en http://localhost:${PORT}`);
});