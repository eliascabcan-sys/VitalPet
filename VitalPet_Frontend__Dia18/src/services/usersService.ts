// =================================================================
// Archivo: src/services/usersService.ts
// RESPONSABILIDAD: Peticiones HTTP de usuarios.
//  - Perfil del usuario en sesión (GET/PUT /users/me), común a los 3 roles.
//  - Gestión de usuarios para el administrador (listar, editar,
//    desactivar/reactivar, crear administradores).
// =================================================================
import { apiFetch } from './api';
import type { Rol } from './authService';

export interface PerfilUsuario {
  idUsuario: number;
  nombre: string;
  apellido: string;
  documento?: string | null;
  telefono?: string | null;
  fechaNacimiento?: string | null;
  email: string;
  rol: Rol;
}

export interface ActualizarPerfilPayload {
  nombre: string;
  apellido: string;
  documento: string | null;
  telefono: string | null;
  fechaNacimiento?: string | null;
  email: string;
  contrasena?: string;
}

// Lo que devuelve el backend (UserOut) en las rutas de administración.
export interface UsuarioAdmin extends PerfilUsuario {
  estado?: string | null;
  fechaCreacion?: string;
}

export interface EditarUsuarioPayload {
  nombre?: string;
  apellido?: string;
  documento?: string | null;
  telefono?: string | null;
  email?: string;
  contrasena?: string;
}

export interface CrearStaffPayload {
  nombre: string;
  apellido: string;
  documento?: string | null;
  telefono?: string | null;
  email: string;
  contrasena: string;
  rol: 'veterinario' | 'administrador';
}

export const usersService = {
  miPerfil: (): Promise<PerfilUsuario> => apiFetch<PerfilUsuario>('/users/me'),

  actualizarMiPerfil: (data: ActualizarPerfilPayload): Promise<PerfilUsuario> =>
    apiFetch<PerfilUsuario>('/users/me', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // ---- Solo administrador ----

  // Trae TODOS los roles; la pantalla filtra por rol. Con incluirInactivos
  // vienen también las cuentas desactivadas (para poder reactivarlas).
  listar: (incluirInactivos = true): Promise<UsuarioAdmin[]> =>
    apiFetch<UsuarioAdmin[]>(`/users/?incluir_inactivos=${incluirInactivos}`),

  // Dueños activos. También lo puede llamar el veterinario (ventas en mostrador).
  duenos: (): Promise<UsuarioAdmin[]> => apiFetch<UsuarioAdmin[]>('/users/duenos'),

  actualizar: (id: number, data: EditarUsuarioPayload): Promise<UsuarioAdmin> =>
    apiFetch<UsuarioAdmin>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  desactivar: (id: number): Promise<{ mensaje: string }> =>
    apiFetch<{ mensaje: string }>(`/users/${id}`, { method: 'DELETE' }),

  reactivar: (id: number): Promise<UsuarioAdmin> =>
    apiFetch<UsuarioAdmin>(`/users/${id}/reactivar`, { method: 'PUT' }),

  crearStaff: (data: CrearStaffPayload): Promise<UsuarioAdmin> =>
    apiFetch<UsuarioAdmin>('/users/staff', { method: 'POST', body: JSON.stringify(data) }),
};

export default usersService;
