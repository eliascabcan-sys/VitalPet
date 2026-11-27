// =================================================================
// Archivo: src/components/AgendaVet/fechas.ts
// RESPONSABILIDAD: Funciones pequeñas de fechas que usa la agenda del
// veterinario. Todas trabajan con texto 'AAAA-MM-DD' (así viaja del backend).
// =================================================================
export const aISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const aFecha = (iso: string) => new Date(`${iso}T00:00:00`);

export const sumarDias = (iso: string, n: number) => {
  const d = aFecha(iso);
  d.setDate(d.getDate() + n);
  return aISO(d);
};

export const sumarMeses = (iso: string, n: number) => {
  const d = aFecha(iso);
  return aISO(new Date(d.getFullYear(), d.getMonth() + n, 1));
};

// Primera letra en mayúscula y el resto igual ("viernes, 23 de octubre" -> "Viernes, 23 de octubre").
export const capitalizar = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

export const hhmm = (h: string) => h.slice(0, 5);

export const esDomingo = (iso: string) => aFecha(iso).getDay() === 0;

// "viernes, 23 de octubre"
export const diaLargo = (iso: string) =>
  aFecha(iso).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });

// "vie 24 oct"
export const diaCorto = (iso: string) =>
  aFecha(iso).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' }).replace('.', '');

// "19 – 25 de octubre"  /  "26 oct – 1 nov"
export function rangoSemana(desde: string, hasta: string): string {
  const a = aFecha(desde);
  const b = aFecha(hasta);
  if (a.getMonth() === b.getMonth()) {
    return `${a.getDate()} – ${b.getDate()} de ${b.toLocaleDateString('es-CO', { month: 'long' })}`;
  }
  const corto = (d: Date) => d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }).replace('.', '');
  return `${corto(a)} – ${corto(b)}`;
}

export const nombreMes = (iso: string) => aFecha(iso).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });

// Las citas por franja se guardan con la hora de inicio de la franja:
// antes del mediodía es la mañana, después la tarde.
export const franjaDeLaCita = (fechaHora: string) => (new Date(fechaHora).getHours() < 12 ? 'Mañana' : 'Tarde');

export const horaDeLaCita = (fechaHora: string) =>
  new Date(fechaHora).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });