// =================================================================
// Archivo: src/services/autorizacionesService.ts
// RESPONSABILIDAD: Peticiones HTTP de Autorizaciones (adultos mayores):
// acudientes y consentimiento. El dueño maneja los suyos; veterinario y
// administrador solo consultan el estado de un dueño.
// =================================================================
import { apiFetch } from './api';
import type { UsuarioAdmin } from './usersService';

export interface Acudiente {
  idAcudiente: number;
  nombre: string;
  apellido: string;
  documento?: string | null;
  telefono: string;
  email?: string | null;
  parentesco?: string | null;
  autorizado: boolean;
  estado: string;
}

export interface NuevoAcudientePayload {
  nombre: string;
  apellido: string;
  documento: string | null;
  telefono: string;
  email: string | null;
  parentesco: string | null;
}

export interface Consentimiento {
  idConsentimiento: number;
  idAcudiente: number;
  version_texto: string;
  fechaAceptacion: string;
  vigente: boolean;
}

export interface EstadoAutorizacion {
  es_adulto_mayor: boolean;
  edad: number | null;
  fecha_nacimiento_registrada: boolean;
  requiere_autorizacion: boolean;
  tiene_acudiente: boolean;
  tiene_consentimiento: boolean;
  completa: boolean;
  pendientes: string[];
  acudientes: Acudiente[];
  consentimiento: Consentimiento | null;
  texto_consentimiento: string;
}

export const autorizacionesService = {
  // Dueño
  mias: (): Promise<EstadoAutorizacion> => apiFetch<EstadoAutorizacion>('/autorizaciones/mias'),

  crearAcudiente: (data: NuevoAcudientePayload): Promise<Acudiente> =>
    apiFetch<Acudiente>('/autorizaciones/acudientes', { method: 'POST', body: JSON.stringify(data) }),

  quitarAcudiente: (id: number): Promise<void> =>
    apiFetch<void>(`/autorizaciones/acudientes/${id}`, { method: 'DELETE' }),

  firmarConsentimiento: (idAcudiente: number): Promise<Consentimiento> =>
    apiFetch<Consentimiento>('/autorizaciones/consentimiento', {
      method: 'POST',
      body: JSON.stringify({ idAcudiente, acepta: true }),
    }),

  revocarConsentimiento: (): Promise<void> =>
    apiFetch<void>('/autorizaciones/consentimiento', { method: 'DELETE' }),

  // Veterinario / administrador (solo lectura)
  deDueno: (idUsuario: number): Promise<EstadoAutorizacion> =>
    apiFetch<EstadoAutorizacion>(`/autorizaciones/dueno/${idUsuario}`),

  // Lista de dueños (veterinario y administrador). Trae fechaNacimiento para saber quién es 60+.
  duenos: (): Promise<UsuarioAdmin[]> => apiFetch<UsuarioAdmin[]>('/users/duenos'),
};

export default autorizacionesService;