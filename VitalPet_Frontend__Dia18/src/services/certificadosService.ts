// =================================================================
// Archivo: src/services/certificadosService.ts
// RESPONSABILIDAD: Certificados. Emitir, listar y anular. NO hay forma de
// editar ni borrar un certificado emitido (el backend tampoco la ofrece).
// =================================================================
import { API_BASE, apiFetch } from './api';
import { storage } from './storage';

export type TipoCertificado = 'salud' | 'vacunacion' | 'viaje' | 'esterilizacion' | 'defuncion' | 'otro';

export const TIPOS_CERTIFICADO: { valor: TipoCertificado; etiqueta: string }[] = [
  { valor: 'salud', etiqueta: 'Salud' },
  { valor: 'vacunacion', etiqueta: 'Vacunación' },
  { valor: 'viaje', etiqueta: 'Viaje' },
  { valor: 'esterilizacion', etiqueta: 'Esterilización' },
  { valor: 'defuncion', etiqueta: 'Defunción' },
  { valor: 'otro', etiqueta: 'Otro' },
];

export const etiquetaTipoCertificado = (t: string) =>
  TIPOS_CERTIFICADO.find((x) => x.valor === t)?.etiqueta ?? t;

export interface Certificado {
  idCertificado: number;
  codigo: string;
  codigo_verificacion?: string | null;
  tipo: TipoCertificado | string;
  idMascota: number;
  idHistorial?: number | null;
  idUsuario: number;
  fechaEmision?: string | null;
  vigenciaHasta?: string | null;
  contenido: string;
  estado: 'emitido' | 'anulado' | string;
  mascota_nombre?: string | null;
  mascota_especie?: string | null;
  mascota_raza?: string | null;
  dueno_nombre?: string | null;
  nombre_veterinario?: string | null;
  tarjeta_profesional?: string | null;
  firma_veterinario?: string | null;
  lote?: string | null;
  motivo_anulacion?: string | null;
  fechaAnulacion?: string | null;
  integro: boolean;
}

// Lo que ve cualquier persona al verificar un certificado (sin contenido ni datos del dueño).
export interface VerificacionCertificado {
  valido: boolean;
  estado: 'emitido' | 'anulado' | string;
  integro: boolean;
  vigente: boolean;
  mensaje: string;
  codigo: string;
  tipo: string;
  fechaEmision?: string | null;
  vigenciaHasta?: string | null;
  fechaAnulacion?: string | null;
  mascota_nombre?: string | null;
  mascota_especie?: string | null;
  nombre_veterinario?: string | null;
  tarjeta_profesional?: string | null;
  lote?: string | null;
}

export interface NuevoCertificadoPayload {
  idMascota: number;
  tipo: TipoCertificado;
  contenido: string;
  lote?: string | null;
  vigenciaHasta?: string | null;
  idHistorial?: number | null;
}

export interface EstadoFirma {
  registrada: boolean;
  firma?: string | null;
}

export const certificadosService = {
  emitir: (data: NuevoCertificadoPayload): Promise<Certificado> =>
    apiFetch<Certificado>('/certificados/', { method: 'POST', body: JSON.stringify(data) }),

  deMascota: (idMascota: number): Promise<Certificado[]> =>
    apiFetch<Certificado[]>(`/certificados/mascota/${idMascota}`),

  obtener: (idCertificado: number): Promise<Certificado> =>
    apiFetch<Certificado>(`/certificados/${idCertificado}`),

  anular: (idCertificado: number, motivo: string): Promise<Certificado> =>
    apiFetch<Certificado>(`/certificados/${idCertificado}/anular`, { method: 'PUT', body: JSON.stringify({ motivo }) }),

  // PÚBLICO: no manda token. Acepta el código de verificación o el número CERT-...
  verificar: (codigo: string): Promise<VerificacionCertificado> =>
    apiFetch<VerificacionCertificado>(`/certificados/verificar/${encodeURIComponent(codigo.trim())}`, { auth: false }),

  // El PDF necesita el token, así que no pasa por apiFetch (que siempre espera JSON).
  descargarPdf: async (idCertificado: number): Promise<Blob> => {
    const token = storage.getToken();
    let res: Response;
    try {
      res = await fetch(`${API_BASE}/certificados/${idCertificado}/pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch {
      throw new Error('No se pudo conectar con el servidor.');
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(typeof data.detail === 'string' ? data.detail : 'No se pudo generar el PDF.');
    }
    return res.blob();
  },

  miFirma: (): Promise<EstadoFirma> => apiFetch<EstadoFirma>('/certificados/firma'),

  guardarFirma: (firma: string): Promise<EstadoFirma> =>
    apiFetch<EstadoFirma>('/certificados/firma', { method: 'PUT', body: JSON.stringify({ firma }) }),
};