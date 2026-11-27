// =================================================================
// Archivo: src/services/reportesSaludService.ts
// RESPONSABILIDAD: Peticiones HTTP del reporte diario de salud.
// =================================================================
import { apiFetch } from './api';
import type { NivelTriaje } from './triajeService';

export interface NuevoReporteSaludPayload {
  idMascota: number;
  alimentacion: string;
  actividad: string;
  sintomas: string;
  observaciones: string | null;
}

export interface ReporteSalud {
  idReporte: number;
  nivel: NivelTriaje;
}

export const reportesSaludService = {
  crear: (data: NuevoReporteSaludPayload): Promise<ReporteSalud> =>
    apiFetch<ReporteSalud>('/reportes-salud/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

export default reportesSaludService;
