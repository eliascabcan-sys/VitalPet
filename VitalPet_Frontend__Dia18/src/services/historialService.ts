// =================================================================
// Archivo: src/services/historialService.ts
// RESPONSABILIDAD: Peticiones HTTP del historial clínico (dueño y
// veterinario/admin: listar todo, crear, editar, eliminar, secciones).
// =================================================================
import { apiFetch } from './api';

export interface SeccionHistorial {
  tipo: string;
  contenido?: string | null;
  orden?: number;
}

export interface MedicamentoFormula {
  idFormulaMedicamento?: number;
  // Enlace opcional con el inventario (Día 12: stock desde la fórmula).
  idProducto?: number | null;
  nombre_medicamento: string;
  presentacion?: string | null;
  dosis: string;
  via_administracion?: string | null;
  frecuencia: string;
  duracion_dias: number | null;
  cantidad?: number | null;
  indicaciones?: string | null;
}

export interface FormulaHistorial {
  idFormula: number;
  idHistorial: number;
  fecha?: string | null;
  recomendaciones?: string | null;
  estado: string;
  medicamentos: MedicamentoFormula[];
}

export interface FormulaPayload {
  recomendaciones: string | null;
  medicamentos: MedicamentoFormula[];
}

// Próxima cita agendada de la mascota: la "cita de control" que se muestra en la fórmula.
export interface CitaControl {
  idCita: number;
  fechaHora: string;
  estado?: string | null;
  motivo?: string | null;
  idFranja?: number | null;
  franja_nombre?: string | null;
  hora_inicio?: string | null;
  hora_fin?: string | null;
  nombre_veterinario?: string | null;
}

export interface RegistroHistorial {
  idHistorial: number;
  idMascota: number;
  nombre_mascota?: string;
  especie?: string;
  raza?: string | null;
  fechaRegistro: string;
  motivo_consulta?: string;
  diagnostico?: string;
  tratamiento?: string;
  medicamentos?: string;
  observaciones?: string;
  proxima_cita?: string;
  peso_consulta?: number;
  temperatura?: number;
  frecuencia_cardiaca?: number | null;
  frecuencia_respiratoria?: number | null;
  mucosas?: string | null;
  tllc_seg?: number | null;
  hidratacion?: string | null;
  condicion_corporal?: number | null;
  secciones?: SeccionHistorial[];
  // Fórmula (antes "Tratamiento")
  formulas?: FormulaHistorial[];
  estado: 'activo' | 'inactivo';
  // true si en este registro rige la regla de mascota nueva (sin diagnóstico)
  mascota_nueva?: boolean;
  // Próxima cita agendada (aparece en la fórmula)
  cita_control?: CitaControl | null;
}

// Lo que el formulario necesita saber antes de abrirse.
export interface EstadoClinicoMascota {
  idMascota: number;
  mascota_nueva: boolean;
  consultas_previas: number;
  campos_bloqueados: string[];
  secciones_bloqueadas: string[];
}

export interface PesoControl {
  idHistorial: number;
  fecha: string;
  peso_kg: number;
}

export interface EditarHistorialPayload {
  // Se omite cuando el diagnóstico está bloqueado (mascota nueva).
  diagnostico?: string | null;
  tratamiento?: string | null;
  observaciones: string | null;
  motivo_consulta?: string | null;
  peso_consulta?: number | null;
  temperatura?: number | null;
  frecuencia_cardiaca?: number | null;
  frecuencia_respiratoria?: number | null;
  mucosas?: string | null;
  tllc_seg?: number | null;
  hidratacion?: string | null;
  condicion_corporal?: number | null;
  // Secciones de la hoja: se guardan junto con el registro (una sola petición).
  secciones?: SeccionHistorial[];
  // Fórmula: medicamentos (con dosis, frecuencia y duración) + recomendaciones.
  formula?: FormulaPayload | null;
}

export interface NuevoHistorialPayload extends EditarHistorialPayload {
  idMascota: number;
  estado: 'activo';
}

export interface HistorialCreado extends RegistroHistorial {
  seguimiento_creado?: boolean;
  idSeguimiento?: number;
}

export const historialService = {
  mias: (): Promise<RegistroHistorial[]> => apiFetch<RegistroHistorial[]>('/historial/mias'),

  porMascota: (idMascota: number): Promise<RegistroHistorial[]> =>
    apiFetch<RegistroHistorial[]>(`/historial/mascota/${idMascota}`),

  esNueva: (idMascota: number): Promise<EstadoClinicoMascota> =>
    apiFetch<EstadoClinicoMascota>(`/historial/mascota/${idMascota}/es-nueva`),

  pesos: (idMascota: number): Promise<PesoControl[]> =>
    apiFetch<PesoControl[]>(`/historial/mascota/${idMascota}/pesos`),

  todos: (): Promise<RegistroHistorial[]> => apiFetch<RegistroHistorial[]>('/historial/'),

  obtener: (id: number): Promise<RegistroHistorial> => apiFetch<RegistroHistorial>(`/historial/${id}`),

  crear: (data: NuevoHistorialPayload): Promise<HistorialCreado> =>
    apiFetch<HistorialCreado>('/historial/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  actualizar: (id: number, data: EditarHistorialPayload): Promise<RegistroHistorial> =>
    apiFetch<RegistroHistorial>(`/historial/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  guardarSecciones: (id: number, secciones: SeccionHistorial[]): Promise<RegistroHistorial> =>
    apiFetch<RegistroHistorial>(`/historial/${id}/secciones`, {
      method: 'PUT',
      body: JSON.stringify({ secciones }),
    }),

  eliminar: (id: number): Promise<void> => apiFetch<void>(`/historial/${id}`, { method: 'DELETE' }),
};

export default historialService;