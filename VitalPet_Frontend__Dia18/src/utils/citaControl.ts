// Texto de la "cita de control" que se muestra en la fórmula (pantalla e impresión).
import type { CitaControl } from '../services/historialService';

const hhmm = (h?: string | null) => (h ? h.slice(0, 5) : '');

export function textoCitaControl(c?: CitaControl | null): string {
  if (!c) return '';
  const dia = new Date(c.fechaHora).toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  // Cita por franja: no hay hora exacta, se muestra la franja del día.
  const cuando = c.franja_nombre
    ? `${dia}, franja de ${c.franja_nombre.toLowerCase()}${c.hora_inicio ? ` (${hhmm(c.hora_inicio)}–${hhmm(c.hora_fin)})` : ''}`
    : `${dia}, ${new Date(c.fechaHora).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`;
  const con = c.nombre_veterinario ? ` con ${c.nombre_veterinario}` : ' (veterinario por asignar)';
  return `${cuando}${con}${c.estado === 'pendiente' ? ' · por confirmar' : ''}`;
}
