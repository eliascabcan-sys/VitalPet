// =================================================================
// Archivo: src/services/fichaService.ts
// RESPONSABILIDAD: Ficha del paciente (todo junto). Solo personal de la clínica.
// =================================================================
import { apiFetch } from './api';
import type { CitaControl, FormulaHistorial, PesoControl } from './historialService';
import type { ExamenLaboratorio } from './laboratorioService';

export interface FichaMascota {
  idMascota: number;
  nombre_mascota: string;
  especie: string;
  raza?: string | null;
  sexo?: string | null;
  color?: string | null;
  peso_kg?: number | string | null;
  fechaNacimiento?: string | null;
  estado?: string | null;
  foto_url?: string | null;   // <-- NUEVA
}

export interface FichaDueno {
  idUsuario: number;
  nombre: string;
  apellido?: string | null;
  telefono?: string | null;
  email?: string | null;
  documento?: string | null;
}

export interface FichaResumen {
  total_controles: number;
  total_formulas: number;
  total_examenes: number;
  total_aplicaciones: number;
  total_compras: number;
  total_certificados: number;
  ultima_consulta?: string | null;
  peso_actual?: number | string | null;
}

export interface FichaControl {
  idHistorial: number;
  fecha: string;
  motivo_consulta?: string | null;
  diagnostico?: string | null;
  tratamiento?: string | null;
  observaciones?: string | null;
  peso_consulta?: number | string | null;
  temperatura?: number | string | null;
  frecuencia_cardiaca?: number | null;
  frecuencia_respiratoria?: number | null;
  mucosas?: string | null;
  hidratacion?: string | null;
  condicion_corporal?: number | null;
  proxima_cita?: string | null;
  nombre_veterinario?: string | null;
  anamnesis?: string | null;
  examen_fisico?: string | null;
  procedimientos?: string | null;
  inyectologia?: string | null;
}

export interface FichaFormula extends FormulaHistorial {
  diagnostico?: string | null;
}

export interface FichaAplicacion {
  idVacuna: number;
  nombre: string;
  fecha_aplicacion: string;
  proxima_dosis?: string | null;
  lote?: string | null;
  veterinario?: string | null;
  observaciones?: string | null;
}

export interface FichaInyeccion {
  idHistorial: number;
  fecha: string;
  contenido: string;
}

export interface FichaCompra {
  idVenta: number;
  fecha?: string | null;
  total: number | string;
  estado?: string | null;
  idHistorial?: number | null;
  items: { nombre_producto: string; cantidad: number; subtotal: number | string }[];
}

export interface FichaCita {
  idCita: number;
  fechaHora: string;
  estado?: string | null;
  motivo?: string | null;
  franja?: string | null;
  nombre_veterinario?: string | null;
}

export interface FichaCertificado {
  idCertificado: number;
  codigo: string;
  tipo: string;
  fechaEmision?: string | null;
  vigenciaHasta?: string | null;
  estado: string;
  lote?: string | null;
}

export interface FichaPaciente {
  mascota: FichaMascota;
  dueno?: FichaDueno | null;
  resumen: FichaResumen;
  controles: FichaControl[];
  formulas: FichaFormula[];
  laboratorio: ExamenLaboratorio[];
  vacunas: FichaAplicacion[];
  desparasitaciones: FichaAplicacion[];
  antipulgas: FichaAplicacion[];
  inyecciones: FichaInyeccion[];
  compras: FichaCompra[];
  citas: FichaCita[];
  certificados: FichaCertificado[];
  pesos: PesoControl[];
  cita_control?: CitaControl | null;
}

export const fichaService = {
  deMascota: (idMascota: number): Promise<FichaPaciente> =>
    apiFetch<FichaPaciente>(`/ficha/mascota/${idMascota}`),
};
