// =================================================================
// Archivo: src/services/seguimientoService.ts
// RESPONSABILIDAD: Peticiones HTTP de seguimiento post-consulta
// (preguntas pendientes del dueño y sus respuestas).
// =================================================================
import { apiFetch } from './api';

export interface SeguimientoPendiente {
  idRespuesta?: number;
  id_respuesta?: number;
  id?: number;
  idPregunta?: number;
  id_pregunta?: number;
  pregunta?: { idPregunta?: number; texto_pregunta?: string };
  texto_pregunta?: string;
  nombre_mascota?: string;
  mascota?: { nombre?: string };
  fecha_programada?: string;
  fechaProgramada?: string;
  fecha?: string;
  tipo_respuesta?: string;
  opciones?: OpcionSeguimiento[] | null;
}

export type RespuestaSeguimiento = string;

export interface OpcionSeguimiento {
  valor: string;
  etiqueta: string;
  puntos?: number;
  nivel?: string | null;
  bandera_roja?: boolean;
}

export const EVENTO_PREGUNTAS_CAMBIARON = 'vitalpet:preguntas-cambiaron';

export const seguimientoService = {
  pendientesMios: (): Promise<SeguimientoPendiente[]> => apiFetch<SeguimientoPendiente[]>('/seguimientos/mias/pendientes', { cache: 'no-store' }),

  responder: (id: number, respuesta: RespuestaSeguimiento): Promise<void> =>
    apiFetch<void>(`/seguimientos/respuestas/${id}`, {
      method: 'POST',
      body: JSON.stringify({ respuesta }),
    }).then(() => {
      window.dispatchEvent(new Event(EVENTO_PREGUNTAS_CAMBIARON));
    }),
};

export default seguimientoService;
