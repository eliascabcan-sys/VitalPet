// =================================================================
// Archivo: src/utils/fechas.ts
// RESPONSABILIDAD: Utilidades de fecha compartidas por los filtros.
// =================================================================

// Devuelve 'YYYY-MM-DD' en hora local (el mismo formato de <input type="date">),
// para poder comparar fechas con un rango "desde / hasta" como texto.
export function diaLocal(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ¿La fecha cae dentro del rango? Los extremos vacíos no limitan.
export function enRango(iso: string | null | undefined, desde: string, hasta: string): boolean {
  if (!desde && !hasta) return true;
  const dia = diaLocal(iso);
  if (!dia) return false;
  return (!desde || dia >= desde) && (!hasta || dia <= hasta);
}

// ¿La fecha está dentro de los últimos/próximos N días? dias === '' = "Ver todo".
export function dentroDeDias(iso: string | null | undefined, dias: string): boolean {
  if (!dias) return true;
  if (!iso) return false;
  // Si viene solo la fecha (YYYY-MM-DD) se toma como día local, no UTC
  const t = /^\d{4}-\d{2}-\d{2}$/.test(iso)
    ? new Date(`${iso}T00:00:00`).getTime()
    : new Date(iso).getTime();
  if (isNaN(t)) return false;

  const DIA = 24 * 60 * 60 * 1000;
  const n = Number(dias);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const desde = hoy.getTime() - n * DIA;          // hace N días
  const hasta = hoy.getTime() + (n + 1) * DIA - 1; // hasta el final de hoy + N días
  return t >= desde && t <= hasta;
}