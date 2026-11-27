// =================================================================
// Archivo: src/components/FichaCarpeta/FichaTabs.tsx
// RESPONSABILIDAD: Barra de pestañas de la ficha del paciente (la "carpeta").
// Cada pestaña puede mostrar un número y un punto de alerta.
// =================================================================
import './FichaCarpeta.css';

export interface Pestana {
  id: string;
  etiqueta: string;
  cantidad?: number;   // cuántos registros tiene
  alerta?: boolean;    // punto naranja: hay algo pendiente ahí dentro
}

interface Props {
  pestanas: Pestana[];
  activa: string;
  onCambiar: (id: string) => void;
}

export default function FichaTabs({ pestanas, activa, onCambiar }: Props) {
  return (
    <div className="fc-tabs" role="tablist" aria-label="Secciones de la ficha">
      {pestanas.map((p) => (
        <button
          key={p.id}
          type="button"
          role="tab"
          aria-selected={activa === p.id}
          className={`fc-tab${activa === p.id ? ' activa' : ''}`}
          onClick={() => onCambiar(p.id)}
        >
          {p.etiqueta}
          {p.cantidad !== undefined && <span className="fc-tab-n">{p.cantidad}</span>}
          {p.alerta && <span className="fc-tab-punto" aria-label="Hay pendientes" />}
        </button>
      ))}
    </div>
  );
}