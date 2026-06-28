# Gestión Horarios

Plataforma web de **gestión de cuadrantes y personal para hostelería**, con un
asistente de **IA** que arranca el sistema a partir de un Excel y ayuda a
planificar en lenguaje natural. Inspirada en Orquest, Skello, Shiftbase y Combo.

> Interfaz en español · multi-ubicación · 3 roles (Administrador, Manager, Empleado).

---

## Puesta en marcha

Requisitos: **Node.js 20+** (probado con Node 24).

```bash
# 1. Instalar dependencias
npm install

# 2. Crear la base de datos (SQLite) y los datos de demostración
npm run db:migrate      # aplica la migración inicial
npm run db:seed         # carga 1 organización, 2 ubicaciones y 12 empleados

# 3. Arrancar en desarrollo
npm run dev
```

Abrir **http://localhost:3000**.

### Cuentas de demostración (contraseña: `demo1234`)

| Rol | Correo | Ámbito |
|---|---|---|
| Administrador | `admin@demo.es` | Todas las ubicaciones |
| Manager | `carmen@demo.es` | Restaurante La Marina |
| Manager | `antonio@demo.es` | Café Bar El Faro |
| Empleado | `alba@demo.es` | Camarera (La Marina) |
| Empleado | `hugo@demo.es` | Camarero (El Faro) |

---

## Variables de entorno

Copia `.env.example` a `.env` y rellena lo que necesites. Resumen:

| Variable | Para qué | Sin valor… |
|---|---|---|
| `DATABASE_URL` | Conexión a la BD (`file:./dev.db` en local) | obligatoria |
| `AUTH_SECRET` | Firma de sesión de Auth.js (`npx auth secret`) | obligatoria |
| `ANTHROPIC_API_KEY` | Funciones de IA (Claude) | **modo simulado** (heurística local) |
| `ANTHROPIC_MODEL` | Modelo a usar | `claude-opus-4-8` |
| `RESEND_API_KEY` | Envío de correo | correos por consola |
| `EMAIL_FROM` | Remitente de los correos | — |
| `APP_URL` | URL base para enlaces de correo | `http://localhost:3000` |

> **Sin clave de IA** la aplicación funciona igualmente: el análisis del Excel,
> la generación de cuadrantes y el asistente usan un **respaldo determinista
> local** (modo simulado), por lo que se puede desarrollar y probar sin coste.

---

## Comandos

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo (puerto 3000) |
| `npm run build` | Compila para producción (genera Prisma + Next) |
| `npm run start` | Sirve la build de producción |
| `npm run typecheck` | Comprobación de tipos (`tsc --noEmit`) |
| `npm run db:migrate` | Aplica migraciones de Prisma |
| `npm run db:seed` | Recarga los datos de demostración |
| `npm run db:reset` | Borra y recrea la BD con datos demo |
| `npm test` | Tests unitarios (Vitest) |
| `npm run test:e2e` | Tests E2E (Playwright) |

---

## Stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** + componentes accesibles (Radix UI) — sistema de diseño propio
- **Prisma ORM** sobre **SQLite** en desarrollo (esquema portable a **PostgreSQL**)
- **Auth.js (NextAuth v5)** — email/contraseña y control de acceso por rol
- **@anthropic-ai/sdk** (Claude) para las funciones de IA (clave solo en servidor)
- **SheetJS (xlsx)** para leer el Excel · **Recharts** para gráficas
- **Resend** para correo (abstracción para cambiar de proveedor) · **Zod** para validación

### Migrar a PostgreSQL

1. En `prisma/schema.prisma`, cambia `provider = "sqlite"` por `"postgresql"`.
2. Pon una `DATABASE_URL` de Postgres en `.env`.
3. `npm run db:migrate`.

Los "enums lógicos" (rol, estados, tipos) se guardan como `String` validados con
Zod (`src/lib/enums.ts`), por lo que el comportamiento es idéntico en ambos motores;
opcionalmente pueden convertirse en enums nativos de Postgres.

---

## Estructura

```
prisma/
  schema.prisma         # modelo de datos completo
  seed.ts               # datos de demostración
src/
  app/
    (app)/              # área autenticada (con sidebar + topbar)
      inicio/ ubicaciones/ cuadrantes/ vacaciones/ cambios/ fichaje/
      costes/ empleados/ nominas/ asistente/ ajustes/ notificaciones/
      mi-cuadrante/ mi-disponibilidad/ mis-vacaciones/ fichar/ mi-perfil/
      onboarding/
    login/ invitacion/  # rutas públicas
    api/auth/           # Auth.js
  components/
    ui/                 # kit de UI (button, card, table, sheet, dialog…)
    layout/             # sidebar, topbar, selectores
  features/             # lógica por dominio (server actions + componentes)
  lib/
    ai/                 # capa Anthropic + análisis/generación (con fallback)
    enums.ts rbac.ts session.ts guards.ts detector.ts metricas.ts …
```

---

## Funcionalidades (por fases)

1. **Acceso por roles** y enrutado según rol (middleware + RBAC).
2. **Ubicaciones** y **Empleados** (CRUD, invitación por correo, activar/desactivar).
3. **Insertar cuadrante actual (IA)**: subir **Excel/CSV o una foto/captura**
   (análisis por **visión**) → extrae nombres, horas, rol, descansos con nivel de
   confianza → tabla editable → preguntas → confirmar → **genera el cuadrante**.
4. **Cuadrante semanal**: rejilla empleados×días, turnos de color por rol,
   **drag & drop** para mover turnos, turno partido, cobertura por franja, horas
   vs. contrato, **plantillas recurrentes**, publicar (avisa al admin y al empleado).
5. **Generación con IA** (lenguaje natural) **no destructiva**: vista previa con
   **diff** (qué cambia), **validación con el detector antes de aplicar** y botón
   **deshacer** (restaura el cuadrante anterior). Más el **detector de problemas**
   (huecos, exceso de horas, descansos, solapes, ausencias).
6. **Disponibilidad** del empleado (por **franja horaria** y **excepciones por
   fecha**) · **Vacaciones/ausencias/bajas** (solicitud,
   aprobación con comentario, saldo anual) · **Intercambio de turnos** (aprobación
   configurable por ubicación). Las **ausencias aprobadas aparecen como
   recomendaciones** al planificar la semana y se respetan en plantillas/IA.
7. **Fichaje con geolocalización**: al fichar se pide la ubicación del navegador
   y se calcula la distancia al local (Haversine); **si estás fuera del radio
   (100 m) no se permite fichar** y se avisa al administrador del intento. Se
   registran `lat/lng` y `dentroDeRadio`. Incluye supervisión planificado vs. real
   y **modo tablet con PIN** (`/fichaje/tablet`) para fichar en un dispositivo compartido.
   **Corrección de fichajes con justificación** que conserva el dato original (auditoría).
8. **Costes laborales** (por día/empleado, ratio coste/ventas, gráficas) y
   **gestión documental**: subida de PDFs (contratos/nóminas/justificantes con acceso
   restringido) y **exportaciones a Excel y PDF** (resumen de horas para la gestoría,
   costes y registro de fichajes).
9. **Asistente IA** conversacional y **notificaciones por correo** al administrador
   (+ avisos in-app al empleado: cuadrante publicado, cambio confirmado, ausencia resuelta).
10. **Consumo de IA**: cada llamada registra tokens y coste estimado en € (entidad
    `UsoIA`), con panel de totales por operación en Ajustes y **modelo configurable**
    por operación (Haiku análisis, Sonnet/Opus generación).
11. **Tipos de contrato completos** (indefinido/temporal completo y parcial,
    fijo-discontinuo, formación, por horas, relevo) con `admiteHorasExtra`.
12. **Editor de cobertura mínima** por rol y franja, y límite de **30 días de
    vacaciones/año** validado en backend.

### Seguridad y RGPD

Acceso por rol y ubicación, trazabilidad de acciones sensibles (auditoría en
cuadrantes/fichajes/resoluciones), justificantes de baja marcados como restringidos,
y minimización de datos enviados a la IA (solo lo necesario para cada tarea).
**Derechos RGPD operativos**: exportación de todos los datos del empleado en JSON
(`/api/rgpd/[empleadoId]`) y supresión completa (ficha + cuenta + archivos), desde el
menú del empleado (solo administrador).
```
