// =================================================================
// Archivo: src/components/FichaCarpeta/FichaResumen.tsx
// RESPONSABILIDAD: Pestaña "Resumen" de la ficha: lo que necesita atención
// ahora (vacunas atrasadas, exámenes sin entregar, autorización del dueño),
// la última consulta y la evolución del peso. Cada aviso lleva a su pestaña.
// =================================================================
import type { EsquemaSanitario } from '../../services/esquemaSanitarioService';
import type { EstadoAutorizacion } from '../../services/autorizacionesService';
import type { FichaPaciente } from '../../services/fichaService';
import { ETIQUETA_ESTADO_EXAMEN } from '../../services/laboratorioService';
import type { EstadoExamen } from '../../services/laboratorioService';
import PesoControles from '../PesoControles/PesoControles';
import './FichaCarpeta.css';

interface Props {
  ficha: FichaPaciente;
  esquema: EsquemaSanitario | null;
  autorizacion: EstadoAutorizacion | null;
  onIr: (pestana: string) => void;
}

const fecha = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

interface Aviso { clave: string; icono: string; titulo: string; detalle: string; ir?: string }  // sin 'ir' = solo informa

export default function FichaResumen({ ficha, esquema, autorizacion, onIr }: Props) {
  const avisos: Aviso[] = [];

  (esquema?.items ?? [])
    .filter((i) => i.estado === 'vencida' && !i.opcional)
    .forEach((i) => avisos.push({ clave: `v-${i.clave}`, icono: 'ti-vaccine', titulo: i.nombre, detalle: i.mensaje, ir: 'sanitario' }));

  ficha.laboratorio
    .filter((e) => e.estado === 'solicitado' || e.estado === 'en_proceso')
    .forEach((e) => avisos.push({
      clave: `e-${e.idExamen}`, icono: 'ti-flask', titulo: e.tipo_examen,
      detalle: ETIQUETA_ESTADO_EXAMEN[e.estado as EstadoExamen] || e.estado, ir: 'laboratorio',
    }));

  if (autorizacion?.requiere_autorizacion && !autorizacion.completa) {
    avisos.push({
      clave: 'autorizacion', icono: 'ti-shield-exclamation', titulo: 'Autorización del dueño (adulto mayor)',
      detalle: autorizacion.pendientes.join(' '),
    });
  }

  const ultima = ficha.controles[0];
  const control = ficha.cita_control;

  return (
    <div className="fc-resumen">
      <section className="fc-tarjeta">
        <h2 className="fc-tarjeta-tit">Requiere atención</h2>
        {avisos.length === 0 ? (
          <p className="fc-ok"><i className="ti ti-circle-check" /> Sin pendientes: esquema al día y sin exámenes por entregar.</p>
        ) : (
          <ul className="fc-avisos">
            {avisos.map((a) => {
              const contenido = (
                <>
                  <i className={`ti ${a.icono}`} />
                  <span><strong>{a.titulo}</strong><small>{a.detalle}</small></span>
                  {a.ir && <i className="ti ti-chevron-right fc-flecha" />}
                </>
              );
              return (
                <li key={a.clave}>
                  {a.ir
                    ? <button type="button" onClick={() => onIr(a.ir as string)}>{contenido}</button>
                    : <div className="fc-aviso-info">{contenido}</div>}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="fc-tarjeta">
        <h2 className="fc-tarjeta-tit">Última consulta</h2>
        {ultima ? (
          <>
            <p className="fc-linea"><strong>{fecha(ultima.fecha)}</strong>{ultima.motivo_consulta ? ` — ${ultima.motivo_consulta}` : ''}</p>
            {ultima.diagnostico && <p className="fc-linea"><span className="fc-et">Diagnóstico:</span> {ultima.diagnostico}</p>}
            {ultima.nombre_veterinario && <p className="fc-linea"><span className="fc-et">Atendió:</span> {ultima.nombre_veterinario}</p>}
            <button type="button" className="av-btn" onClick={() => onIr('consultas')}>Ver todas las consultas</button>
          </>
        ) : (
          <p className="fc-vacio">Aún no hay consultas registradas.</p>
        )}
        {control && (
          <p className="fc-control">
            <i className="ti ti-calendar-event" /> Cita de control: <strong>{fecha(control.fechaHora)}</strong>
            {control.franja_nombre ? ` · ${control.franja_nombre}` : ''}
            {control.nombre_veterinario ? ` · con ${control.nombre_veterinario}` : ' · veterinario por asignar'}
          </p>
        )}
      </section>

      <section className="fc-tarjeta fc-ancha">
        <h2 className="fc-tarjeta-tit">Peso</h2>
        <PesoControles idMascota={ficha.mascota.idMascota} />
      </section>
    </div>
  );
}