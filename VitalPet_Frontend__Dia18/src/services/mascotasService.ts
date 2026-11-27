// =================================================================
// Archivo: src/services/mascotasService.ts
// RESPONSABILIDAD: Peticiones HTTP del dominio de Mascotas
// (dueño: mías/crear · veterinario-admin: listar todas/editar/eliminar).
// =================================================================
import { apiFetch } from './api';

export interface Mascota {
  idMascota: number;
  idUsuario?: number;
  nombre_mascota: string;
  especie: string;
  raza?: string;
  sexo?: string | null;
  fechaNacimiento?: string;
  peso_kg?: number | null;
  estado: 'activo' | 'inactivo';
  nombre_dueno?: string | null; // solo viene en la lista del veterinario/admin
  foto_url?: string | null;     // <-- NUEVA
}

export interface NuevaMascotaPayload {
  nombre_mascota: string;
  especie: string;
  raza: string | null;
  sexo: string;
  peso_kg: number;
  fechaNacimiento: string | null;
  idUsuario: number;
}

export interface EditarMascotaPayload {
  nombre_mascota: string;
  especie: string;
  raza: string | null;
  sexo?: string | null;
  peso_kg?: number | null;
  fechaNacimiento: string | null;
  estado: 'activo' | 'inactivo';
}

export const mascotasService = {
  mias: (): Promise<Mascota[]> => apiFetch<Mascota[]>('/mascotas/mias'),

  todas: (): Promise<Mascota[]> => apiFetch<Mascota[]>('/mascotas/'),

  obtener: (id: number): Promise<Mascota> => apiFetch<Mascota>(`/mascotas/${id}`),

  crear: (data: NuevaMascotaPayload): Promise<Mascota> =>
    apiFetch<Mascota>('/mascotas/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  actualizar: (id: number, data: EditarMascotaPayload): Promise<Mascota> =>
    apiFetch<Mascota>(`/mascotas/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  eliminar: (id: number): Promise<void> => apiFetch<void>(`/mascotas/${id}`, { method: 'DELETE' }),
};

export default mascotasService;
