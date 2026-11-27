// =================================================================
// Archivo: src/components/AgendaVet/CitaItem.tsx
// RESPONSABILIDAD: Una cita dentro de la agenda: paciente, dueño, motivo,
// estado y acceso directo a la ficha (la "carpeta" del paciente).
// =================================================================
import { useNavigate } from 'react-router-dom';
import type { CitaAgenda } from '../../services/citasService';
import { horaDeLaCita } from './fechas';

const ETIQUETA_ESTADO: Record<string, string> = {
  pendiente: 'Pendiente',
  confirmada: 'Confirmada',
  completada: 'Completada',
  cancelada: 'Cancelada',
};

export default function CitaItem({ cita }: { cita: CitaAgenda }) {
  const navigate = useNavigate();
  const conHoraExacta = cita.idFranja == null; // si no es por franja, sí tiene hora exacta

  return (
    <div className={`av-cita ${cita.estado}`}>
      <div className="av-cita-cuerpo">
        <div className="av-cita-nombre">
          {cita.nombre_mascota || `Mascota #${cita.idMascota}`}
          {cita.especie && <span className="av-cita-especie"> · {cita.especie}</span>}
          {cita.canal_contacto === 'urgente' && <span className="av-urgente">Urgente</span>}
        </div>
        <div className="av-cita-detalle">
          {cita.nombre_dueno || 'Sin dueño'}
          {cita.motivo ? ` — ${cita.motivo}` : ''}
          {conHoraExacta ? ` · ${horaDeLaCita(cita.fechaHora)}` : ''}
        </div>
      </div>
      <div className="av-cita-acciones">
        <span className={`chip ${cita.estado}`}>{ETIQUETA_ESTADO[cita.estado] ?? cita.estado}</span>
        <button type="button" className="av-btn" onClick={() => navigate(`/admin/ficha/${cita.idMascota}`)}>
          Abrir ficha
        </button>
      </div>
    </div>
  );
}