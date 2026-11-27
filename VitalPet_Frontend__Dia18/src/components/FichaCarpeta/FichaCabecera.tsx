// =================================================================
// Archivo: src/components/FichaCarpeta/FichaCabecera.tsx
// RESPONSABILIDAD: Parte de arriba de la ficha, siempre visible: quién es
// el paciente, quién es su dueño y cuatro datos clave de un vistazo
// (última consulta, próxima cita, pendientes y peso).
// =================================================================
import { Link } from 'react-router-dom';
import FotoMascota from '../FotoMascota/FotoMascota';
import type { FichaPaciente } from '../../services/fichaService';
import { capitalizar } from '../AgendaVet/fechas';
import './FichaCarpeta.css';

export interface ProximaCita {
  fechaHora: string;
  franja?: string | null;
  nombre_veterinario?: string | null;
}

interface Props {
  ficha: FichaPaciente;
  proximaCita: ProximaCita | null;
  vacunasAtrasadas: number;
  examenesPendientes: number;
  autorizacionIncompleta: boolean;
  onEmitirCertificado: () => void;
}

const fechaCorta = (v?: string | null) =>
  v ? capitalizar(new Date(v).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' }).replace('.', '')) : '—';

function edadTexto(nacimiento?: string | null): string {
  if (!nacimiento) return '';
  const n = new Date(nacimiento);
  if (isNaN(n.getTime())) return '';
  const meses = (new Date().getFullYear() - n.getFullYear()) * 12 + (new Date().getMonth() - n.getMonth());
  if (meses < 1) return 'menos de 1 mes';
  if (meses < 24) return `${meses} mes${meses === 1 ? '' : 'es'}`;
  return `${Math.floor(meses / 12)} años`;
}

export default function FichaCabecera({
  ficha, proximaCita, vacunasAtrasadas, examenesPendientes, autorizacionIncompleta, onEmitirCertificado,
}: Props) {
  const { mascota: m, dueno: d, resumen: r } = ficha;
  const pendientes = vacunasAtrasadas + examenesPendientes;
  const detalles = [m.especie, m.raza, m.sexo, m.color].filter(Boolean).join(' · ');
  const edad = edadTexto(m.fechaNacimiento);

  return (
    <header className="fc-cabecera">
      <Link to="/admin/pacientes" className="fc-volver"><i className="ti ti-arrow-left" /> Pacientes</Link>

      <div className="fc-fila-principal">
        <FotoMascota mascota={m} tamano={72} forma="redondeado" />

        <div className="fc-identidad">
          <h1 className="fc-nombre">{m.nombre_mascota}</h1>
          <div className="fc-detalles">{detalles}{edad && ` · ${edad}`}</div>
          {d && (
            <div className="fc-dueno">
              <i className="ti ti-user" /> <strong>{`${d.nombre} ${d.apellido || ''}`.trim()}</strong>
              {d.telefono && <> · <a href={`tel:${d.telefono}`}>{d.telefono}</a></>}
              {d.email && <> · {d.email}</>}
            </div>
          )}
          {autorizacionIncompleta && (
            <div className="fc-aviso">
              <i className="ti ti-alert-triangle" /> El dueño es adulto mayor y le falta completar acudiente o consentimiento.
            </div>
          )}
        </div>

        <button type="button" className="av-btn primario fc-accion" onClick={onEmitirCertificado}>
          <i className="ti ti-certificate" /> Emitir certificado
        </button>
      </div>

      <div className="fc-datos">
        <div className="fc-dato">
          <span className="fc-dato-et">Última consulta</span>
          <span className="fc-dato-val">{r.ultima_consulta ? fechaCorta(r.ultima_consulta) : 'Sin consultas'}</span>
        </div>
        <div className="fc-dato">
          <span className="fc-dato-et">Próxima cita</span>
          {proximaCita ? (
            <span className="fc-dato-val">
              {fechaCorta(proximaCita.fechaHora)}{proximaCita.franja ? ` · ${proximaCita.franja}` : ''}
            </span>
          ) : (
            <span className="fc-dato-val tenue">Sin cita próxima</span>
          )}
        </div>
        <div className={`fc-dato ${pendientes ? 'atencion' : 'ok'}`}>
          <span className="fc-dato-et">Pendientes</span>
          <span className="fc-dato-val">
            {pendientes ? `${pendientes} por atender` : 'Todo al día'}
          </span>
        </div>
        <div className="fc-dato">
          <span className="fc-dato-et">Peso</span>
          <span className="fc-dato-val">{r.peso_actual != null ? `${r.peso_actual} kg` : '—'}</span>
        </div>
      </div>
    </header>
  );
}