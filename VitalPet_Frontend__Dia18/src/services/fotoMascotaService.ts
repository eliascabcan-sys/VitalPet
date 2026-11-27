// =================================================================
// Archivo: src/services/fotoMascotaService.ts
// RESPONSABILIDAD: subir, quitar y resolver la URL de la foto de una mascota.
// La foto viaja como data URL JPEG (ya recortada a 400x400 por el recortador),
// así que se usa el apiFetch normal (JSON) sin tocar api.ts.
// =================================================================
import { API_BASE, USAR_MOCK, apiFetch } from './api';

// Lo mínimo que se necesita de una mascota (el tipo Mascota completo también encaja).
export interface MascotaConFoto {
  idMascota?: number;
  foto_url?: string | null;
}

interface RespuestaFoto {
  foto_url: string | null;
}

// ---- Modo demo (npm run dev:mock): las fotos se guardan en el navegador ----
const CLAVE_MOCK = 'vitalpet_mock_fotos';

function leerMock(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_MOCK) || '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

function escribirMock(fotos: Record<string, string>) {
  try {
    localStorage.setItem(CLAVE_MOCK, JSON.stringify(fotos));
  } catch {
    throw new Error('El navegador no tiene espacio para guardar más fotos de prueba.');
  }
}

// URL lista para usar en <img src>, o null si la mascota no tiene foto.
export function urlFoto(m: MascotaConFoto): string | null {
  if (USAR_MOCK && m.idMascota != null) {
    const guardada = leerMock()[String(m.idMascota)];
    if (guardada) return guardada;
  }
  if (!m.foto_url) return null;
  return m.foto_url.startsWith('data:') ? m.foto_url : `${API_BASE}${m.foto_url}`;
}

export async function subirFoto(idMascota: number, imagen: string): Promise<RespuestaFoto> {
  if (USAR_MOCK) {
    escribirMock({ ...leerMock(), [String(idMascota)]: imagen });
    return { foto_url: imagen };
  }
  return apiFetch<RespuestaFoto>(`/mascotas/${idMascota}/foto`, {
    method: 'PUT',
    body: JSON.stringify({ imagen }),
  });
}

export async function quitarFoto(idMascota: number): Promise<RespuestaFoto> {
  if (USAR_MOCK) {
    const fotos = leerMock();
    delete fotos[String(idMascota)];
    escribirMock(fotos);
    return { foto_url: null };
  }
  return apiFetch<RespuestaFoto>(`/mascotas/${idMascota}/foto`, { method: 'DELETE' });
}