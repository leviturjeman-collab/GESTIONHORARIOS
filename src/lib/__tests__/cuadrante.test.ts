import { describe, it, expect } from "vitest";
import { generarHeuristico, type ContextoGeneracion } from "../ai/cuadrante";

describe("generarHeuristico", () => {
  it("asigna inicio a las 04:00 por defecto para roles de limpieza y office, y hora de apertura para otros", () => {
    const ctx: ContextoGeneracion = {
      horaApertura: "09:00",
      horaCierre: "23:00",
      reglas: [],
      empleados: [
        {
          id: "emp-1",
          nombre: "Ana Limpiadora",
          rol: "limpieza",
          tipo: "INDEFINIDO_COMPLETO",
          horasContrato: 40,
          diasDescanso: 2,
          diasNoDisponibles: [],
        },
        {
          id: "emp-2",
          nombre: "Mario Waiter",
          rol: "camarero",
          tipo: "INDEFINIDO_COMPLETO",
          horasContrato: 40,
          diasDescanso: 2,
          diasNoDisponibles: [],
        },
        {
          id: "emp-3",
          nombre: "Oscar Office",
          rol: "office",
          tipo: "INDEFINIDO_COMPLETO",
          horasContrato: 40,
          diasDescanso: 2,
          diasNoDisponibles: [],
        },
      ],
    };

    const { turnos } = generarHeuristico(ctx);

    // Ana (limpieza) y Oscar (office) deben empezar a las 04:00
    const turnosAna = turnos.filter((t) => t.empleadoId === "emp-1");
    expect(turnosAna.length).toBeGreaterThan(0);
    expect(turnosAna[0].horaInicio).toBe("04:00");

    const turnosOscar = turnos.filter((t) => t.empleadoId === "emp-3");
    expect(turnosOscar.length).toBeGreaterThan(0);
    expect(turnosOscar[0].horaInicio).toBe("04:00");

    // Mario (camarero) debe empezar a las 09:00 (horaApertura)
    const turnosMario = turnos.filter((t) => t.empleadoId === "emp-2");
    expect(turnosMario.length).toBeGreaterThan(0);
    expect(turnosMario[0].horaInicio).toBe("09:00");
  });

  it("asigna inicio segun reglas de cobertura si existen para el rol", () => {
    const ctx: ContextoGeneracion = {
      horaApertura: "09:00",
      horaCierre: "23:00",
      reglas: [
        {
          rol: "limpieza",
          franjaInicio: "06:00",
          franjaFin: "14:00",
          minPersonas: 1,
        },
      ],
      empleados: [
        {
          id: "emp-1",
          nombre: "Ana Limpiadora",
          rol: "limpieza",
          tipo: "INDEFINIDO_COMPLETO",
          horasContrato: 40,
          diasDescanso: 2,
          diasNoDisponibles: [],
        },
      ],
    };

    const { turnos } = generarHeuristico(ctx);

    // Ana (limpieza) debe empezar a las 06:00 según la regla
    const turnosAna = turnos.filter((t) => t.empleadoId === "emp-1");
    expect(turnosAna.length).toBeGreaterThan(0);
    expect(turnosAna[0].horaInicio).toBe("06:00");
  });
});
