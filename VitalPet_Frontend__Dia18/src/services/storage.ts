// =================================================================
// Archivo: src/services/storage.ts
// RESPONSABILIDAD (P4): único punto de acceso a localStorage para la
// sesión. Antes, api.ts y AuthContext.tsx leían/escribían las mismas
// claves ('vp_token', 'vp_nombre'...) cada uno por su lado; si una
// clave cambiaba, había que tocar dos archivos y era fácil olvidar uno.
// =================================================================

export interface DatosSesion {
  token: string;
  idUsuario: number;
  nombre: string;
  apellido: string;
  rol: string;
  email: string;
}

const CLAVES = {
  token: 'vp_token',
  idUsuario: 'vp_usuario_id',
  nombre: 'vp_nombre',
  apellido: 'vp_apellido',
  rol: 'vp_rol',
  email: 'vp_email',
} as const;

export const storage = {
  getToken(): string {
    return localStorage.getItem(CLAVES.token) || '';
  },

  // Devuelve null si no hay sesión guardada (sin token o sin idUsuario).
  leerSesion(): DatosSesion | null {
    const token = localStorage.getItem(CLAVES.token);
    const idUsuarioStr = localStorage.getItem(CLAVES.idUsuario);
    if (!token || !idUsuarioStr) return null;

    return {
      token,
      idUsuario: parseInt(idUsuarioStr, 10),
      nombre: localStorage.getItem(CLAVES.nombre) || '',
      apellido: localStorage.getItem(CLAVES.apellido) || '',
      rol: localStorage.getItem(CLAVES.rol) || 'dueno',
      email: localStorage.getItem(CLAVES.email) || '',
    };
  },

  guardarSesion(datos: DatosSesion): void {
    localStorage.setItem(CLAVES.token, datos.token);
    localStorage.setItem(CLAVES.idUsuario, String(datos.idUsuario));
    localStorage.setItem(CLAVES.nombre, datos.nombre);
    localStorage.setItem(CLAVES.apellido, datos.apellido);
    localStorage.setItem(CLAVES.rol, datos.rol);
    localStorage.setItem(CLAVES.email, datos.email);
  },

  actualizarCampos(datos: Partial<Pick<DatosSesion, 'nombre' | 'apellido' | 'email'>>): void {
    if (datos.nombre !== undefined) localStorage.setItem(CLAVES.nombre, datos.nombre);
    if (datos.apellido !== undefined) localStorage.setItem(CLAVES.apellido, datos.apellido);
    if (datos.email !== undefined) localStorage.setItem(CLAVES.email, datos.email);
  },

  limpiarSesion(): void {
    Object.values(CLAVES).forEach((clave) => localStorage.removeItem(clave));
  },
};

// --- Evento de "sesión vencida" -------------------------------------------
// api.ts dispara este evento cuando el backend responde 401. En vez de
// forzar window.location (recarga completa, pierde el estado de React),
// quien esté escuchando (normalmente App.tsx con useNavigate) decide cómo
// navegar al login dentro del SPA.
export const EVENTO_SESION_VENCIDA = 'vp:sesion-vencida';

export function dispararSesionVencida(): void {
  window.dispatchEvent(new CustomEvent(EVENTO_SESION_VENCIDA));
}

export function alEscucharSesionVencida(callback: () => void): () => void {
  window.addEventListener(EVENTO_SESION_VENCIDA, callback);
  return () => window.removeEventListener(EVENTO_SESION_VENCIDA, callback);
}
