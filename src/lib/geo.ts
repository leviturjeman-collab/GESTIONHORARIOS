/**
 * Utilidades de geolocalización para el fichaje por proximidad.
 */

/** Distancia en metros entre dos coordenadas (fórmula de Haversine). */
export function distanciaMetros(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // radio terrestre en metros
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/**
 * Evalúa si una posición está dentro del radio de fichaje de un local.
 * Si el local no tiene coordenadas configuradas, no se puede verificar y se
 * permite (dentro = null).
 */
export function dentroDelRadio(
  local: { lat: number | null; lng: number | null; radioFichajeMetros: number },
  pos: { lat?: number; lng?: number }
): { verificable: boolean; dentro: boolean; distancia: number | null } {
  if (local.lat == null || local.lng == null) {
    return { verificable: false, dentro: true, distancia: null };
  }
  if (pos.lat == null || pos.lng == null) {
    return { verificable: true, dentro: false, distancia: null };
  }
  const distancia = distanciaMetros(local.lat, local.lng, pos.lat, pos.lng);
  return { verificable: true, dentro: distancia <= local.radioFichajeMetros, distancia };
}
