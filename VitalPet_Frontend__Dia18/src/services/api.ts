// =================================================================
// Archivo: src/services/api.ts
// RESPONSABILIDAD: Cliente HTTP centralizado. Arma la URL base del
// backend FastAPI, agrega el token JWT (si existe) y estandariza el
// manejo de errores para que todos los servicios lo reutilicen.
// =================================================================
import { storage, dispararSesionVencida } from './storage';

// URL base del backend.
//  - Desarrollo: vacío -> "/api/vs1" (relativo). El proxy de vite.config.ts lo
//    reenvía a FastAPI (localhost:8000), sin CORS.
//  - Producción con el backend en otro dominio: definir VITE_API_URL
//    (ej. VITE_API_URL=https://api.vitalpet.com) al hacer el build; en ese caso
//    el backend debe incluir el dominio del frontend en ALLOWED_ORIGINS.
const ORIGEN_API = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').replace(/\/$/, '');
export const API_BASE = `${ORIGEN_API}/api/vs1`;

// MODO DEMO: con VITE_USAR_MOCK=true (npm run dev:mock) las peticiones no salen
// al servidor: las responde src/mocks/mockApi.ts con datos de ejemplo. Sirve para
// armar pantallas mientras el backend no está listo. Con `npm run dev` queda apagado.
export const USAR_MOCK = import.meta.env.VITE_USAR_MOCK === 'true';

// El token JWT del backend vence (ACCESS_TOKEN_EXPIRE_MINUTES). Cuando una petición
// autenticada vuelve con 401, se limpia la sesión y se avisa mediante un evento
// (en vez de window.location.assign, que recargaba toda la página y perdía
// cualquier estado de React) para que App.tsx navegue al login dentro del SPA.
function cerrarSesionExpirada() {
  storage.limpiarSesion();
  dispararSesionVencida();
}

// Convierte el "detail" de un error de FastAPI en un mensaje legible.
// FastAPI manda "detail" como string en errores simples (401, 403, 404...)
// pero como ARREGLO de objetos {loc, msg, type} en errores de validación (422).
function extraerError(detail: unknown, mensajePorDefecto: string): string {
  if (Array.isArray(detail)) {
    return detail.map((e) => e?.msg || JSON.stringify(e)).join(' | ');
  }
  if (typeof detail === 'string' && detail.trim()) {
    return detail;
  }
  return mensajePorDefecto;
}

interface ApiFetchOptions extends RequestInit {
  auth?: boolean; // si es true (default), manda el header Authorization
}

// Wrapper único para todas las peticiones. Lanza un Error con mensaje
// legible si la respuesta no es ok, y parsea el JSON si la hay.
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { auth = true, headers, ...rest } = options;

  if (USAR_MOCK) {
    const { mockFetch } = await import('../mocks/mockApi');
    return mockFetch<T>(path, rest);
  }

  const finalHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string>),
  };

  if (auth) {
    const token = storage.getToken();
    if (token) finalHeaders['Authorization'] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...rest, headers: finalHeaders });
  } catch {
    throw new Error('No se pudo conectar con el servidor. ¿Está corriendo FastAPI en el puerto 8000?');
  }

  if (!res.ok) {
    // Solo si había token: un 401 en /users/login (auth:false) significa "credenciales
    // incorrectas" y debe mostrarse como error del formulario, no cerrar sesión.
    if (res.status === 401 && auth && storage.getToken()) {
      cerrarSesionExpirada();
      throw new Error('Tu sesión expiró. Inicia sesión de nuevo.');
    }
    const data = await res.json().catch(() => ({}));
    throw new Error(extraerError(data.detail, 'Ocurrió un error inesperado.'));
  }

  // Algunos endpoints (ej. DELETE) responden 204 sin cuerpo
  if (res.status === 204) return undefined as T;
  return res.json();
}

