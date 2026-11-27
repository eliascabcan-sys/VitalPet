// =================================================================
// Archivo: src/components/EmptyState/EmptyState.tsx
// RESPONSABILIDAD: Mensaje de "no hay nada que mostrar" (lista vacía,
// sin resultados de filtro o error de carga) con icono y, si quieres,
// un botón de acción.
// Uso: <EmptyState icono="ti-paw" mensaje="Sin pacientes" />
// =================================================================
import type { ReactNode } from 'react';
import './EmptyState.css';

interface EmptyStateProps {
  icono?: string; // clase de Tabler Icons, ej. 'ti-paw'
  mensaje: string;
  detalle?: string;
  accion?: ReactNode;
}

export default function EmptyState({ icono = 'ti-mood-empty', mensaje, detalle, accion }: EmptyStateProps) {
  return (
    <div className="empty-state" role="status">
      <i className={`ti ${icono}`} />
      <p className="empty-state-mensaje">{mensaje}</p>
      {detalle && <p className="empty-state-detalle">{detalle}</p>}
      {accion && <div className="empty-state-accion">{accion}</div>}
    </div>
  );
}