import { prisma } from './src/lib/prisma';
async function main() {
  const ubicaciones = await prisma.ubicacion.findMany();
  for (const u of ubicaciones) {
    const ajustes = JSON.parse(u.ajustes || "{}");
    console.log(`[${u.nombre}] num preguntas:`, ajustes.preguntasOnboarding?.length);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
