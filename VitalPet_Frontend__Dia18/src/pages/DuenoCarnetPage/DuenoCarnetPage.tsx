// =================================================================
// Archivo: src/pages/DuenoCarnetPage/DuenoCarnetPage.tsx
// RESPONSABILIDAD: Selector de mascota + su certificación de vacunación. El
// contenido (esquema sanitario y aplicaciones) vive en CertificacionVacunacion,
// que también se usa en la carpeta de la mascota.
// =================================================================
import { useEffect, useState } from 'react';
import { mascotasService } from '../../services/mascotasService';
import type { Mascota } from '../../services/mascotasService';
import CertificacionVacunacion from '../../components/CertificacionVacunacion/CertificacionVacunacion';
import '../../assets/css/dueno.css';
import { useToast } from '../../components/Toast/ToastContext';

export default function DuenoCarnetPage() {
  const [mascotas, setMascotas] = useState<Mascota[]>([]);
  const [idSeleccionada, setIdSeleccionada] = useState('');
  const { mostrarToast } = useToast();

  useEffect(() => {
    mascotasService
      .mias()
      .then((data) => setMascotas(data.filter((m) => m.estado === 'activo')))
      .catch(() => mostrarToast('No se pudieron cargar tus mascotas.', 'error'));
  }, []);

  return (
    <section className="section active">
      <div className="section-header">
        <div>
          <div className="page-title">Certificación de vacunación</div>
          <div className="page-sub">Selecciona una mascota para ver su certificación de vacunación.</div>
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <label className="form-label">Ver certificación de:</label>
        <select
          className="form-input"
          style={{ maxWidth: 260 }}
          value={idSeleccionada}
          onChange={(e) => setIdSeleccionada(e.target.value)}
        >
          <option value="">Selecciona una mascota...</option>
          {mascotas.map((m) => (
            <option key={m.idMascota} value={m.idMascota}>
              {m.nombre_mascota}
            </option>
          ))}
        </select>
      </div>

      {idSeleccionada ? (
        <CertificacionVacunacion idMascota={Number(idSeleccionada)} />
      ) : (
        <div className="vacio">
          <i className="ti ti-vaccine" />
          Selecciona una mascota.
        </div>
      )}
    </section>
  );
}