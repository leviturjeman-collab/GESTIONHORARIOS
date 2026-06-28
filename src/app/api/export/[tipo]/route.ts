import { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getSesion, resolverAmbito } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { esResponsable } from "@/lib/rbac";
import { horasTurno } from "@/lib/utils";
import { semanaDesdeParam, horaTexto } from "@/lib/fechas";
import { etiquetaContrato } from "@/lib/enums";

/** Genera un PDF con el resumen de horas del mes (para la gestoría). */
async function pdfHoras(
  datos: { nombre: string; ubicacion: string; contrato: string; horasContrato: number; horasMes: number }[],
  mes: string
): Promise<Response> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontB = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([595, 842]);
  const { height } = page.getSize();
  const ink = rgb(0.12, 0.16, 0.23);
  let y = height - 50;
  const txt = (s: string, x: number, size = 10, bold = false) =>
    page.drawText(s, { x, y, size, font: bold ? fontB : font, color: ink });

  txt("Resumen de horas - " + mes, 50, 16, true);
  y -= 16;
  txt("Gestion Horarios - para la gestoria", 50, 9);
  y -= 28;
  txt("Empleado", 50, 9, true);
  txt("Contrato", 240, 9, true);
  txt("h/sem", 430, 9, true);
  txt("Horas mes", 490, 9, true);
  y -= 6;
  page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 0.5, color: ink });
  y -= 16;

  for (const d of datos) {
    if (y < 60) {
      page = pdf.addPage([595, 842]);
      y = height - 50;
    }
    txt(d.nombre, 50);
    txt(d.contrato, 240, 8);
    txt(String(d.horasContrato), 430);
    txt(String(d.horasMes), 490);
    y -= 16;
  }

  const bytes = await pdf.save();
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="horas-${mes}.pdf"`,
    },
  });
}

function excel(nombreHoja: string, filas: any[], filename: string): Response {
  const ws = XLSX.utils.json_to_sheet(filas);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, nombreHoja);
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new Response(buf, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export async function GET(req: NextRequest, { params }: { params: { tipo: string } }) {
  const u = await getSesion();
  if (!u || !esResponsable(u)) return new Response("No autorizado", { status: 401 });

  const sp = req.nextUrl.searchParams;
  const ambito = await resolverAmbito(u, sp.get("ubicacion"));

  // ── Resumen de horas del mes (gestoría) ──
  if (params.tipo === "horas") {
    const ahora = new Date();
    const ini = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const fin = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1);
    const empleados = await prisma.empleado.findMany({
      where: { ubicacionId: { in: ambito }, estado: "ACTIVO" },
      include: {
        contrato: true,
        ubicacion: { select: { nombre: true } },
        turnos: { where: { dia: { gte: ini, lt: fin } } },
      },
      orderBy: { nombre: "asc" },
    });
    const mes = `${ahora.getFullYear()}-${ahora.getMonth() + 1}`;
    const datos = empleados.map((e) => ({
      nombre: `${e.nombre} ${e.apellidos ?? ""}`.trim(),
      ubicacion: e.ubicacion?.nombre ?? "",
      contrato: e.contrato ? etiquetaContrato(e.contrato.tipo) : "",
      horasContrato: e.contrato?.horasSemana ?? 0,
      horasMes: Math.round(e.turnos.reduce((a, t) => a + horasTurno(t), 0) * 10) / 10,
    }));

    if (sp.get("formato") === "pdf") return await pdfHoras(datos, mes);

    const filas = datos.map((d) => ({
      Empleado: d.nombre,
      Ubicación: d.ubicacion,
      Contrato: d.contrato,
      "Horas contrato/sem": d.horasContrato,
      "Horas del mes": d.horasMes,
    }));
    return excel("Horas", filas, `horas-${mes}.xlsx`);
  }

  // ── Desglose de costes de la semana ──
  if (params.tipo === "costes") {
    const lunes = semanaDesdeParam(sp.get("semana"));
    const cuadrantes = await prisma.cuadrante.findMany({
      where: { ubicacionId: { in: ambito }, semanaInicio: lunes },
      include: { turnos: { include: { empleado: { include: { contrato: true } } } } },
    });
    const map = new Map<string, { nombre: string; horas: number; coste: number }>();
    for (const c of cuadrantes)
      for (const t of c.turnos) {
        const h = horasTurno(t);
        const cur = map.get(t.empleadoId) ?? {
          nombre: `${t.empleado?.nombre ?? ""} ${t.empleado?.apellidos ?? ""}`.trim(),
          horas: 0,
          coste: 0,
        };
        map.set(t.empleadoId, {
          nombre: cur.nombre,
          horas: cur.horas + h,
          coste: cur.coste + h * (t.empleado?.contrato?.costeHora ?? 0),
        });
      }
    const filas = [...map.values()].map((x) => ({
      Empleado: x.nombre,
      Horas: Math.round(x.horas * 10) / 10,
      "Coste (€)": Math.round(x.coste * 100) / 100,
    }));
    return excel("Costes", filas, `costes-semana.xlsx`);
  }

  // ── Registro de fichajes del mes ──
  if (params.tipo === "fichajes") {
    const ahora = new Date();
    const ini = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const fichajes = await prisma.fichaje.findMany({
      where: { empleado: { ubicacionId: { in: ambito } }, entrada: { gte: ini } },
      include: { empleado: { select: { nombre: true, apellidos: true } } },
      orderBy: { entrada: "desc" },
    });
    const filas = fichajes.map((f) => ({
      Empleado: `${f.empleado.nombre} ${f.empleado.apellidos ?? ""}`.trim(),
      Fecha: f.entrada.toLocaleDateString("es-ES"),
      Entrada: horaTexto(f.entrada),
      Salida: f.salida ? horaTexto(f.salida) : "",
      "Dentro de radio": f.dentroDeRadio == null ? "—" : f.dentroDeRadio ? "Sí" : "No",
      Incidencia: f.incidencia ?? "",
    }));
    return excel("Fichajes", filas, `fichajes-${ahora.getFullYear()}-${ahora.getMonth() + 1}.xlsx`);
  }

  // ── Cuadrante de la semana ──
  if (params.tipo === "cuadrante") {
    const semana = sp.get("semana");
    if (!semana) return new Response("Semana requerida", { status: 400 });
    const lunes = semanaDesdeParam(semana);
    
    const cuadrante = await prisma.cuadrante.findFirst({
      where: { ubicacionId: { in: ambito }, semanaInicio: lunes },
      include: { turnos: { include: { empleado: true } } },
    });
    
    if (!cuadrante) return new Response("No hay cuadrante publicado", { status: 404 });
    
    const diasSemana = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
    const map = new Map<string, any>();
    
    for (const t of cuadrante.turnos) {
      if (!t.empleado) continue;
      if (!map.has(t.empleadoId)) {
        map.set(t.empleadoId, {
          Empleado: `${t.empleado.nombre} ${t.empleado.apellidos ?? ""}`.trim(),
          Lunes: "", Martes: "", Miércoles: "", Jueves: "", Viernes: "", Sábado: "", Domingo: "",
          "Total Horas": 0
        });
      }
      
      const row = map.get(t.empleadoId);
      const diaIdx = t.dia.getDay() === 0 ? 7 : t.dia.getDay();
      const diaStr = diasSemana[diaIdx - 1];
      
      let horario = `${t.horaInicio} - ${t.horaFin}`;
      if (t.partido) horario += ` \r\n ${t.horaInicio2} - ${t.horaFin2}`;
      
      // If there are multiple shifts for the same day (rare), append them
      if (row[diaStr]) {
        row[diaStr] += ` \r\n ${horario}`;
      } else {
        row[diaStr] = horario;
      }
      
      row["Total Horas"] += horasTurno(t);
    }
    
    const filas = [...map.values()].map(r => ({
      ...r,
      "Total Horas": Math.round(r["Total Horas"] * 10) / 10
    })).sort((a, b) => a.Empleado.localeCompare(b.Empleado));
    
    return excel("Cuadrante", filas, `cuadrante-${semana}.xlsx`);
  }

  return new Response("Tipo de exportación no válido", { status: 404 });
}
