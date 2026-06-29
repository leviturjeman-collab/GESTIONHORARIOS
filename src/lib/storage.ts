/**
 * Capa de almacenamiento de archivos (documentos: contratos, nóminas, justificantes).
 *
 * En producción (Vercel) el sistema de archivos es de SOLO LECTURA, por lo que no
 * se puede escribir en disco. Si hay credenciales de Supabase, los archivos se
 * guardan en Supabase Storage (vía su API REST, sin dependencias extra). En
 * desarrollo, si no hay credenciales, cae a disco local (carpeta `uploads/`).
 *
 * La `ruta` guardada en la BD es la clave del objeto, p. ej. `<empleadoId>/<archivo>`.
 *
 * Requiere en producción:
 *  - SUPABASE_URL                (https://xxxx.supabase.co)
 *  - SUPABASE_SERVICE_ROLE_KEY   (clave service_role, SOLO servidor)
 *  - SUPABASE_BUCKET             (opcional, por defecto "documentos")
 * Crea el bucket en Supabase → Storage (privado).
 */

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const BUCKET = process.env.SUPABASE_BUCKET || "documentos";

/** ¿Está configurado el almacenamiento remoto (Supabase)? Si no, se usa disco local. */
export const STORAGE_REMOTO = Boolean(SUPABASE_URL && SERVICE_KEY);

function urlObjeto(ruta: string): string {
  const clave = ruta.split("/").map(encodeURIComponent).join("/");
  return `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${clave}`;
}

async function rutaLocal(ruta: string): Promise<string> {
  const path = await import("path");
  // Compat: los documentos antiguos guardaban la ruta con el prefijo "uploads/".
  const rel = ruta.startsWith("uploads") ? ruta : path.join("uploads", ruta);
  return path.join(process.cwd(), rel);
}

/** Guarda un archivo. `ruta` es la clave (p. ej. `empleadoId/archivo.pdf`). */
export async function guardarArchivo(
  ruta: string,
  datos: Buffer,
  contentType = "application/octet-stream"
): Promise<void> {
  if (STORAGE_REMOTO) {
    const r = await fetch(urlObjeto(ruta), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": contentType,
        "x-upsert": "true",
      },
      body: datos,
    });
    if (!r.ok) throw new Error(`Supabase Storage (subir) ${r.status}: ${await r.text()}`);
    return;
  }
  const { writeFile, mkdir } = await import("fs/promises");
  const path = await import("path");
  const full = await rutaLocal(ruta);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, datos);
}

/** Lee un archivo y devuelve sus bytes. Lanza si no existe. */
export async function leerArchivo(ruta: string): Promise<Buffer> {
  if (STORAGE_REMOTO) {
    const r = await fetch(urlObjeto(ruta), {
      headers: { Authorization: `Bearer ${SERVICE_KEY}` },
    });
    if (!r.ok) throw new Error(`Supabase Storage (leer) ${r.status}`);
    return Buffer.from(await r.arrayBuffer());
  }
  const { readFile } = await import("fs/promises");
  return readFile(await rutaLocal(ruta));
}

/** Borra varios archivos por su clave. No falla si alguno no existe. */
export async function borrarArchivos(rutas: string[]): Promise<void> {
  const limpias = rutas.filter(Boolean);
  if (limpias.length === 0) return;
  if (STORAGE_REMOTO) {
    await Promise.all(
      limpias.map((ruta) =>
        fetch(urlObjeto(ruta), {
          method: "DELETE",
          headers: { Authorization: `Bearer ${SERVICE_KEY}` },
        }).catch(() => {})
      )
    );
    return;
  }
  const { rm } = await import("fs/promises");
  await Promise.all(
    limpias.map(async (ruta) => {
      try {
        await rm(await rutaLocal(ruta), { force: true });
      } catch {
        /* sin archivo */
      }
    })
  );
}
