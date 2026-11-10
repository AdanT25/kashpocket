SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS kashpocket
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE kashpocket;

CREATE TABLE IF NOT EXISTS usuarios (
  id_usuario INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  correo VARCHAR(120) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  rol ENUM('cliente','admin') NOT NULL DEFAULT 'cliente',
  moneda VARCHAR(5) NOT NULL DEFAULT 'MXN',
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS cuentas (
  id_cuenta INT AUTO_INCREMENT PRIMARY KEY,
  id_usuario INT NOT NULL,
  nombre VARCHAR(60) NOT NULL,
  saldo DECIMAL(12,2) NOT NULL DEFAULT 0,
  FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  CHECK (saldo >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS categorias (
  id_categoria INT AUTO_INCREMENT PRIMARY KEY,
  id_usuario INT NULL,            -- NULL = categoría predeterminada del sistema
  nombre VARCHAR(60) NOT NULL,
  tipo ENUM('Ingreso','Gasto') NOT NULL,
  icono VARCHAR(40),
  FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sobres (
  id_sobre INT AUTO_INCREMENT PRIMARY KEY,
  id_usuario INT NOT NULL,
  nombre VARCHAR(60) NOT NULL,
  monto_objetivo DECIMAL(12,2) NOT NULL,
  balance_actual DECIMAL(12,2) NOT NULL DEFAULT 0,
  fecha_limite DATE NULL,
  estado ENUM('Activo','Completado') NOT NULL DEFAULT 'Activo',
  color_etiqueta VARCHAR(7),
  FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  CHECK (balance_actual >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS transacciones (
  id_transaccion INT AUTO_INCREMENT PRIMARY KEY,
  id_usuario INT NOT NULL,
  id_cuenta INT NOT NULL,
  id_categoria INT NOT NULL,
  id_sobre INT NULL,
  tipo ENUM('Ingreso','Gasto') NOT NULL,
  monto DECIMAL(12,2) NOT NULL CHECK (monto > 0),
  fecha DATE NOT NULL,
  descripcion VARCHAR(255),
  FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  FOREIGN KEY (id_cuenta) REFERENCES cuentas(id_cuenta),
  FOREIGN KEY (id_categoria) REFERENCES categorias(id_categoria),
  FOREIGN KEY (id_sobre) REFERENCES sobres(id_sobre) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Categorías predeterminadas del sistema
INSERT INTO categorias (id_usuario, nombre, tipo, icono) VALUES
(NULL, 'Sueldo',          'Ingreso', 'briefcase'),
(NULL, 'Ventas',          'Ingreso', 'tag'),
(NULL, 'Regalos',         'Ingreso', 'gift'),
(NULL, 'Otros ingresos',  'Ingreso', 'plus'),
(NULL, 'Comida',          'Gasto',   'utensils'),
(NULL, 'Transporte',      'Gasto',   'bus'),
(NULL, 'Vivienda',        'Gasto',   'home'),
(NULL, 'Servicios',       'Gasto',   'bolt'),
(NULL, 'Salud',           'Gasto',   'heart'),
(NULL, 'Educación',       'Gasto',   'book'),
(NULL, 'Entretenimiento', 'Gasto',   'film'),
(NULL, 'Ropa',            'Gasto',   'shirt'),
(NULL, 'Otros gastos',    'Gasto',   'ellipsis');
