// =================================================================
// Archivo: src/services/vacunasService.ts
// RESPONSABILIDAD: Peticiones HTTP del carnet de vacunación (dueño y
// veterinario/admin: obtener, crear, editar, desactivar).
// =================================================================
import { apiFetch } from './api';

export type TipoAplicacion = 'vacuna' | 'desparasitacion' | 'antipulgas';

export const ETIQUETA_TIPO_APLICACION: Record<TipoAplicacion, string> = {
  vacuna: 'Vacuna',
  desparasitacion: 'Desparasitación',
  antipulgas: 'Antipulgas',
};

export interface Vacuna {
  tipo?: TipoAplicacion;
  idVacuna: number;
  idMascota: number;
  nombre_mascota?: string;
  nombre_vacuna: string;
  fecha_aplicacion: string;
  proxima_dosis?: string;
  veterinario?: string;
  lote?: string;
  observaciones?: string;
  estado: 'activo' | 'inactivo';
}

export interface NuevaVacunaPayload {
  tipo?: TipoAplicacion;
  idMascota: number;
  nombre_vacuna: string;
  fecha_aplicacion: string;
  proxima_dosis: string | null;
  veterinario: string | null;
}

export interface EditarVacunaPayload {
  tipo?: TipoAplicacion;
  nombre_vacuna: string;
  fecha_aplicacion: string;
  proxima_dosis: string | null;
  veterinario: string | null;
}

export const vacunasService = {
  porMascota: (idMascota: number): Promise<Vacuna[]> => apiFetch<Vacuna[]>(`/vacunas/mascota/${idMascota}`),

  obtener: (id: number): Promise<Vacuna> => apiFetch<Vacuna>(`/vacunas/${id}`),

  crear: (data: NuevaVacunaPayload): Promise<Vacuna> =>
    apiFetch<Vacuna>('/vacunas/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  actualizar: (id: number, data: EditarVacunaPayload): Promise<Vacuna> =>
    apiFetch<Vacuna>(`/vacunas/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  eliminar: (id: number): Promise<void> => apiFetch<void>(`/vacunas/${id}`, { method: 'DELETE' }),
};

export default vacunasService;
