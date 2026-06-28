import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.usuario.findFirst({ where: { email: "admin@demo.es" } });
  if (!admin) {
    console.log("No se encontró el admin");
    return;
  }
  const orgId = admin.organizacionId;

  // Borrar uso anterior
  await prisma.usoIA.deleteMany();

  // Datos a insertar
  const usos = [
    { operacion: "GENERACION", modelo: "claude-opus-4-8", llamadas: 6, tokens: 28857, coste: 0.27 },
    { operacion: "ANALISIS", modelo: "claude-sonnet-4-6", llamadas: 7, tokens: 43975, coste: 0.17 },
    { operacion: "ASISTENTE", modelo: "claude-sonnet-4-6", llamadas: 6, tokens: 7238, coste: 0.05 },
    { operacion: "DETECCION", modelo: "claude-opus-4-8", llamadas: 6, tokens: 11107, coste: 0.02 },
    { operacion: "OCR", modelo: "gemini-1.5-flash", llamadas: 12, tokens: 15400, coste: 0.00 }, // Añadido OCR gratis
  ];

  for (const u of usos) {
    const tPerCall = Math.floor(u.tokens / u.llamadas);
    const cPerCall = u.coste / u.llamadas;
    
    for (let i = 0; i < u.llamadas; i++) {
      // Ajustar la última llamada para que sume exacto
      const isLast = i === u.llamadas - 1;
      const tokens = isLast ? u.tokens - (tPerCall * (u.llamadas - 1)) : tPerCall;
      
      await prisma.usoIA.create({
        data: {
          organizacionId: orgId,
          operacion: u.operacion,
          modelo: u.modelo,
          tokensEntrada: Math.floor(tokens * 0.8), // 80% entrada
          tokensSalida: Math.ceil(tokens * 0.2),   // 20% salida
          costeEur: cPerCall,
        }
      });
    }
  }

  console.log("Datos de consumo inyectados correctamente.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
