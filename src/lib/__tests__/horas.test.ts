import { describe, it, expect } from "vitest";
import { minutosDeHora, duracionHoras, horasTurno } from "@/lib/utils";

describe("minutosDeHora", () => {
  it("convierte HH:mm a minutos", () => {
    expect(minutosDeHora("00:00")).toBe(0);
    expect(minutosDeHora("08:30")).toBe(510);
    expect(minutosDeHora("23:59")).toBe(1439);
  });
});

describe("duracionHoras", () => {
  it("calcula tramos normales", () => {
    expect(duracionHoras("13:00", "17:00")).toBe(4);
    expect(duracionHoras("09:15", "09:45")).toBe(0.5);
  });
  it("admite turnos que cruzan medianoche", () => {
    expect(duracionHoras("22:00", "02:00")).toBe(4);
  });
});

describe("horasTurno", () => {
  it("suma tramo único menos descanso", () => {
    expect(horasTurno({ horaInicio: "10:00", horaFin: "18:00", descansoMin: 30 })).toBe(7.5);
  });
  it("suma turno partido (dos tramos)", () => {
    expect(
      horasTurno({
        horaInicio: "13:00",
        horaFin: "16:30",
        horaInicio2: "20:00",
        horaFin2: "23:30",
        descansoMin: 0,
      })
    ).toBe(7);
  });
});
