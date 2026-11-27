// =================================================================
// Archivo: src/services/triajeService.ts
// RESPONSABILIDAD: Lee del backend los 5 niveles de triaje.
// Endpoint: GET /triaje/niveles
// =================================================================
import { apiFetch } from './api';

// De más urgente a menos urgente
export type NivelTriaje = 'rojo' | 'naranja' | 'amarillo' | 'verde' | 'azul';

export interface InfoNivelTriaje {
  codigo: NivelTriaje;
  numero: number;
  etiqueta: string;
  nombre: string;
  minutos_objetivo: number;
  tiempo_texto: string;
  genera_alerta: boolean;
  desc_veterinario: string;
  desc_dueno: string;
}

export const triajeService = {
  niveles: (): Promise<InfoNivelTriaje[]> => apiFetch<InfoNivelTriaje[]>('/triaje/niveles'),
};

export default triajeService;