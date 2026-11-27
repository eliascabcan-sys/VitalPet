// =================================================================
// Archivo: src/services/seguimientoAdminService.ts
// RESPONSABILIDAD: Configuración del seguimiento automático (plantillas
// y sus preguntas), inicio manual de un seguimiento y bandeja de alertas.
// Administrador y veterinario.
// (El lado del dueño —responder preguntas— está en seguimientoService.ts)
// Endpoints: /seguimientos/plantillas, /seguimientos/preguntas,
//            /seguimientos/ (iniciar), /seguimientos/alertas
// =================================================================
import { apiFetch } from './api';
import type { NivelTriaje } from './triajeService';

// Todos los niveles menos azul (azul = todo normal, no genera alerta)
export type NivelAlerta = Exclude<NivelTriaje, 'azul'>;

// Aviso interno: "las alertas cambiaron" (el numerito del menú se actualiza al instante)
export const EVENTO_ALERTAS_CAMBIARON = 'vitalpet:alertas-cambiaron';

export interface Plantilla {
  idPlantilla: number;
  nombre: string;
  tipo_animal: string;
  diagnostico: string;
  estado?: string | null;
}

export interface PlantillaPayload {
  nombre: string;
  tipo_animal: string;
  diagnostico: string;
}

export interface OpcionRespuesta {
  valor: string;
  etiqueta: string;
  puntos: number;
  nivel?: NivelAlerta | null;
  bandera_roja: boolean;
}

export interface Pregunta {
  idPregunta: number;
  idPlantilla: number;
  texto_pregunta: string;
  dias_desde_diagnostico: number;
  orden: number;
  nivel_alerta_si_mal: NivelAlerta;
  tipo_respuesta: string;
  opciones?: OpcionRespuesta[] | null;
}

export interface PreguntaPayload {
  texto_pregunta: string;
  dias_desde_diagnostico: number;
  orden: number;
  nivel_alerta_si_mal: NivelAlerta;
  tipo_respuesta: string;
  opciones?: OpcionRespuesta[] | null;
}

export interface Alerta {
  idAlerta: number;
  idSeguimiento: number;
  idRespuesta: number;
  nivel: NivelAlerta;
  fecha_generada: string;
  notificado_veterinario: boolean;
  notificado_dueno: boolean;
  idMascota?: number | null;
  nombre_mascota?: string | null;
  texto_pregunta?: string | null;
  nivel_original?: NivelTriaje | null;
  veces_reescalada?: number;
  fecha_nivel?: string | null;
  puntos?: number;
  bandera_roja?: boolean;
  // pendiente | vista | resuelta | sin_respuesta
  estado?: string;
}

export interface SeguimientoIniciado {
  idSeguimiento: number;
  idHistorial: number;
  idPlantilla: number;
  idMascota?: number | null;
  nombre_mascota?: string | null;
  diagnostico?: string | null;
  estado: string;
}

export const seguimientoAdminService = {
  plantillas: (): Promise<Plantilla[]> => apiFetch<Plantilla[]>('/seguimientos/plantillas'),

  crearPlantilla: (data: PlantillaPayload): Promise<Plantilla> =>
    apiFetch<Plantilla>('/seguimientos/plantillas', { method: 'POST', body: JSON.stringify(data) }),

  actualizarPlantilla: (id: number, data: Partial<PlantillaPayload> & { estado?: string }): Promise<Plantilla> =>
    apiFetch<Plantilla>(`/seguimientos/plantillas/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  desactivarPlantilla: (id: number): Promise<{ mensaje: string }> =>
    apiFetch<{ mensaje: string }>(`/seguimientos/plantillas/${id}`, { method: 'DELETE' }),

  preguntas: (idPlantilla: number): Promise<Pregunta[]> =>
    apiFetch<Pregunta[]>(`/seguimientos/plantillas/${idPlantilla}/preguntas`),

  agregarPregunta: (idPlantilla: number, data: PreguntaPayload): Promise<Pregunta> =>
    apiFetch<Pregunta>(`/seguimientos/plantillas/${idPlantilla}/preguntas`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  actualizarPregunta: (idPregunta: number, data: Partial<PreguntaPayload>): Promise<Pregunta> =>
    apiFetch<Pregunta>(`/seguimientos/preguntas/${idPregunta}`, { method: 'PUT', body: JSON.stringify(data) }),

  eliminarPregunta: (idPregunta: number): Promise<{ mensaje: string }> =>
    apiFetch<{ mensaje: string }>(`/seguimientos/preguntas/${idPregunta}`, { method: 'DELETE' }),

  alertasPendientes: (): Promise<Alerta[]> => apiFetch<Alerta[]>('/seguimientos/alertas/pendientes'),

  marcarAlertaVista: (idAlerta: number): Promise<Alerta> =>
    apiFetch<Alerta>(`/seguimientos/alertas/${idAlerta}/vista`, { method: 'PUT' }).then((alerta) => {
      window.dispatchEvent(new Event(EVENTO_ALERTAS_CAMBIARON));
      return alerta;
    }),

  // Inicia un seguimiento manualmente sobre un historial clínico ya
  // registrado (mascota + diagnóstico concretos), usando una plantilla.
  crearEjemplos: (): Promise<Plantilla[]> =>
    apiFetch<Plantilla[]>('/seguimientos/plantillas/ejemplos', { method: 'POST' }),

  iniciar: (data: { idHistorial: number; idPlantilla: number }): Promise<SeguimientoIniciado> =>
    apiFetch<SeguimientoIniciado>('/seguimientos/', { method: 'POST', body: JSON.stringify(data) }),
};

export default seguimientoAdminService;