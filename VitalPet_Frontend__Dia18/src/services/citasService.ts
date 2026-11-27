// =================================================================
// Archivo: src/services/citasService.ts
// RESPONSABILIDAD: Peticiones HTTP del dominio de Citas (dueño y
// veterinario/admin): listar, agendar, cancelar, actualizar, disponibilidad,
// agenda del veterinario y citas pendientes.
// =================================================================
import { apiFetch } from './api';

// Cómo se quiere que contacten al dueño por la cita. 'urgente' = que lo
// contacten de inmediato. (app / presencial los usa el personal de la clínica.)
export type CanalContacto = 'app' | 'telefono' | 'presencial' | 'correo' | 'urgente';

export interface Franja {
  idFranja: number;
  nombre: string;
  hora_inicio: string; // 'HH:MM:SS'
  hora_fin: string;
  cupo_maximo: number;
}

export interface FranjaDisponibilidad extends Franja {
  cupos_usados: number;
  cupos_disponibles: number;
  disponible: boolean;
  motivo_no_disponible?: string | null;
}


export interface Cita {
  idCita: number;
  idMascota: number;
  idUsuario?: number;
  idVeterinario?: number;
  idFranja?: number | null;
  canal_contacto?: CanalContacto | string | null;
  franja?: Franja | null;
  motivo?: string;
    // Nombres que trae la lista del veterinario (/citas/): así no se muestran solo IDs.
  nombre_mascota?: string | null;
  especie?: string | null;
  nombre_dueno?: string | null;
  nombre_veterinario?: string | null;
  fechaHora: string;
  estado: 'pendiente' | 'confirmada' | 'completada' | 'atendida' | 'cancelada' | string;
}

// ---- Día 9 · P1: lo que le falta a la mascota antes de la cita ----
export interface PendienteVacuna {
  nombre: string;
  tipo: string;
  estado: 'vencida' | 'proxima' | 'sin_datos' | string;
  mensaje: string;
  fecha_objetivo?: string | null;
}

export interface PendienteExamen {
  tipo_examen: string;
  estado: 'solicitado' | 'en_proceso' | string;
}

export interface PreparacionDeCita {
  idCita: number;
  idMascota: number;
  nombre_mascota: string;
  fechaHora: string;
  vacunas: PendienteVacuna[];
  examenes: PendienteExamen[];
  total: number;
  al_dia: boolean;
}
// ---- P2: agenda del veterinario ----
export interface CitaAgenda {
  idCita: number;
  fechaHora: string;
  motivo?: string | null;
  estado: string;
  idMascota: number;
  nombre_mascota?: string | null;
  especie?: string | null;
  idUsuario: number;
  nombre_dueno?: string | null;
  idVeterinario?: number | null;
  idFranja?: number | null;
  canal_contacto?: string | null;
}

export interface AgendaFranja extends FranjaDisponibilidad {
  citas: CitaAgenda[];
}

export interface AgendaDia {
  fecha: string;
  dia_semana: string;
  total_citas: number;
  franjas: AgendaFranja[];
  citas_hora_exacta: CitaAgenda[];
}

export interface Agenda {
  idVeterinario: number;
  nombre_veterinario?: string | null;
  vista: 'dia' | 'semana' | 'mes';
  desde: string;
  hasta: string;
  total_citas: number;
  dias: AgendaDia[];
}

// ---- P4: citas pendientes del dueño ----
export interface CitaPendiente {
  idCita: number;
  fechaHora: string;
  motivo?: string | null;
  estado: string;
  idMascota: number;
  nombre_mascota?: string | null;
  idVeterinario?: number | null;
  nombre_veterinario?: string | null;
  franja?: Franja | null;
  canal_contacto?: string | null;
  mensaje: string;
}

export interface Veterinario {
  idVeterinario: number;
  nombre?: string;
  apellido?: string;
  especialidad?: string;
}

export interface Derivacion {
  idDerivacion: number;
  idMascota: number;
  especialidadDestino: string;
  estado: string;
}

export interface NuevaCitaPayload {
  // Hora exacta (personal de la clínica) ...
  fechaHora?: string;
  // ... o fecha + franja del día (dueño: sin hora exacta).
  fecha?: string; // 'AAAA-MM-DD'
  idFranja?: number;
  canal_contacto?: CanalContacto;
  motivo: string | null;
  idUsuario: number;
  idMascota: number;
  idVeterinario?: number;
}

export interface EditarCitaPayload {
  fechaHora?: string;
  motivo?: string | null;
  estado?: string;
}

export const citasService = {
  mias: (): Promise<Cita[]> => apiFetch<Cita[]>('/citas/mias'),

  preparacionMias: (): Promise<PreparacionDeCita[]> => apiFetch<PreparacionDeCita[]>('/citas/mias/preparacion'),

  todas: (): Promise<Cita[]> => apiFetch<Cita[]>('/citas/'),

  crear: (data: NuevaCitaPayload): Promise<Cita> =>
    apiFetch<Cita>('/citas/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  actualizar: (idCita: number, data: EditarCitaPayload): Promise<Cita> =>
    apiFetch<Cita>(`/citas/${idCita}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  cancelar: (idCita: number): Promise<void> =>
    apiFetch<void>(`/citas/${idCita}`, { method: 'DELETE' }),

  veterinariosPorEspecialidad: (especialidad = 'general'): Promise<Veterinario[]> =>
    apiFetch<Veterinario[]>(`/veterinarios/?especialidad=${encodeURIComponent(especialidad)}`),

  citasDeVeterinarioEnFecha: (idVeterinario: number, fecha: string): Promise<Cita[]> =>
    apiFetch<Cita[]>(`/citas/veterinario/${idVeterinario}?fecha=${encodeURIComponent(fecha)}`),

  franjas: (): Promise<Franja[]> => apiFetch<Franja[]>('/citas/franjas'),

  disponibilidadFranjas: (fecha: string, idVeterinario?: number): Promise<FranjaDisponibilidad[]> =>
    apiFetch<FranjaDisponibilidad[]>(
      `/citas/franjas/disponibilidad?fecha=${encodeURIComponent(fecha)}` +
        (idVeterinario ? `&idVeterinario=${idVeterinario}` : '')
    ),

  derivacionesMias: (): Promise<Derivacion[]> => apiFetch<Derivacion[]>('/derivaciones/mias'),

  // ---- P2 ----
  agenda: (vista: 'dia' | 'semana' | 'mes', fecha: string, idVeterinario?: number): Promise<Agenda> =>
    apiFetch<Agenda>(
      `/citas/agenda?vista=${vista}&fecha=${encodeURIComponent(fecha)}` +
        (idVeterinario ? `&idVeterinario=${idVeterinario}` : '')
    ),

  sinAsignar: (): Promise<CitaAgenda[]> => apiFetch<CitaAgenda[]>('/citas/sin-asignar'),

  asignar: (idCita: number, idVeterinario: number, confirmar = false): Promise<Cita> =>
    apiFetch<Cita>(`/citas/${idCita}/asignar`, {
      method: 'PUT',
      body: JSON.stringify({ idVeterinario, confirmar }),
    }),

  // ---- P4 ----
  pendientesMias: (): Promise<CitaPendiente[]> => apiFetch<CitaPendiente[]>('/citas/mias/pendientes'),
};

export default citasService;