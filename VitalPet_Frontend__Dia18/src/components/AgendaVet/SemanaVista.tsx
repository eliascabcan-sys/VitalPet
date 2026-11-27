// =================================================================
// Archivo: src/components/AgendaVet/SemanaVista.tsx
// RESPONSABILIDAD: Vista de la semana como tablero: una fila por día y una
// columna por franja (Mañana | Tarde). En cada celda se ve qué tan llena
// está y quiénes vienen. Tocar un día abre su detalle.
// =================================================================
import type { Agenda } from '../../services/citasService';
import { esDomingo, hhmm } from './fechas';

interface Props {
  agenda: Agenda;
  hoy: string;
  porAsignar: Record<string, number>; // 'AAAA-MM-DD' -> cuántas citas sin veterinario
  onIrADia: (iso: string) => void;
}

const MAX_PILLS = 3;

export default function SemanaVista({ agenda, hoy, porAsignar, onIrADia }: Props) {
  // Las columnas salen de las franjas configuradas (el primer día que tenga alguna).
  const columnas = (agenda.dias.find((d) => d.franjas.length > 0)?.franjas ?? []).map((f) => ({
    id: f.idFranja, nombre: f.nombre, inicio: f.hora_inicio, fin: f.hora_fin,
  }));
  const plantilla = { gridTemplateColumns: `104px repeat(${Math.max(columnas.length, 1)}, minmax(0, 1fr))` };

  return (
    <div className="av-semana" role="table" aria-label="Citas de la semana">
      <div className="av-semana-fila av-semana-enc" role="row" style={plantilla}>
        <div role="columnheader" />
        {columnas.map((c) => (
          <div key={c.id} role="columnheader" className="av-semana-col">
            {c.nombre} <span>{hhmm(c.inicio)} – {hhmm(c.fin)}</span>
          </div>
        ))}
      </div>

      {agenda.dias.map((d) => {
        const domingo = esDomingo(d.fecha);
        const fecha = new Date(`${d.fecha}T00:00:00`);
        const sinAsignar = porAsignar[d.fecha] || 0;
        return (
          <div
            key={d.fecha}
            role="row"
            style={plantilla}
            className={`av-semana-fila av-semana-dia${d.fecha === hoy ? ' hoy' : ''}${domingo ? ' cerrado' : ''}`}
            onClick={() => onIrADia(d.fecha)}
          >
            <div role="rowheader" className="av-semana-etq">
              <button type="button" onClick={() => onIrADia(d.fecha)} aria-label={`Ver el día ${d.fecha}`}>
                <span className="av-dia-nombre">{fecha.toLocaleDateString('es-CO', { weekday: 'short' }).replace('.', '')}</span>
                <span className="av-dia-num">{fecha.getDate()}</span>
              </button>
              {domingo && <small>Cerrado</small>}
              {sinAsignar > 0 && <small className="av-por-asignar">{sinAsignar} por asignar</small>}
            </div>

            {columnas.map((col) => {
              const f = d.franjas.find((x) => x.idFranja === col.id);
              if (!f || domingo) return <div key={col.id} role="cell" className="av-celda vacia">—</div>;
              const pct = f.cupo_maximo ? Math.min(100, Math.round((f.cupos_usados / f.cupo_maximo) * 100)) : 0;
              const nivel = pct >= 100 ? 'lleno' : pct >= 60 ? 'alto' : 'libre';
              return (
                <div key={col.id} role="cell" className="av-celda">
                  <div className="av-celda-cab">
                    <span>{f.cupos_usados}/{f.cupo_maximo}</span>
                    <span className="av-mini-barra"><i className={nivel} style={{ width: `${pct}%` }} /></span>
                  </div>
                  <div className="av-pills">
                    {f.citas.slice(0, MAX_PILLS).map((c) => (
                      <span key={c.idCita} className={`av-pill ${c.estado}`} title={`${c.nombre_mascota} — ${c.nombre_dueno || ''}`}>
                        {c.nombre_mascota || `#${c.idMascota}`}
                      </span>
                    ))}
                    {f.citas.length > MAX_PILLS && <span className="av-pill mas">+{f.citas.length - MAX_PILLS}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}