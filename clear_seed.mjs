import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  console.log("Limpiando seed data...");
  await prisma.notificacion.deleteMany();
  await prisma.cambioTurno.deleteMany();
  await prisma.fichaje.deleteMany();
  await prisma.documento.deleteMany();
  await prisma.ausencia.deleteMany();
  await prisma.disponibilidad.deleteMany();
  await prisma.turno.deleteMany();
  await prisma.cuadrante.deleteMany();
  await prisma.plantilla.deleteMany();
  await prisma.coberturaMinima.deleteMany();
  await prisma.contrato.deleteMany();
  await prisma.empleado.deleteMany();
  await prisma.ubicacion.deleteMany();
  
  // Borrar usuarios que NO sean el Admin que está usando
  await prisma.usuario.deleteMany({
    where: { email: { not: "admin@demo.es" } }
  });

  console.log("Seed data borrada correctamente. Conservado solo admin@demo.es y la organización base.");
}
main().catch(console.error).finally(() => prisma.$disconnect());
