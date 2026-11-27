// =================================================================
// Archivo: src/components/AgendaVet/PorAsignarPanel.tsx
// RESPONSABILIDAD: Panel fijo con TODAS las citas que aún no tienen
// veterinario (las urgentes primero). Desde aquí se asignan o confirman sin
// buscar en la agenda, y "Ver día" salta a la fecha de esa cita.
// =================================================================
import type { CitaAgenda } from '../../services/citasService';
import { aISO, capitalizar, diaCorto, franjaDeLaCita, horaDeLaCita } from './fechas';

interface Props {
  citas: CitaAgenda[];
  onAsignar: (cita: CitaAgenda, confirmar: boolean) => void;
  onIrADia: (iso: string) => void;
}

export default function PorAsignarPanel({ citas, onAsignar, onIrADia }: Props) {
  // Urgentes primero y luego por fecha: lo que no puede esperar queda arriba.
  const ordenadas = [...citas].sort((a, b) => {
    const ua = a.canal_contacto === 'urgente' ? 0 : 1;
    const ub = b.canal_contacto === 'urgente' ? 0 : 1;
    return ua - ub || a.fechaHora.localeCompare(b.fechaHora);
  });

  return (
    <aside className="av-panel" aria-label="Citas por asignar">
      <header className="av-panel-cab">
        <span>Por asignar</span>
        <span className={`av-contador${citas.length ? ' hay' : ''}`}>{citas.length}</span>
      </header>

      {ordenadas.length === 0 ? (
        <p className="av-vacio av-panel-vacio">
          <i className="ti ti-circle-check" /> No hay citas por asignar. Todo al día.
        </p>
      ) : (
        <div className="av-panel-lista">
          {ordenadas.map((c) => {
            const dia = aISO(new Date(c.fechaHora));
            return (
              <div key={c.idCita} className="av-pa-item">
                <div className="av-cita-nombre">
                  {c.nombre_mascota || `Mascota #${c.idMascota}`}
                  {c.especie && <span className="av-cita-especie"> · {c.especie}</span>}
                  {c.canal_contacto === 'urgente' && <span className="av-urgente">Urgente</span>}
                </div>
                <div className="av-cita-detalle">
                  {c.nombre_dueno || 'Sin dueño'}
                  {c.motivo ? ` — ${c.motivo}` : ''}
                </div>
                <div className="av-pa-cuando">
                  {capitalizar(diaCorto(dia))} · {c.idFranja == null ? horaDeLaCita(c.fechaHora) : franjaDeLaCita(c.fechaHora)}
                </div>
                <div className="av-pa-botones">
                  <button type="button" className="av-btn" onClick={() => onIrADia(dia)}>Ver día</button>
                  <button type="button" className="av-btn" onClick={() => onAsignar(c, false)}>Asignar</button>
                  <button type="button" className="av-btn primario" onClick={() => onAsignar(c, true)}>Confirmar</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
}