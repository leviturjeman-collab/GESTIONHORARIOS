import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const usuarios = await prisma.usuario.findMany();
  for (const usu of usuarios) {
    if (usu.email && usu.email !== usu.email.toLowerCase()) {
      await prisma.usuario.update({
        where: { id: usu.id },
        data: { email: usu.email.toLowerCase() }
      });
      console.log("Actualizado usuario:", usu.email);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
