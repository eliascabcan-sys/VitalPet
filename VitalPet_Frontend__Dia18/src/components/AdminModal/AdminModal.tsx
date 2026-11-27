// =================================================================
// Archivo: src/components/AdminModal/AdminModal.tsx
// RESPONSABILIDAD: Modal genérico con el mismo aspecto que los modales
// de admin.css (.modal-fondo / .modal-caja), para no repetir el marcado en
// cada pantalla de administración.
// =================================================================
import type { ReactNode } from 'react';
import '../../assets/css/admin.css';

interface AdminModalProps {
  abierto: boolean;
  titulo: string;
  onClose: () => void;
  children: ReactNode;
  pie?: ReactNode;
  ancho?: number;
}

export default function AdminModal({ abierto, titulo, onClose, children, pie, ancho }: AdminModalProps) {
  return (
    <div className={`modal-fondo${abierto ? ' abierto' : ''}`}>
      <div className="modal-caja" style={ancho ? { width: ancho } : undefined}>
        <div className="modal-titulo-fila">
          <div className="modal-titulo">{titulo}</div>
          <button className="btn-cerrar" onClick={onClose} aria-label="Cerrar">
            <i className="ti ti-x" />
          </button>
        </div>
        {children}
        {pie && <div className="modal-pie">{pie}</div>}
      </div>
    </div>
  );
}
