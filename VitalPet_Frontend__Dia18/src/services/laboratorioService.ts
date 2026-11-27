// =================================================================
// Archivo: src/services/laboratorioService.ts
// RESPONSABILIDAD: Laboratorio clínico. El veterinario/admin solicita y
// edita exámenes; el dueño solo consulta los de sus mascotas.
// =================================================================
import { apiFetch } from './api';



export type CategoriaExamen = 'hematologia' | 'quimica' | 'coprologia' | 'urianalisis' | 'imagenologia' | 'otro';
export type EstadoExamen = 'solicitado' | 'en_proceso' | 'entregado' | 'cancelado';



export const CATEGORIAS_EXAMEN: { valor: CategoriaExamen; etiqueta: string }[] = [
  { valor: 'hematologia', etiqueta: 'Hematología' },
  { valor: 'quimica', etiqueta: 'Química sanguínea' },
  { valor: 'coprologia', etiqueta: 'Coprología' },
  { valor: 'urianalisis', etiqueta: 'Uroanálisis' },
  { valor: 'imagenologia', etiqueta: 'Imagenología' },
  { valor: 'otro', etiqueta: 'Otro' },
];

export const ETIQUETA_ESTADO_EXAMEN: Record<EstadoExamen, string> = {
  solicitado: 'Solicitado',
  en_proceso: 'En proceso',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

export interface ValorExamen {
  parametro: string;
  valor: string;
  unidad?: string | null;
  referencia?: string | null;
}

export interface ExamenLaboratorio {
  idExamen: number;
  idHistorial: number;
  idMascota: number;
  nombre_mascota?: string | null;
  categoria: CategoriaExamen | string;
  tipo_examen: string;
  estado: EstadoExamen;
  fecha_solicitud?: string | null;
  fecha_resultado?: string | null;
  resultado?: string | null;
  valores?: ValorExamen[] | null;
  archivo_url?: string | null;
  observaciones?: string | null;
}

export interface ExamenListado extends ExamenLaboratorio {
  nombre_dueno?: string | null;
  especie?: string | null;
}

export interface NuevoExamenPayload {
  idHistorial: number;
  categoria: CategoriaExamen;
  tipo_examen: string;
  observaciones?: string | null;
}

export interface EditarExamenPayload {
  categoria?: CategoriaExamen;
  tipo_examen?: string;
  estado?: EstadoExamen;
  resultado?: string | null;
  valores?: ValorExamen[] | null;
  archivo_url?: string | null;
  observaciones?: string | null;
}

export const laboratorioService = {
  // Veterinario / admin: todos los exámenes de todos los pacientes (pendientes primero).
  todos: (): Promise<ExamenListado[]> => apiFetch<ExamenListado[]>('/laboratorio/'),
  
  mias: (): Promise<ExamenLaboratorio[]> => apiFetch<ExamenLaboratorio[]>('/laboratorio/mias'),

  porHistorial: (idHistorial: number): Promise<ExamenLaboratorio[]> =>
    apiFetch<ExamenLaboratorio[]>(`/laboratorio/historial/${idHistorial}`),

  porMascota: (idMascota: number): Promise<ExamenLaboratorio[]> =>
    apiFetch<ExamenLaboratorio[]>(`/laboratorio/mascota/${idMascota}`),

  solicitar: (data: NuevoExamenPayload): Promise<ExamenLaboratorio> =>
    apiFetch<ExamenLaboratorio>('/laboratorio/', { method: 'POST', body: JSON.stringify(data) }),

  actualizar: (idExamen: number, data: EditarExamenPayload): Promise<ExamenLaboratorio> =>
    apiFetch<ExamenLaboratorio>(`/laboratorio/${idExamen}`, { method: 'PUT', body: JSON.stringify(data) }),

  cancelar: (idExamen: number): Promise<void> => apiFetch<void>(`/laboratorio/${idExamen}`, { method: 'DELETE' }),
};

export default laboratorioService;
