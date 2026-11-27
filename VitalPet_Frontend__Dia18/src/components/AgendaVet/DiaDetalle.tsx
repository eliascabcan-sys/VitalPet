// =================================================================
// Archivo: src/components/AgendaVet/DiaDetalle.tsx
// RESPONSABILIDAD: El detalle de UN día: una tarjeta por franja (Mañana,
// Tarde...) con sus cupos y las citas asignadas, más las citas con hora
// exacta. Lo usan la vista "Día" y la vista "Mes" (al elegir un día).
// =================================================================
import type { AgendaDia, AgendaFranja } from '../../services/citasService';
import CitaItem from './CitaItem';
import { aISO, esDomingo, hhmm } from './fechas';

// 'pasado' = el día ya terminó: el aviso "la fecha ya pasó" sobra, así que no se muestra.
function Franja({ franja, pasado }: { franja: AgendaFranja; pasado: boolean }) {
  // Estado de cada cupo ocupado, según la cita (las canceladas no cuentan)
  const estadosCupos = franja.citas
    .filter((c) => c.estado !== 'cancelada')
    .map((c) => (c.estado === 'pendiente' ? 'pendiente' : 'asignada'));

  return (
    <section className="av-franja">
      <header className="av-franja-cab">
        <div>
          <span className="av-franja-nombre">{franja.nombre}</span>
          <span className="av-franja-horas"> {hhmm(franja.hora_inicio)} – {hhmm(franja.hora_fin)}</span>
        </div>
        <div className="av-franja-cupos">
          <strong>{franja.cupos_usados}/{franja.cupo_maximo}</strong>{' '}
          {franja.cupos_disponibles > 0 ? `· ${franja.cupos_disponibles} libres` : '· Llena'}
        </div>
      </header>
      {/* Una casilla por cupo: las pintadas son cupos ocupados por una cita asignada. */}
      <div
        className="av-cupos"
        role="img"
        aria-label={`${franja.cupos_usados} de ${franja.cupo_maximo} cupos ocupados`}
      >
        {Array.from({ length: Math.min(franja.cupo_maximo, 24) }, (_, i) => {
          const estado = estadosCupos[i] ?? (i < franja.cupos_usados ? 'asignada' : '');
          return <i key={i} className={estado ? `ocupado ${estado}` : ''} />;
        })}
      </div>
      {franja.cupos_usados > 0 && (
        <p className="av-ocupados">
          {franja.cupos_usados === 1 ? '1 cupo ocupado' : `${franja.cupos_usados} cupos ocupados`}
        </p>
      )}
      {!pasado && !franja.disponible && franja.cupos_disponibles > 0 && franja.motivo_no_disponible && (
        <p className="av-nota">{franja.motivo_no_disponible}</p>
      )}
      {franja.citas.length === 0 ? (
        <p className="av-vacio">Sin citas asignadas en esta franja.</p>
      ) : (
        <div className="av-citas">
          {franja.citas.map((c) => <CitaItem key={c.idCita} cita={c} />)}
        </div>
      )}
    </section>
  );
}

export default function DiaDetalle({ dia }: { dia: AgendaDia }) {
  const hayCitas = dia.franjas.some((f) => f.citas.length > 0) || dia.citas_hora_exacta.length > 0;
  const sinNada = dia.franjas.length === 0 && dia.citas_hora_exacta.length === 0;
  const pasado = dia.fecha < aISO(new Date());

  // Domingo sin ninguna cita = clínica cerrada (así coincide con la vista Semana y la de Mes).
  if (sinNada || (esDomingo(dia.fecha) && !hayCitas)) {
    return (
      <div className="av-cerrado">
        <i className="ti ti-moon" />
        {esDomingo(dia.fecha) ? 'La clínica está cerrada los domingos.' : 'No hay franjas configuradas para este día.'}
      </div>
    );
  }

  return (
    <div className="av-dia">
      {dia.franjas.map((f) => <Franja key={f.idFranja} franja={f} pasado={pasado} />)}
      {dia.citas_hora_exacta.length > 0 && (
        <section className="av-franja">
          <header className="av-franja-cab">
            <span className="av-franja-nombre">Con hora exacta</span>
          </header>
          <div className="av-citas">
            {dia.citas_hora_exacta.map((c) => <CitaItem key={c.idCita} cita={c} />)}
          </div>
        </section>
      )}
    </div>
  );
}