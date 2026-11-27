// =================================================================
// Archivo: src/pages/DuenoHistorialPage/DuenoHistorialPage.tsx
// RESPONSABILIDAD: Selector de mascota + su historial clínico. El contenido
// (peso, filtro por días, registros) vive en HistorialMascota, que también
// se usa en la carpeta de la mascota.
// =================================================================
import { useEffect, useState } from 'react';
import { mascotasService } from '../../services/mascotasService';
import type { Mascota } from '../../services/mascotasService';
import HistorialMascota from '../../components/HistorialMascota/HistorialMascota';
import '../../assets/css/dueno.css';
import { useToast } from '../../components/Toast/ToastContext';

export default function DuenoHistorialPage() {
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
          <div className="page-title">Historial clínico</div>
          <div className="page-sub">Selecciona una mascota para ver sus registros clínicos.</div>
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <label className="form-label">Ver historial de:</label>
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
        <HistorialMascota idMascota={Number(idSeleccionada)} />
      ) : (
        <div className="vacio">
          <i className="ti ti-clipboard-list" />
          Selecciona una mascota para ver su historial.
        </div>
      )}
    </section>
  );
}