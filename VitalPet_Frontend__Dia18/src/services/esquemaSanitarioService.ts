// =================================================================
// Archivo: src/services/esquemaSanitarioService.ts
// RESPONSABILIDAD: Esquema sanitario (vacunas, desparasitaciones y
// antipulgas): qué le toca a la mascota y qué está atrasado.
// =================================================================
import { apiFetch } from './api';

export type TipoAplicacion = 'vacuna' | 'desparasitacion' | 'antipulgas';
export type EstadoEsquema = 'al_dia' | 'proxima' | 'vencida' | 'sin_datos' | 'opcional';

export interface ItemEsquema {
  clave: string;
  tipo: TipoAplicacion;
  nombre: string;
  opcional: boolean;
  detalle: string;
  estado: EstadoEsquema;
  dosis_aplicadas: number;
  dosis_total?: number | null;
  ultima_aplicacion?: string | null;
  fecha_objetivo?: string | null;
  dias_restantes?: number | null;
  mensaje: string;
  aplicaciones: { idVacuna: number; nombre: string; fecha: string }[];
}

export interface EsquemaSanitario {
  idMascota: number;
  nombre_mascota: string;
  especie: string;
  fechaNacimiento?: string | null;
  edad_semanas?: number | null;
  tiene_esquema: boolean;
  nota: string;
  resumen: Record<EstadoEsquema, number>;
  items: ItemEsquema[];
}

export const esquemaSanitarioService = {
  mias: (): Promise<EsquemaSanitario[]> => apiFetch<EsquemaSanitario[]>('/esquema-sanitario/mias'),
  porMascota: (idMascota: number): Promise<EsquemaSanitario> =>
    apiFetch<EsquemaSanitario>(`/esquema-sanitario/mascota/${idMascota}`),
};

export default esquemaSanitarioService;
