// =================================================================
// Archivo: src/services/formulaStockService.ts
// RESPONSABILIDAD: Consulta de stock desde la fórmula (solo veterinario
// y administrador). Endpoints: GET /formulas/stock y GET /formulas/{id}/stock
// =================================================================
import { apiFetch } from './api';

export type EstadoStock = 'disponible' | 'bajo' | 'agotado';
export type EstadoMedicamento = 'disponible' | 'insuficiente' | 'agotado' | 'sin_inventario';

export interface ProductoStock {
  idProducto: number;
  nombre_producto: string;
  stock: number;
  estado_stock: EstadoStock;
  requierePrescripcion: boolean;
  idCategoria: number;
  nombre_categoria?: string | null;
  idSubcategoria?: number | null;
  nombre_subcategoria?: string | null;
  // Unidades en total del mismo "tipo" (misma subcategoría, o categoría si no tiene).
  productos_del_tipo: number;
  unidades_del_tipo: number;
}

export interface MedicamentoStock {
  idFormulaMedicamento: number;
  nombre_medicamento: string;
  cantidad_requerida?: number | null;
  en_inventario: boolean;
  estado: EstadoMedicamento;
  faltan: number;
  producto?: ProductoStock | null;
}

export interface StockDeFormula {
  idFormula: number;
  hay_faltantes: boolean;
  medicamentos: MedicamentoStock[];
}

export const formulaStockService = {
  // Mientras se escribe la fórmula: productos que coinciden con el texto.
  buscar: (q: string, limite = 8): Promise<ProductoStock[]> =>
    apiFetch<ProductoStock[]>(`/formulas/stock?q=${encodeURIComponent(q)}&limite=${limite}`),

  // Fórmula ya guardada: ¿alcanza el inventario para cada medicamento?
  deFormula: (idFormula: number): Promise<StockDeFormula> =>
    apiFetch<StockDeFormula>(`/formulas/${idFormula}/stock`),
};

export default formulaStockService;