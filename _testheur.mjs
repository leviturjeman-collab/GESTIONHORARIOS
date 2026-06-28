import XLSX from "xlsx";
import fs from "fs";

const file = ["C:\\Users\\Leviç\\Downloads\\HorariosFuengirolaClaude.xlsx", "C:\\Users\\Levi\\Downloads\\HorariosFuengirolaClaude.xlsx"].find(f => fs.existsSync(f));
const buf = fs.readFileSync(file);
const wb = XLSX.read(buf, { type: "buffer" });

// combina todas las hojas como hace analizarArchivo
const filas = [];
for (const nombre of wb.SheetNames) {
  const ws = wb.Sheets[nombre];
  const f = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, blankrows: false, defval: "" });
  if (wb.SheetNames.length > 1) filas.push([`### HOJA: ${nombre}`]);
  for (const r of f) {
    const fila = r.map(c => c == null ? "" : String(c));
    while (fila.length && fila[fila.length - 1] === "") fila.pop();
    filas.push(fila);
  }
}

// ---- réplica de la lógica del heurístico ----
const normaliza = s => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
function rolDeSeccion(t) { const n = normaliza(t); if (!n) return null;
  if (n.includes("ayud") && n.includes("cocina")) return "ayudante_cocina";
  if (n.includes("sala") || n.includes("camarer")) return "camarero";
  if (n.includes("cocina")) return "cocinero";
  if (n.includes("repartid") || n.includes("delivery")) return "repartidor";
  if (n.includes("limpieza")) return "limpieza";
  if (n.includes("barra")) return "barra";
  if (n.includes("prepar") || n.includes("envio") || n.includes("envío")) return "office";
  return null; }
const NO = new Set(["total","totales","final","trabajadores","trabajador","fecha","fechas","horas","contrato","observaciones","baja","bajas","vacaciones","vacas","nocturnidad","festivos","preparacion","preparación","cocina","sala","envios","envíos","peticiones","enviada","importante"]);
function colHoras(f) { for (let i=0;i<f.length;i++){const n=normaliza(f[i]); if(n.includes("horas contrato")||n.includes("horas contrad")||n.includes("horas contrat")||n.includes("contratad")) return i;} return -1; }
function clave(nom){ const n=normaliza(nom).replace(/[*().,]/g," ").replace(/\s+/g," ").trim(); const t=n.split(" ").filter(x=>x.length>1); return t.length?t.join(" "):n; }
const titulo = s => s.toLowerCase().replace(/(^|\s|\/)([a-záéíóúñ])/g,(_,a,c)=>a+c.toUpperCase()).trim();

const porClave = new Map();
let seccion=null, cH=-1, dentro=false;
for (const fr of filas) {
  const f=(fr||[]).map(c=>String(c??"")); const nv=f.filter(c=>c.trim()!=="");
  const idx=colHoras(f); if(idx>=0){cH=idx;dentro=true;continue;}
  if(nv.length===1){const r=rolDeSeccion(nv[0]); if(r)seccion=r; continue;}
  if(!dentro||cH<0) continue;
  const n0=(f[0]||"").trim(); if(!n0) continue;
  const nn=normaliza(n0); if(NO.has(nn)||nn.startsWith("semana")||nn.includes("trabajador")) continue;
  const h=Number(String(f[cH]??"").replace(",",".")); if(!Number.isFinite(h)||h<=0||h>80) continue;
  for(const nom of n0.split("/").map(s=>s.trim()).filter(Boolean)){
    const k=clave(nom); if(!k||porClave.has(k)) continue;
    porClave.set(k,{nombre:titulo(nom),horas:h,tipo:h>=35?"COMPLETO":"PARCIAL",rol:seccion??"?"});
  }
}
const emp=[...porClave.values()];
console.log(`EMPLEADOS EXTRAÍDOS: ${emp.length}\n`);
for(const e of emp) console.log(`  ${e.nombre.padEnd(20)} | ${String(e.horas).padStart(3)}h ${e.tipo.padEnd(8)} | ${e.rol}`);
const roles={}; for(const e of emp) roles[e.rol]=(roles[e.rol]||0)+1;
console.log("\nPOR ROL:", JSON.stringify(roles));
