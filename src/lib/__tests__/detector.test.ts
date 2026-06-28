import { describe, it, expect } from "vitest";
import { detectarProblemas } from "@/lib/detector";

const dias = Array.from({ length: 7 }, (_, i) => {
  const d = new Date(2026, 5, 22 + i); // semana del 22 jun 2026 (lunes)
  d.setHours(0, 0, 0, 0);
  return d;
});

describe("detectarProblemas", () => {
  it("detecta solape de turnos el mismo día", () => {
    const problemas = detectarProblemas({
      turnos: [
        { id: "1", empleadoId: "e1", dia: dias[0], horaInicio: "10:00", horaFin: "16:00", rol: "camarero" },
        { id: "2", empleadoId: "e1", dia: dias[0], horaInicio: "14:00", horaFin: "20:00", rol: "camarero" },
      ],
      empleados: [{ id: "e1", nombre: "Ana", horasContrato: 40 }],
      reglas: [],
      dias,
      ausencias: [],
    });
    expect(problemas.some((p) => p.tipo === "SOLAPE")).toBe(true);
  });

  it("detecta conflicto con una ausencia aprobada", () => {
    const problemas = detectarProblemas({
      turnos: [
        { id: "1", empleadoId: "e1", dia: dias[2], horaInicio: "10:00", horaFin: "16:00", rol: "camarero" },
      ],
      empleados: [{ id: "e1", nombre: "Ana", horasContrato: 40 }],
      reglas: [],
      dias,
      ausencias: [{ empleadoId: "e1", fechaInicio: dias[1], fechaFin: dias[3] }],
    });
    expect(problemas.some((p) => p.tipo === "AUSENCIA")).toBe(true);
  });

  it("detecta hueco de cobertura mínima", () => {
    const problemas = detectarProblemas({
      turnos: [],
      empleados: [{ id: "e1", nombre: "Ana", horasContrato: 40 }],
      reglas: [{ rol: "camarero", diaSemana: null, franjaInicio: "13:00", franjaFin: "16:00", minPersonas: 2 }],
      dias,
      ausencias: [],
    });
    expect(problemas.some((p) => p.tipo === "HUECO")).toBe(true);
  });
});
