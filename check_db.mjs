import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const users = await prisma.usuario.findMany();
  console.log("Usuarios en DB:", users);
}
main().catch(console.error).finally(() => prisma.$disconnect());
