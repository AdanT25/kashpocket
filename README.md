# KashPocket

Sistema web de gestión de finanzas personales y ahorro en sobres.

**Autor:** Braulio Adan Torres Enriquez (22490366)
**Materia:** Programación Web

## Descripción

KashPocket permite registrar ingresos y gastos, administrar cuentas (billeteras) y separar el dinero en **sobres virtuales** con una meta de ahorro. Un gasto asociado a un sobre descuenta automáticamente su balance y el de la cuenta, y el sistema impide saldos negativos. El resumen muestra estadísticas del mes, un gráfico de gastos por categoría y alertas tipo semáforo.

## Funcionalidades

- **Usuarios:** registro, inicio de sesión con JWT y datos privados por usuario.
- **Cuentas:** crear, consultar, renombrar y eliminar. El saldo solo cambia con movimientos.
- **Categorías:** predeterminadas del sistema más categorías propias de cada usuario.
- **Sobres:** meta, fecha límite, color y estado (`Activo` / `Completado`). Pasa a `Completado` solo al alcanzar la meta.
- **Movimientos:** CRUD de ingresos y gastos, con filtros y reversión automática de saldos al editar o borrar.
- **Resumen (dashboard):** saldo total, ingresos, gastos y balance del mes, gráfico circular por categoría y progreso de sobres.
- **Semáforo:** verde (uso menor a 70%), amarillo (70% a 89%) y rojo (90% o más) del presupuesto asignado a cada sobre.
- **Administración:** estadísticas globales, suspender, reactivar y eliminar usuarios, y gestionar las categorías del sistema.

## Tecnologías

- Node.js 18 o superior y Express 5
- MySQL 8 (en Docker) con `mysql2`
- `bcrypt` (contraseñas), `jsonwebtoken` (sesiones), `dotenv`, `cors`
- Interfaz en HTML, CSS y JavaScript puro, servida por el mismo Express

## Estructura

```
KashPocket/
├── backend/
│   ├── public/
│   │   └── index.html          Interfaz web
│   ├── src/
│   │   ├── config/db.js        Conexión a MySQL
│   │   ├── controllers/        Lógica de cada módulo
│   │   ├── middlewares/auth.js Autenticación y rol de administrador
│   │   ├── routes/             Rutas de la API
│   │   └── app.js              Servidor
│   ├── .env.example
│   └── package.json
├── database/
│   └── database.sql            Esquema y categorías iniciales
├── docker-compose.yml          MySQL en Docker
└── README.md
```

## Requisitos

- [Node.js](https://nodejs.org) 18 o superior
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) abierto y en ejecución

## Instalación

Los comandos son para PowerShell, ejecutados desde la carpeta `KashPocket`.

**1. Levantar la base de datos**

```powershell
docker compose up -d
```

La primera vez descarga MySQL y ejecuta `database/database.sql`, que crea las tablas y las categorías iniciales. Espera unos 20 segundos y verifica:

```powershell
docker exec -it kashpocket-db mysql -uroot -proot kashpocket -e "SHOW TABLES;"
```

Deben aparecer `categorias`, `cuentas`, `sobres`, `transacciones` y `usuarios`.

**2. Configurar el backend**

```powershell
cd backend
Copy-Item .env.example .env
npm install
```

Abre `.env` y cambia `JWT_SECRET` por una frase larga y propia.

**3. Iniciar el servidor**

```powershell
npm start
```

(`npm run dev` lo reinicia solo al guardar cambios.) Debe mostrar `Servidor KashPocket en http://localhost:3000`.

**4. Usar la aplicación**

Abre <http://localhost:3000>, crea una cuenta y entra. Para comprobar que la API y la base de datos están conectadas: <http://localhost:3000/api/health>.

## Crear un administrador

Los registros siempre nacen como `cliente`. Regístrate desde la aplicación y promueve ese correo:

```powershell
docker exec -it kashpocket-db mysql -uroot -proot kashpocket -e "UPDATE usuarios SET rol = 'admin' WHERE correo = 'tu@correo.com';"
```

Al volver a iniciar sesión aparece la pestaña **Administración**.

## Reglas de negocio

- Un **ingreso** suma a la cuenta; un **gasto** resta. Si el movimiento tiene sobre, el sobre sube o baja igual.
- Si una cuenta o un sobre quedara en negativo, el movimiento se rechaza (HTTP 409). Todo se aplica dentro de una transacción SQL: se completa entero o no se aplica nada.
- La categoría debe coincidir con el tipo del movimiento (ingreso o gasto).
- Editar o borrar un movimiento revierte su efecto anterior en cuentas y sobres.
- Un sobre es `Completado` cuando `balance_actual >= monto_objetivo`; si el balance baja de la meta, vuelve a `Activo`.
- **Semáforo:** uso = gastado ÷ (balance actual + gastado). Verde por debajo de 70%, amarillo de 70% a 89%, rojo desde 90%.
- Un usuario suspendido pierde el acceso de inmediato, aunque conserve un token vigente.
- Cada usuario solo accede a sus propios datos.

## Base de datos

| Tabla | Contenido |
|---|---|
| `usuarios` | Datos de acceso, rol (`cliente` / `admin`), moneda y estado activo |
| `cuentas` | Billeteras del usuario con su saldo |
| `categorias` | Del sistema (`id_usuario` nulo) y propias de cada usuario |
| `sobres` | Meta, balance, fecha límite, estado y color |
| `transacciones` | Ingresos y gastos, ligados a cuenta, categoría y sobre opcional |

## API

Todas las rutas, salvo registro, login y health, requieren el encabezado `Authorization: Bearer <token>`.

| Módulo | Método y ruta |
|---|---|
| Estado | `GET /api/health` |
| Autenticación | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me` |
| Cuentas | `GET /api/cuentas`, `POST /api/cuentas`, `PUT /api/cuentas/:id`, `DELETE /api/cuentas/:id` |
| Categorías | `GET /api/categorias`, `POST /api/categorias`, `PUT /api/categorias/:id`, `DELETE /api/categorias/:id` |
| Sobres | `GET /api/sobres`, `GET /api/sobres/:id`, `POST /api/sobres`, `PUT /api/sobres/:id`, `DELETE /api/sobres/:id` |
| Transacciones | `GET /api/transacciones` (filtros: `tipo`, `id_cuenta`, `id_categoria`, `id_sobre`, `desde`, `hasta`), `POST`, `PUT /:id`, `DELETE /:id` |
| Resumen | `GET /api/dashboard?mes=AAAA-MM` (sin `mes`, usa el actual) |
| Administración | `GET /api/admin/estadisticas`, `GET /api/admin/usuarios`, `PATCH /api/admin/usuarios/:id/estado`, `DELETE /api/admin/usuarios/:id`, `GET/POST /api/admin/categorias`, `PUT/DELETE /api/admin/categorias/:id` |

Ejemplo (PowerShell):

```powershell
$r = Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/auth/login -ContentType 'application/json' -Body '{"correo":"tu@correo.com","password":"tu_contraseña"}'
Invoke-RestMethod -Uri http://localhost:3000/api/dashboard -Headers @{ Authorization = "Bearer $($r.token)" }
```

## Notas

- Las credenciales de `docker-compose.yml` y `.env.example` son solo para desarrollo local.
- MySQL se expone en el puerto **3308** para no chocar con otros contenedores MySQL en el 3306 o 3307.
- Para reiniciar la base de datos desde cero (borra todos los datos): `docker compose down -v` y luego `docker compose up -d`.
