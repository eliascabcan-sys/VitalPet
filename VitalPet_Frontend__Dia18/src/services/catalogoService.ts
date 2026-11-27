// =================================================================
// Archivo: src/services/catalogoService.ts
// RESPONSABILIDAD: Categorías y productos. Leer es público; crear,
// editar y eliminar (borrado lógico) es solo del administrador.
// Endpoints: /categorias/ y /products/
// =================================================================
import { apiFetch } from './api';

export interface Categoria {
  idCategoria: number;
  nombre_categoria: string;
  estado?: string | null;
}

export interface Producto {
  idProducto: number;
  nombre_producto: string;
  // El backend serializa Decimal como texto ("25000.00"): usar Number(...).
  precio: number | string;
  stock: number;
  estado?: string | null;
  idCategoria: number;
  requierePrescripcion?: boolean | null;
}

export interface ProductoPayload {
  nombre_producto: string;
  precio: number;
  stock: number;
  idCategoria: number;
  requierePrescripcion: boolean;
}

export const catalogoService = {
  categorias: (): Promise<Categoria[]> => apiFetch<Categoria[]>('/categorias/'),

  crearCategoria: (nombre_categoria: string): Promise<Categoria> =>
    apiFetch<Categoria>('/categorias/', { method: 'POST', body: JSON.stringify({ nombre_categoria }) }),

  actualizarCategoria: (id: number, nombre_categoria: string): Promise<Categoria> =>
    apiFetch<Categoria>(`/categorias/${id}`, { method: 'PUT', body: JSON.stringify({ nombre_categoria }) }),

  eliminarCategoria: (id: number): Promise<{ mensaje: string }> =>
    apiFetch<{ mensaje: string }>(`/categorias/${id}`, { method: 'DELETE' }),

  productos: (): Promise<Producto[]> => apiFetch<Producto[]>('/products/'),

  crearProducto: (data: ProductoPayload): Promise<Producto> =>
    apiFetch<Producto>('/products/', { method: 'POST', body: JSON.stringify(data) }),

  actualizarProducto: (id: number, data: Partial<ProductoPayload>): Promise<Producto> =>
    apiFetch<Producto>(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  eliminarProducto: (id: number): Promise<{ mensaje: string }> =>
    apiFetch<{ mensaje: string }>(`/products/${id}`, { method: 'DELETE' }),
};

export default catalogoService;
