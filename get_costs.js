const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getCosts() {
  const usos = await prisma.usoIA.findMany();
  let totalCost = 0;
  let totalTokens = 0;
  
  const byOperation = {};
  
  for (const uso of usos) {
    totalCost += uso.costeEur;
    totalTokens += uso.tokensEntrada + uso.tokensSalida;
    
    const key = `${uso.operacion} (${uso.modelo})`;
    if (!byOperation[key]) {
      byOperation[key] = { llamadas: 0, coste: 0, tokens: 0 };
    }
    byOperation[key].llamadas += 1;
    byOperation[key].coste += uso.costeEur;
    byOperation[key].tokens += uso.tokensEntrada + uso.tokensSalida;
  }
  
  console.log(`\n=== RESUMEN DE COSTES ===`);
  console.log(`Coste Acumulado Total: €${totalCost.toFixed(3)}`);
  console.log(`Llamadas Totales: ${usos.length}`);
  console.log(`Tokens Totales: ${totalTokens.toLocaleString('es-ES')}\n`);
  
  console.table(
    Object.entries(byOperation)
      .map(([op, data]) => ({
        'Operación (Modelo)': op,
        'Llamadas': data.llamadas,
        'Tokens': data.tokens.toLocaleString('es-ES'),
        'Coste (€)': data.coste.toFixed(3)
      }))
      .sort((a, b) => parseFloat(b['Coste (€)']) - parseFloat(a['Coste (€)']))
  );
}

getCosts().finally(() => prisma.$disconnect());
