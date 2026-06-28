-- CreateTable
CREATE TABLE "Organizacion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "ajustes" TEXT NOT NULL DEFAULT '{}',
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Ubicacion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizacionId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT,
    "zonaHoraria" TEXT NOT NULL DEFAULT 'Europe/Madrid',
    "horaApertura" TEXT NOT NULL DEFAULT '08:00',
    "horaCierre" TEXT NOT NULL DEFAULT '23:00',
    "requiereAprobacionCambios" BOOLEAN NOT NULL DEFAULT true,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL,
    CONSTRAINT "Ubicacion_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "Organizacion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CoberturaMinima" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ubicacionId" TEXT NOT NULL,
    "rol" TEXT NOT NULL,
    "diaSemana" INTEGER,
    "franjaInicio" TEXT NOT NULL,
    "franjaFin" TEXT NOT NULL,
    "minPersonas" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "CoberturaMinima_ubicacionId_fkey" FOREIGN KEY ("ubicacionId") REFERENCES "Ubicacion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizacionId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "rol" TEXT NOT NULL DEFAULT 'EMPLEADO',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "tokenInvitacion" TEXT,
    "invitacionExpira" DATETIME,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL,
    CONSTRAINT "Usuario_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "Organizacion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Empleado" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizacionId" TEXT NOT NULL,
    "ubicacionId" TEXT,
    "usuarioId" TEXT,
    "nombre" TEXT NOT NULL,
    "apellidos" TEXT,
    "email" TEXT,
    "telefono" TEXT,
    "rolFuncional" TEXT NOT NULL DEFAULT 'camarero',
    "estado" TEXT NOT NULL DEFAULT 'ACTIVO',
    "origenDato" TEXT NOT NULL DEFAULT 'MANUAL',
    "saldoVacaciones" INTEGER NOT NULL DEFAULT 30,
    "color" TEXT,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL,
    CONSTRAINT "Empleado_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "Organizacion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Empleado_ubicacionId_fkey" FOREIGN KEY ("ubicacionId") REFERENCES "Ubicacion" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Empleado_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Contrato" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empleadoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'COMPLETO',
    "horasSemana" REAL NOT NULL DEFAULT 40,
    "costeHora" REAL NOT NULL DEFAULT 0,
    "diasDescanso" INTEGER NOT NULL DEFAULT 2,
    "fechaInicio" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaFin" DATETIME,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL,
    CONSTRAINT "Contrato_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Cuadrante" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ubicacionId" TEXT NOT NULL,
    "semanaInicio" DATETIME NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'BORRADOR',
    "publicadoEn" DATETIME,
    "autorId" TEXT,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL,
    CONSTRAINT "Cuadrante_ubicacionId_fkey" FOREIGN KEY ("ubicacionId") REFERENCES "Ubicacion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Turno" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cuadranteId" TEXT NOT NULL,
    "empleadoId" TEXT NOT NULL,
    "dia" DATETIME NOT NULL,
    "horaInicio" TEXT NOT NULL,
    "horaFin" TEXT NOT NULL,
    "rol" TEXT NOT NULL,
    "partido" BOOLEAN NOT NULL DEFAULT false,
    "horaInicio2" TEXT,
    "horaFin2" TEXT,
    "descansoMin" INTEGER NOT NULL DEFAULT 0,
    "notas" TEXT,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL,
    CONSTRAINT "Turno_cuadranteId_fkey" FOREIGN KEY ("cuadranteId") REFERENCES "Cuadrante" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Turno_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Plantilla" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ubicacionId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "datos" TEXT NOT NULL DEFAULT '[]',
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL,
    CONSTRAINT "Plantilla_ubicacionId_fkey" FOREIGN KEY ("ubicacionId") REFERENCES "Ubicacion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Disponibilidad" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empleadoId" TEXT NOT NULL,
    "recurrente" BOOLEAN NOT NULL DEFAULT true,
    "diaSemana" INTEGER,
    "fecha" DATETIME,
    "franjaInicio" TEXT NOT NULL DEFAULT '00:00',
    "franjaFin" TEXT NOT NULL DEFAULT '23:59',
    "estado" TEXT NOT NULL DEFAULT 'DISPONIBLE',
    "notas" TEXT,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL,
    CONSTRAINT "Disponibilidad_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Ausencia" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empleadoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "fechaInicio" DATETIME NOT NULL,
    "fechaFin" DATETIME NOT NULL,
    "motivo" TEXT,
    "comentarioResolucion" TEXT,
    "justificanteDocId" TEXT,
    "resueltoPorId" TEXT,
    "resueltoEn" DATETIME,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL,
    CONSTRAINT "Ausencia_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CambioTurno" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "turnoOrigenId" TEXT NOT NULL,
    "solicitanteId" TEXT NOT NULL,
    "destinoId" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'PROPUESTO',
    "mensaje" TEXT,
    "aprobadoPorId" TEXT,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL,
    CONSTRAINT "CambioTurno_turnoOrigenId_fkey" FOREIGN KEY ("turnoOrigenId") REFERENCES "Turno" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CambioTurno_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "Empleado" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CambioTurno_destinoId_fkey" FOREIGN KEY ("destinoId") REFERENCES "Empleado" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Fichaje" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empleadoId" TEXT NOT NULL,
    "turnoId" TEXT,
    "entrada" DATETIME NOT NULL,
    "salida" DATETIME,
    "descansos" TEXT NOT NULL DEFAULT '[]',
    "incidencia" TEXT,
    "corregido" BOOLEAN NOT NULL DEFAULT false,
    "datosOriginales" TEXT,
    "corregidoPorId" TEXT,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL,
    CONSTRAINT "Fichaje_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Fichaje_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "Turno" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Documento" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empleadoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "ruta" TEXT NOT NULL,
    "restringido" BOOLEAN NOT NULL DEFAULT false,
    "subidoPorId" TEXT,
    "enviadoEn" DATETIME,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL,
    CONSTRAINT "Documento_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notificacion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizacionId" TEXT NOT NULL,
    "destinatarioId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "cuerpo" TEXT NOT NULL,
    "enlace" TEXT,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "emailEnviado" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notificacion_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "Organizacion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Notificacion_destinatarioId_fkey" FOREIGN KEY ("destinatarioId") REFERENCES "Usuario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_ManagerUbicaciones" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_ManagerUbicaciones_A_fkey" FOREIGN KEY ("A") REFERENCES "Ubicacion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_ManagerUbicaciones_B_fkey" FOREIGN KEY ("B") REFERENCES "Usuario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Ubicacion_organizacionId_idx" ON "Ubicacion"("organizacionId");

-- CreateIndex
CREATE INDEX "CoberturaMinima_ubicacionId_idx" ON "CoberturaMinima"("ubicacionId");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_tokenInvitacion_key" ON "Usuario"("tokenInvitacion");

-- CreateIndex
CREATE INDEX "Usuario_organizacionId_idx" ON "Usuario"("organizacionId");

-- CreateIndex
CREATE UNIQUE INDEX "Empleado_usuarioId_key" ON "Empleado"("usuarioId");

-- CreateIndex
CREATE INDEX "Empleado_organizacionId_idx" ON "Empleado"("organizacionId");

-- CreateIndex
CREATE INDEX "Empleado_ubicacionId_idx" ON "Empleado"("ubicacionId");

-- CreateIndex
CREATE UNIQUE INDEX "Contrato_empleadoId_key" ON "Contrato"("empleadoId");

-- CreateIndex
CREATE INDEX "Cuadrante_ubicacionId_idx" ON "Cuadrante"("ubicacionId");

-- CreateIndex
CREATE UNIQUE INDEX "Cuadrante_ubicacionId_semanaInicio_key" ON "Cuadrante"("ubicacionId", "semanaInicio");

-- CreateIndex
CREATE INDEX "Turno_cuadranteId_idx" ON "Turno"("cuadranteId");

-- CreateIndex
CREATE INDEX "Turno_empleadoId_idx" ON "Turno"("empleadoId");

-- CreateIndex
CREATE INDEX "Plantilla_ubicacionId_idx" ON "Plantilla"("ubicacionId");

-- CreateIndex
CREATE INDEX "Disponibilidad_empleadoId_idx" ON "Disponibilidad"("empleadoId");

-- CreateIndex
CREATE INDEX "Ausencia_empleadoId_idx" ON "Ausencia"("empleadoId");

-- CreateIndex
CREATE INDEX "CambioTurno_turnoOrigenId_idx" ON "CambioTurno"("turnoOrigenId");

-- CreateIndex
CREATE INDEX "CambioTurno_solicitanteId_idx" ON "CambioTurno"("solicitanteId");

-- CreateIndex
CREATE INDEX "Fichaje_empleadoId_idx" ON "Fichaje"("empleadoId");

-- CreateIndex
CREATE INDEX "Documento_empleadoId_idx" ON "Documento"("empleadoId");

-- CreateIndex
CREATE INDEX "Notificacion_destinatarioId_idx" ON "Notificacion"("destinatarioId");

-- CreateIndex
CREATE UNIQUE INDEX "_ManagerUbicaciones_AB_unique" ON "_ManagerUbicaciones"("A", "B");

-- CreateIndex
CREATE INDEX "_ManagerUbicaciones_B_index" ON "_ManagerUbicaciones"("B");
