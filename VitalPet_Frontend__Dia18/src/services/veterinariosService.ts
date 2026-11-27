// =================================================================
// Archivo: src/services/veterinariosService.ts
// RESPONSABILIDAD: CRUD de veterinarios (solo administrador).
// Endpoints: /veterinarios/
// =================================================================
import { apiFetch } from './api';

export interface Veterinario {
  idVeterinario: number;
  idUsuario: number;
  especialidad?: string | null;
  tarjetaProfesional: string;
  estado: string;
  nombre?: string | null;
  apellido?: string | null;
  email?: string | null;
}

export interface NuevoVeterinarioPayload {
  nombre: string;
  apellido: string;
  documento?: string | null;
  telefono?: string | null;
  email: string;
  contrasena: string;
  especialidad?: string | null;
  tarjetaProfesional: string;
}

export interface EditarVeterinarioPayload {
  especialidad?: string | null;
  tarjetaProfesional?: string;
  contrasena?: string;
}

export const veterinariosService = {
  listar: (incluirInactivos = true): Promise<Veterinario[]> =>
    apiFetch<Veterinario[]>(`/veterinarios/?incluir_inactivos=${incluirInactivos}`),

  crear: (data: NuevoVeterinarioPayload): Promise<Veterinario> =>
    apiFetch<Veterinario>('/veterinarios/', { method: 'POST', body: JSON.stringify(data) }),

  actualizar: (id: number, data: EditarVeterinarioPayload): Promise<Veterinario> =>
    apiFetch<Veterinario>(`/veterinarios/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  desactivar: (id: number): Promise<{ mensaje: string }> =>
    apiFetch<{ mensaje: string }>(`/veterinarios/${id}`, { method: 'DELETE' }),

  reactivar: (id: number): Promise<Veterinario> =>
    apiFetch<Veterinario>(`/veterinarios/${id}/reactivar`, { method: 'PUT' }),
};

export default veterinariosService;
