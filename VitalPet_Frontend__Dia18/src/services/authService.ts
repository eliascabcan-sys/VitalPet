// =================================================================
// Archivo: src/services/authService.ts
// RESPONSABILIDAD: Encapsula todas las peticiones HTTP de autenticación
// (login, registro, recuperar/restablecer contraseña, Google OAuth).
// =================================================================
import { apiFetch, API_BASE } from './api';

export type Rol = 'dueno' | 'veterinario' | 'administrador';

export interface Usuario {
  idUsuario: number;
  nombre: string;
  apellido: string;
  rol: Rol;
  email: string;
  access_token: string;
}

// Lo que devuelve POST /users/register (UserOut): NO trae token, hay que iniciar sesión.
export interface UsuarioRegistrado {
  idUsuario: number;
  nombre: string;
  apellido: string;
  email: string;
  rol: Rol;
}

export interface RegistroPayload {
  nombre: string;
  apellido: string;
  documento: string | null;
  telefono: string | null;
  fechaNacimiento?: string | null;
  email: string;
  contrasena: string;
}

export const authService = {
  login: async (email: string, contrasena: string): Promise<Usuario> => {
    const data = await apiFetch<Omit<Usuario, 'email'> & { email?: string }>('/users/login', {
      method: 'POST',
      body: JSON.stringify({ email, contrasena }),
      auth: false,
    });
    // El backend devuelve el email; si un backend viejo no lo trae, se usa el que
    // escribió el usuario para no guardar "undefined" en la sesión.
    return { ...data, email: data.email ?? email };
  },

  registro: (data: RegistroPayload): Promise<UsuarioRegistrado> => {
    return apiFetch<UsuarioRegistrado>('/users/register', {
      method: 'POST',
      body: JSON.stringify(data),
      auth: false,
    });
  },

  solicitarRecuperacion: (email: string): Promise<void> => {
    return apiFetch<void>('/auth/recuperar-contrasena', {
      method: 'POST',
      body: JSON.stringify({ email }),
      auth: false,
    });
  },

  restablecerContrasena: (token: string, contrasena: string): Promise<void> => {
    return apiFetch<void>('/auth/restablecer-contrasena', {
      method: 'POST',
      body: JSON.stringify({ token, contrasena }),
      auth: false,
    });
  },

  // No es un fetch: redirige el navegador al flujo de Google del backend.
  loginConGoogleUrl: (): string => `${API_BASE}/auth/google/login`,
};

export default authService;
