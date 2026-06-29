"use server";

import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { requireResponsable, fallo, type Resultado } from "@/lib/guards";
import { analizarExcel, analizarTextoPlano, analizarPDFDocumento, type ResultadoAnalisis, type EmpleadoDetectado } from "@/lib/ai/onboarding";
import { IA_ACTIVA } from "@/lib/ai/anthropic";
import { generarHeuristico, type TurnoPropuesto } from "@/lib/ai/cuadrante";
import { colorDeRol } from "@/lib/enums";
import { lunesDeSemana, diasDeSemana } from "@/lib/fechas";
import { extraerTextoDeImagen, extraerTextoDePDF, type TipoImagen } from "@/lib/ai/ocr";

/** Días libres aproximados (los últimos n días de la semana) según descansos detectados. */
function diasDescansoAprox(n: number): number[] {
  const dias: number[] = [];
  for (let i = 0; i < Math.min(Math.max(n, 0), 6); i++) dias.push(6 - i);
  return dias;
}

/** Paso 2: parsea el Excel/CSV y lo analiza (IA o heurística). */
export async function analizarArchivo(formData: FormData): Promise<Resultado<ResultadoAnalisis>> {
  let u: Awaited<ReturnType<typeof requireResponsable>>;
  try {
    u = await requireResponsable();
  } catch {
    return fallo("No tienes permisos para esta acción");
  }

  try {
    const file = formData.get("archivo");

    // En Next.js server actions el File puede llegar como un Blob sin la clase File global.
    // Comprobamos que sea un objeto con arrayBuffer (Blob-like) en vez de solo instanceof File.
    const esArchivo =
      file instanceof File ||
      (file && typeof file === "object" && "arrayBuffer" in file && "size" in file);
    if (!esArchivo) return fallo("No se ha recibido ningún archivo");

    const archivoBlob = file as File;
    if (archivoBlob.size === 0) return fallo("El archivo está vacío");
    if (archivoBlob.size > 10 * 1024 * 1024) return fallo("El archivo supera los 10 MB");

    const tipo = archivoBlob.type || "";
    const nombreArchivo = ("name" in archivoBlob ? archivoBlob.name : "") as string;
    console.log(`[analizarArchivo] Archivo recibido: "${nombreArchivo}" tipo="${tipo}" tamaño=${archivoBlob.size}`);

    // ── Imagen (foto o captura de un cuadrante) → OCR local + análisis por texto ──
    const esImagen = tipo.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp|tiff?)$/i.test(nombreArchivo);
    if (esImagen) {
      if (!IA_ACTIVA)
        return fallo(
          "El análisis de imágenes necesita la clave de IA (ANTHROPIC_API_KEY). Usa un Excel/CSV o configura la clave."
        );
      try {
        console.log("[analizarArchivo] Iniciando OCR de imagen...");
        const base64 = Buffer.from(await archivoBlob.arrayBuffer()).toString("base64");
        const IMG_VALIDAS = ["image/png", "image/jpeg", "image/webp", "image/gif"];
        const mediaType = (IMG_VALIDAS.includes(tipo) ? tipo : "image/jpeg") as TipoImagen;
        const textoOCR = await extraerTextoDeImagen(base64, mediaType, {
          organizacionId: u.organizacionId,
          operacion: "OCR",
        });

        if (textoOCR.trim().length < 30) {
          return fallo(
            "No se ha podido leer texto de la imagen. " +
            "Asegúrate de que la foto sea nítida, con buena iluminación y el texto legible. " +
            "Si es un documento digital, exporta como PDF o Excel para mejor resultado."
          );
        }

        console.log(`[analizarArchivo] OCR exitoso: ${textoOCR.length} caracteres. Enviando a Claude...`);
        const analisis = await analizarTextoPlano(textoOCR, {
          organizacionId: u.organizacionId,
          operacion: "ANALISIS",
        });

        console.log(`[analizarArchivo] Claude respondió: ${analisis.empleados.length} empleados, modo=${analisis.modo}, preguntas=${analisis.preguntas?.length || 0}`);

        if (analisis.empleados.length === 0)
          return fallo(
            "Se ha leído la imagen pero no se han detectado empleados. " +
            "Prueba con una foto más nítida o sube el archivo en formato Excel/PDF."
          );
        console.log(`[analizarArchivo] ✓ Devolviendo ${analisis.empleados.length} empleados al frontend`);
        return { ok: true, data: analisis };
      } catch (e) {
        console.error("[analizarArchivo] Error procesando imagen:", e instanceof Error ? e.message : String(e));
        return fallo(
          "No se ha podido analizar la imagen. " +
          "Prueba con una foto más nítida o sube el archivo como Excel/PDF."
        );
      }
    }

    // ── PDF → Envío directo del documento a Claude 3.5 Sonnet (Nativo) ──
    if (tipo === "application/pdf" || nombreArchivo.toLowerCase().endsWith(".pdf")) {
      console.log(`[analizarArchivo] PDF detectado. Enviando a Claude 3.5 Sonnet nativo...`);
      if (!IA_ACTIVA)
        return fallo("El análisis de PDFs necesita la clave de IA (ANTHROPIC_API_KEY).");
      try {
        const buf = Buffer.from(await archivoBlob.arrayBuffer());
        const pdfBase64 = buf.toString("base64");
        
        const analisis = await analizarPDFDocumento(pdfBase64, {
          organizacionId: u.organizacionId,
          operacion: "ANALISIS",
        });

        if (analisis.empleados.length === 0)
          return fallo(
            "Se ha leído el PDF pero no se han detectado empleados. " +
            "Prueba con otro formato (Excel/CSV)."
          );
        return { ok: true, data: analisis };
      } catch (e) {
        console.error("[analizarArchivo] Error procesando PDF nativo:", e instanceof Error ? e.message : String(e));
        return fallo("No se ha podido procesar el PDF directamente con Claude. Prueba exportándolo a Excel.");
      }
    }

    // ── Excel / CSV (TODAS las hojas) ──
    const buf = Buffer.from(await archivoBlob.arrayBuffer());
    const wb = XLSX.read(buf, { type: "buffer" });
    const filas: any[][] = [];
    for (const nombre of wb.SheetNames) {
      const ws = wb.Sheets[nombre];
      if (!ws) continue;
      const f = XLSX.utils.sheet_to_json<any[]>(ws, {
        header: 1,
        raw: false,
        blankrows: false,
        defval: "",
      });
      if (f.length === 0) continue;
      if (wb.SheetNames.length > 1) filas.push([`### HOJA: ${nombre}`]);
      for (const r of f) {
        const fila = (r as any[]).map((c) => (c == null ? "" : String(c)));
        // Recorta celdas vacías finales para reducir el tamaño enviado a la IA.
        while (fila.length && fila[fila.length - 1] === "") fila.pop();
        filas.push(fila);
      }
    }
    if (filas.length === 0) return fallo("El archivo no contiene datos");

    const analisis = await analizarExcel(filas, {
      organizacionId: u.organizacionId,
      operacion: "ANALISIS",
    });
    if (analisis.empleados.length === 0)
      return fallo("No se han detectado empleados. Revisa el formato del archivo.");
    return { ok: true, data: analisis };
  } catch (e) {
    console.error("Error en analizarArchivo:", e instanceof Error ? e.message : String(e));
    return fallo("Error al procesar el archivo. Usa un .xlsx o .csv con una fila de cabeceras.");
  }
}

/** Paso 5: crea la ubicación y los empleados detectados. */
export async function confirmarOnboarding(input: {
  nombreUbicacion: string;
  direccion?: string;
  horaApertura?: string;
  horaCierre?: string;
  empleados: EmpleadoDetectado[];
  generarCuadrante?: boolean;
  empleadosConRestricciones?: string[];
  rolesTurnoPartido?: string[];
  respuestas?: Record<string, string>;
  preguntasGeneradas?: { pregunta: string; opciones: string[] }[];
  preguntas?: { pregunta: string; opciones: string[] }[];
  restriccionesDetalles?: Record<
    string,
    { tipo: "dia" | "turno" | "otro"; dia?: number; turno?: string; notas?: string }
  >;
  horarioCustom?: {
    aperturaSemana: string;
    cierreSemana: string;
    diferenteFinSemana: boolean;
    aperturaFinSemana: string;
    cierreFinSemana: string;
    diasCierre: number[];
  };
}): Promise<Resultado<{ ubicacionId: string }>> {
  const u = await requireResponsable();
  if (!input.nombreUbicacion?.trim()) return fallo("Pon un nombre a la ubicación");
  if (!input.empleados?.length) return fallo("No hay empleados que crear");

  // Guardar los ajustes en la organización (para compatibilidad)
  const org = await prisma.organizacion.findUnique({ where: { id: u.organizacionId } });
  const ajustes = JSON.parse(org?.ajustes || "{}");
  ajustes.rolesTurnoPartido = input.rolesTurnoPartido || [];
  if (input.preguntasGeneradas) {
    ajustes.preguntasOnboarding = input.preguntasGeneradas;
  }
  // No guardamos respuestasOnboarding todavía, se guardan en calibración
  ajustes.horarioCustom = input.horarioCustom || null;
  await prisma.organizacion.update({
    where: { id: u.organizacionId },
    data: { ajustes: JSON.stringify(ajustes) },
  });

  const ubicAjustes = {
    rolesTurnoPartido: input.rolesTurnoPartido || [],
    preguntasOnboarding: input.preguntasGeneradas || [],
    horarioCustom: input.horarioCustom || null,
  };

  const ubic = await prisma.ubicacion.create({
    data: {
      organizacionId: u.organizacionId,
      nombre: input.nombreUbicacion.trim(),
      direccion: input.direccion || null,
      horaApertura: input.horaApertura || "09:00",
      horaCierre: input.horaCierre || "23:00",
      ajustes: JSON.stringify(ubicAjustes),
      managers: u.rol === "MANAGER" ? { connect: { id: u.id } } : undefined,
    },
  });

  const creados = await prisma.$transaction(
    input.empleados.map((e) => {
      const [nombre, ...resto] = e.nombre.trim().split(" ");
      const det = input.restriccionesDetalles?.[e.nombre];

      let disponibilidadCreate: any = undefined;
      if (det) {
        if (det.tipo === "dia") {
          disponibilidadCreate = {
            recurrente: true,
            diaSemana: det.dia ?? 6,
            estado: "NO_DISPONIBLE",
            notas: "Descanso semanal específico (onboarding)",
          };
        } else if (det.tipo === "turno") {
          let franjaInicio = "00:00";
          let franjaFin = "23:59";
          if (det.turno === "MAÑANA") {
            franjaInicio = "08:00";
            franjaFin = "15:00";
          } else if (det.turno === "TARDE") {
            franjaInicio = "15:00";
            franjaFin = "23:00";
          } else if (det.turno === "NOCHE") {
            franjaInicio = "19:00";
            franjaFin = "23:59";
          }
          disponibilidadCreate = {
            recurrente: true,
            estado: "NO_DISPONIBLE",
            franjaInicio,
            franjaFin,
            notas: `Restricción de turno: No disponible por la ${det.turno?.toLowerCase()}`,
          };
        } else {
          disponibilidadCreate = {
            recurrente: true,
            estado: "PREFIERE_NO",
            notas: det.notas || "Restricción de horario indicada en onboarding",
          };
        }
      } else if (input.empleadosConRestricciones?.includes(e.nombre)) {
        disponibilidadCreate = {
          recurrente: true,
          diaSemana: 6,
          estado: "NO_DISPONIBLE",
          notas: "Restricción de horario indicada en onboarding",
        };
      }

      return prisma.empleado.create({
        data: {
          organizacionId: u.organizacionId,
          ubicacionId: ubic.id,
          nombre,
          apellidos: resto.join(" ") || null,
          rolFuncional: e.rol,
          color: colorDeRol(e.rol),
          estado: "ACTIVO",
          origenDato: "IMPORTADO",
          contrato: {
            create: {
              // La IA detecta completo/parcial; el responsable afina el tipo exacto luego.
              tipo: e.tipo === "PARCIAL" ? "INDEFINIDO_PARCIAL" : "INDEFINIDO_COMPLETO",
              horasSemana: e.horasSemana,
              costeHora: 0,
              diasDescanso: e.diasDescanso,
            },
          },
          disponibilidades: disponibilidadCreate
            ? {
                create: disponibilidadCreate,
              }
            : undefined,
        },
      });
    })
  );

  if (input.generarCuadrante) {
    const lunes = lunesDeSemana();
    const dias = diasDeSemana(lunes);
    
    // Si tenemos turnos extraídos de los empleados, los usamos directamente.
    // Si no, recurrimos al generador heurístico de reserva.
    const tieneTurnosImportados = input.empleados.some((e) => e.turnos && e.turnos.length > 0);
    
    const diasCierre = input.horarioCustom?.diasCierre || [];
    let turnosFinales: TurnoPropuesto[] = [];
    if (tieneTurnosImportados) {
      for (let i = 0; i < creados.length; i++) {
        const emp = creados[i];
        const empDetectado = input.empleados[i];
        if (empDetectado.turnos) {
          for (const t of empDetectado.turnos) {
            if (diasCierre.includes(t.diaIdx)) continue;
            turnosFinales.push({
              empleadoId: emp.id,
              diaIdx: t.diaIdx,
              rol: emp.rolFuncional,
              horaInicio: t.horaInicio,
              horaFin: t.horaFin,
              partido: t.partido,
              horaInicio2: t.horaInicio2,
              horaFin2: t.horaFin2,
            });
          }
        }
      }
    } else {
      const ctx = {
        horaApertura: ubic.horaApertura,
        horaCierre: ubic.horaCierre,
        reglas: [] as any[],
        empleados: creados.map((emp, i) => {
          const aprox = diasDescansoAprox(input.empleados[i].diasDescanso);
          const noDisp = Array.from(new Set([...aprox, ...diasCierre]));
          return {
            id: emp.id,
            nombre: emp.nombre,
            rol: input.empleados[i].rol,
            tipo: input.empleados[i].tipo,
            horasContrato: input.empleados[i].horasSemana,
            diasDescanso: input.empleados[i].diasDescanso,
            diasNoDisponibles: noDisp,
            restricciones: [] as string[],
          };
        }),
      };
      const { turnos } = generarHeuristico(ctx);
      turnosFinales = turnos;
    }

    const cuad = await prisma.cuadrante.create({
      data: { ubicacionId: ubic.id, semanaInicio: lunes, estado: "BORRADOR", origen: "GENERADO_IA" },
    });
    if (turnosFinales.length > 0) {
      await prisma.turno.createMany({
        data: turnosFinales
          .filter((t) => t.diaIdx >= 0 && t.diaIdx <= 6)
          .map((t) => ({
            cuadranteId: cuad.id,
            empleadoId: t.empleadoId,
            dia: dias[t.diaIdx],
            horaInicio: t.horaInicio,
            horaFin: t.horaFin,
            rol: t.rol,
            partido: !!t.partido && !!t.horaInicio2 && !!t.horaFin2,
            horaInicio2: t.horaInicio2 || null,
            horaFin2: t.horaFin2 || null,
          })),
      });
    }
  }

  revalidatePath("/ubicaciones");
  revalidatePath("/empleados");
  return { ok: true, data: { ubicacionId: ubic.id } };
}
