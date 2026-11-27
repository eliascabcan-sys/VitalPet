// =================================================================
// Archivo: src/components/CalendarioMes/CalendarioMes.tsx
// RESPONSABILIDAD: Cuadrícula mensual (lunes a domingo) de la agenda del
// veterinario. Cada día muestra cuántas citas tiene y qué tan lleno está;
// al tocar un día se selecciona (el detalle lo pinta la página).
// =================================================================
import type { Agenda } from '../../services/citasService';
import './CalendarioMes.css';

interface Props {
  agenda: Agenda;
  seleccionado: string; // 'AAAA-MM-DD'
  hoy: string;
  onSeleccionar: (iso: string) => void;
  // Cuántas citas SIN veterinario hay cada día ('AAAA-MM-DD' -> cantidad): se marcan para asignarlas.
  porAsignar?: Record<string, number>;
}

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export default function CalendarioMes({ agenda, seleccionado, hoy, onSeleccionar, porAsignar = {} }: Props) {
  const primero = new Date(`${agenda.desde}T00:00:00`);
  const vacios = (primero.getDay() + 6) % 7; // lunes = 0

  return (
    <div className="cm" role="grid" aria-label="Calendario mensual de citas">
      {DIAS.map((d) => <div key={d} className="cm-enc" role="columnheader">{d}</div>)}
      {Array.from({ length: vacios }).map((_, i) => <div key={`v${i}`} className="cm-vacio" />)}
      {agenda.dias.map((d) => {
        const num = Number(d.fecha.slice(8, 10));
        const domingo = new Date(`${d.fecha}T00:00:00`).getDay() === 0;
        const cupo = d.franjas.reduce((a, f) => a + f.cupo_maximo, 0);
        const usados = d.franjas.reduce((a, f) => a + f.cupos_usados, 0);
        const pct = cupo ? Math.min(100, Math.round((usados / cupo) * 100)) : 0;
        const sinVet = porAsignar[d.fecha] || 0;
        const nivel = domingo ? 'cerrado' : pct >= 100 ? 'lleno' : pct >= 60 ? 'alto' : d.total_citas ? 'con' : 'libre';
        return (
          <button
            key={d.fecha}
            type="button"
            role="gridcell"
            className={`cm-dia ${nivel}${d.fecha === seleccionado ? ' sel' : ''}${d.fecha === hoy ? ' hoy' : ''}`}
            onClick={() => onSeleccionar(d.fecha)}
            aria-label={`${d.fecha}: ${d.total_citas} cita(s)${sinVet ? `, ${sinVet} por asignar` : ''}${domingo ? ', clínica cerrada' : ''}`}
            aria-pressed={d.fecha === seleccionado}
          >
            <span className="cm-num">{num}</span>
            {d.total_citas > 0 && <span className="cm-cuenta">{d.total_citas}</span>}
            {sinVet > 0 && <span className="cm-asignar" title={`${sinVet} cita(s) por asignar`}>{sinVet} por asignar</span>}
            {!domingo && cupo > 0 && <span className="cm-barra"><i style={{ width: `${pct}%` }} /></span>}
          </button>
        );
      })}
    </div>
  );
}
