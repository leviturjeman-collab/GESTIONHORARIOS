import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const paco = await prisma.empleado.findFirst({ where: { email: "PACOPACO@GMAIL.COM" } });
  console.log("Paco exact case:", !!paco);
  const pacoLower = await prisma.empleado.findFirst({ where: { email: "pacopaco@gmail.com" } });
  console.log("Paco lower case:", !!pacoLower);
}
main().finally(() => prisma.$disconnect());
