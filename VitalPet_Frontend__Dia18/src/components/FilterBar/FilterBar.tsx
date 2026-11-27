// =================================================================
// Archivo: src/components/FilterBar/FilterBar.tsx
// RESPONSABILIDAD: Barra de filtros reutilizable: buscador + los
// controles extra que le pases como children (selects, fechas...) +
// botón "Limpiar" que aparece solo si hay algún filtro activo.
// Reutiliza las clases .toolbar / .buscador / .filtro de admin.css.
// =================================================================
import type { ReactNode } from 'react';
import './FilterBar.css';

interface FilterBarProps {
  busqueda: string;
  onBusqueda: (valor: string) => void;
  placeholder?: string;
  hayFiltros?: boolean;
  onLimpiar?: () => void;
  children?: ReactNode;
}

export default function FilterBar({
  busqueda,
  onBusqueda,
  placeholder = 'Buscar...',
  hayFiltros = false,
  onLimpiar,
  children,
}: FilterBarProps) {
  return (
    <div className="toolbar filter-bar">
      <div className="buscador">
        <i className="ti ti-search" />
        <input
          type="text"
          placeholder={placeholder}
          aria-label={placeholder}
          value={busqueda}
          onChange={(e) => onBusqueda(e.target.value)}
        />
      </div>
      {children}
      {hayFiltros && onLimpiar && (
        <button type="button" className="filter-bar-limpiar" onClick={onLimpiar}>
          <i className="ti ti-filter-off" /> Limpiar
        </button>
      )}
    </div>
  );
}