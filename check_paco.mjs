import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const paco = await prisma.empleado.findFirst({ where: { email: "PACOPACO@GMAIL.COM" }, include: { usuario: true } });
  if (!paco) {
    console.log("No se encontró a PACOPACO");
    return;
  }
  console.log("PIN real de Paco:", paco.pinFichaje);
}
main().finally(() => prisma.$disconnect());
