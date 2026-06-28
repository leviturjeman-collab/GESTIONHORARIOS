-- AlterTable
ALTER TABLE "Fichaje" ADD COLUMN "dentroDeRadio" BOOLEAN;
ALTER TABLE "Fichaje" ADD COLUMN "lat" REAL;
ALTER TABLE "Fichaje" ADD COLUMN "lng" REAL;

-- CreateTable
CREATE TABLE "UsoIA" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizacionId" TEXT NOT NULL,
    "ubicacionId" TEXT,
    "operacion" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "tokensEntrada" INTEGER NOT NULL DEFAULT 0,
    "tokensSalida" INTEGER NOT NULL DEFAULT 0,
    "costeEur" REAL NOT NULL DEFAULT 0,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Contrato" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empleadoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'INDEFINIDO_COMPLETO',
    "horasSemana" REAL NOT NULL DEFAULT 40,
    "costeHora" REAL NOT NULL DEFAULT 0,
    "admiteHorasExtra" BOOLEAN NOT NULL DEFAULT true,
    "diasDescanso" INTEGER NOT NULL DEFAULT 2,
    "fechaInicio" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaFin" DATETIME,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL,
    CONSTRAINT "Contrato_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Contrato" ("actualizadoEn", "costeHora", "creadoEn", "diasDescanso", "empleadoId", "fechaFin", "fechaInicio", "horasSemana", "id", "tipo") SELECT "actualizadoEn", "costeHora", "creadoEn", "diasDescanso", "empleadoId", "fechaFin", "fechaInicio", "horasSemana", "id", "tipo" FROM "Contrato";
DROP TABLE "Contrato";
ALTER TABLE "new_Contrato" RENAME TO "Contrato";
CREATE UNIQUE INDEX "Contrato_empleadoId_key" ON "Contrato"("empleadoId");
CREATE TABLE "new_Cuadrante" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ubicacionId" TEXT NOT NULL,
    "semanaInicio" DATETIME NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'BORRADOR',
    "origen" TEXT NOT NULL DEFAULT 'MANUAL',
    "publicadoEn" DATETIME,
    "autorId" TEXT,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL,
    CONSTRAINT "Cuadrante_ubicacionId_fkey" FOREIGN KEY ("ubicacionId") REFERENCES "Ubicacion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Cuadrante" ("actualizadoEn", "autorId", "creadoEn", "estado", "id", "publicadoEn", "semanaInicio", "ubicacionId") SELECT "actualizadoEn", "autorId", "creadoEn", "estado", "id", "publicadoEn", "semanaInicio", "ubicacionId" FROM "Cuadrante";
DROP TABLE "Cuadrante";
ALTER TABLE "new_Cuadrante" RENAME TO "Cuadrante";
CREATE INDEX "Cuadrante_ubicacionId_idx" ON "Cuadrante"("ubicacionId");
CREATE UNIQUE INDEX "Cuadrante_ubicacionId_semanaInicio_key" ON "Cuadrante"("ubicacionId", "semanaInicio");
CREATE TABLE "new_Ubicacion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizacionId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT,
    "lat" REAL,
    "lng" REAL,
    "radioFichajeMetros" INTEGER NOT NULL DEFAULT 100,
    "zonaHoraria" TEXT NOT NULL DEFAULT 'Europe/Madrid',
    "horaApertura" TEXT NOT NULL DEFAULT '08:00',
    "horaCierre" TEXT NOT NULL DEFAULT '23:00',
    "requiereAprobacionCambios" BOOLEAN NOT NULL DEFAULT true,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL,
    CONSTRAINT "Ubicacion_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "Organizacion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Ubicacion" ("activa", "actualizadoEn", "creadoEn", "direccion", "horaApertura", "horaCierre", "id", "nombre", "organizacionId", "requiereAprobacionCambios", "zonaHoraria") SELECT "activa", "actualizadoEn", "creadoEn", "direccion", "horaApertura", "horaCierre", "id", "nombre", "organizacionId", "requiereAprobacionCambios", "zonaHoraria" FROM "Ubicacion";
DROP TABLE "Ubicacion";
ALTER TABLE "new_Ubicacion" RENAME TO "Ubicacion";
CREATE INDEX "Ubicacion_organizacionId_idx" ON "Ubicacion"("organizacionId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "UsoIA_organizacionId_idx" ON "UsoIA"("organizacionId");

-- CreateIndex
CREATE INDEX "UsoIA_creadoEn_idx" ON "UsoIA"("creadoEn");
