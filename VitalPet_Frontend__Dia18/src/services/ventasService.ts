// =================================================================
// Archivo: src/services/ventasService.ts
// RESPONSABILIDAD: Ventas. Crear: cualquier autenticado (admin y
// veterinario venden a nombre de un dueño). Listar todas, cambiar
// estado y cancelar: solo administrador.
// Endpoints: /ventas/
// =================================================================
import { apiFetch } from './api';

export type EstadoVenta = 'pendiente' | 'pagada' | 'cancelada';

export interface DetalleVenta {
  idDetalleVenta: number;
  idProducto: number;
  cantidad: number;
  precioUnitario: number | string;
  subtotal: number | string;
  nombre_producto?: string | null;
  requierePrescripcion?: boolean | null;
}

export interface Venta {
  idVenta: number;
  fecha: string;
  total: number | string;
  estado?: string | null;
  idUsuario: number;
  idHistorial?: number | null;
  detalles: DetalleVenta[];
}

export interface NuevaVentaPayload {
  idUsuario: number;
  items: { idProducto: number; cantidad: number }[];
  idHistorial?: number | null;
}

export const ventasService = {
  todas: (): Promise<Venta[]> => apiFetch<Venta[]>('/ventas/'),

  mias: (): Promise<Venta[]> => apiFetch<Venta[]>('/ventas/mias'),

  crear: (data: NuevaVentaPayload): Promise<Venta> =>
    apiFetch<Venta>('/ventas/', { method: 'POST', body: JSON.stringify(data) }),

  cambiarEstado: (id: number, estado: EstadoVenta): Promise<Venta> =>
    apiFetch<Venta>(`/ventas/${id}`, { method: 'PUT', body: JSON.stringify({ estado }) }),

  // Cancela y repone el stock de los productos.
  cancelar: (id: number): Promise<{ mensaje: string }> =>
    apiFetch<{ mensaje: string }>(`/ventas/${id}`, { method: 'DELETE' }),
};

export default ventasService;
