// =================================================================
// Archivo: src/components/MascotaCard/MascotaCard.tsx
// RESPONSABILIDAD: Tarjeta de una mascota (usada en el dashboard y en
// "Mis mascotas"). Solo el botón "Abrir carpeta" abre la carpeta; la foto se puede cambiar sin navegar. Si se le
// pasan "proximaCita" y "pendientes", muestra de un vistazo cómo está.
// =================================================================
import { Link } from 'react-router-dom';
import type { Mascota } from '../../services/mascotasService';
import FotoMascota from '../FotoMascota/FotoMascota';
import './MascotaCard.css';

interface Props {
  mascota: Mascota;
  proximaCita?: string | null; // texto ya armado ("Vie 24 oct · Mañana"); null = sin cita
  pendientes?: number;         // vacunas atrasadas + exámenes por entregar
}

export default function MascotaCard({ mascota, proximaCita, pendientes }: Props) {
  const conIndicadores = proximaCita !== undefined || pendientes !== undefined;

  let edadTexto = 'Edad desconocida';
  if (mascota.fechaNacimiento) {
    const años = new Date().getFullYear() - new Date(mascota.fechaNacimiento).getFullYear();
    edadTexto = años > 0 ? `${años} año${años > 1 ? 's' : ''}` : 'Menos de 1 año';
  }

  return (
    <div className="mascota-card">
      <div className="mascota-avatar"><FotoMascota mascota={mascota} tamano="xl" editable /></div>
      <div className="mascota-nombre">{mascota.nombre_mascota}</div>
      <div className="mascota-especie">
        {mascota.especie}
        {mascota.raza ? ` · ${mascota.raza}` : ''}
      </div>
      <div className="mascota-dato">
        <i className="ti ti-calendar" style={{ fontSize: 14 }} /> {edadTexto}
      </div>

      {conIndicadores && (
        <div className="mascota-chips">
          {pendientes !== undefined && (
            <span className={`mascota-chip ${pendientes > 0 ? 'atencion' : 'ok'}`}>
              {pendientes > 0 ? `${pendientes} por atender` : 'Todo al día'}
            </span>
          )}
          {proximaCita !== undefined && (
            <span className={`mascota-chip ${proximaCita ? 'cita' : 'sin'}`}>
              {proximaCita ?? 'Sin cita próxima'}
            </span>
          )}
        </div>
      )}

      <Link
        to={`/dueno/mascotas/${mascota.idMascota}`}
        className="btn-historial"
        title={`Abrir la carpeta de ${mascota.nombre_mascota}`}
      >
        <i className="ti ti-folder-open" style={{ fontSize: 14 }} /> Abrir carpeta
      </Link>
    </div>
  );
}