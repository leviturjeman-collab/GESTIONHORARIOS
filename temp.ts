import { prisma } from './src/lib/prisma';
async function main() {
  const u = await prisma.ubicacion.findFirst();
  console.log('UBICACION:', u?.ajustes);
  const org = await prisma.organizacion.findFirst();
  console.log('ORGANIZACION:', org?.ajustes);
}
main().catch(console.error).finally(() => prisma.$disconnect());
