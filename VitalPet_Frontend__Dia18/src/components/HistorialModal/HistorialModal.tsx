// =================================================================
// Archivo: src/components/HistorialModal/HistorialModal.tsx
// RESPONSABILIDAD: Modal que muestra el historial clínico de una
// mascota. Migrado de verHistorial()/cerrarModal() en dueno.js.
// Se abre pasándole un idMascota (o null para cerrado).
// =================================================================
import { useEffect, useState } from 'react';
import { historialService } from '../../services/historialService';
import type { RegistroHistorial } from '../../services/historialService';
import HistoriaHoja from '../HistoriaHoja/HistoriaHoja';

interface Props {
  idMascota: number | null;
  nombreMascota: string;
  onClose: () => void;
}

function fechaValida(fechaStr?: string): Date | null {
  if (!fechaStr) return null;
  const f = new Date(fechaStr);
  return isNaN(f.getTime()) ? null : f;
}

export default function HistorialModal({ idMascota, nombreMascota, onClose }: Props) {
  const [registros, setRegistros] = useState<RegistroHistorial[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(false);
  const [sel, setSel] = useState<number | null>(null);

  useEffect(() => {
    if (idMascota === null) return;

    setCargando(true);
    setError(false);
    historialService
      .porMascota(idMascota)
      .then((data) => {
        const activos = (data || [])
          .filter((h) => h.estado === 'activo')
          .sort((a, b) => {
            const fa = fechaValida(a.fechaRegistro);
            const fb = fechaValida(b.fechaRegistro);
            if (!fa && !fb) return 0;
            if (!fa) return 1;
            if (!fb) return -1;
            return fb.getTime() - fa.getTime();
          });
        setRegistros(activos);
      })
      .catch(() => setError(true))
      .finally(() => setCargando(false));
  }, [idMascota]);

  if (idMascota === null) return null;

  const seleccionado = registros.find((r) => r.idHistorial === sel) ?? registros[0];

  return (
    <div className="modal-bg open">
      <div className="hh-modal">
        <div className="hh-header">
          <span>Historial de {nombreMascota}</span>
          <button className="close-btn" onClick={onClose} aria-label="Cerrar">
            <i className="ti ti-x" />
          </button>
        </div>

        {cargando && <p style={{ padding: 20, fontSize: 14 }}>Cargando...</p>}
        {!cargando && error && <div className="hist-vacio">Error al cargar historial.</div>}
        {!cargando && !error && !registros.length && <div className="hist-vacio">Sin registros de historial aún.</div>}

        {!cargando && !error && seleccionado && (
          <>
            {registros.length > 1 && (
              <div style={{ padding: '8px 20px', borderBottom: '1px solid #e3e8ec', fontSize: 14 }}>
                <label>
                  Consulta:{' '}
                  <select value={seleccionado.idHistorial} onChange={(e) => setSel(Number(e.target.value))}>
                    {registros.map((r) => {
                      const f = fechaValida(r.fechaRegistro);
                      return (
                        <option key={r.idHistorial} value={r.idHistorial}>
                          {f ? f.toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' }) : `#${r.idHistorial}`}
                          {r.motivo_consulta ? ` — ${r.motivo_consulta}` : ''}
                        </option>
                      );
                    })}
                  </select>
                </label>
              </div>
            )}
            <HistoriaHoja key={seleccionado.idHistorial} registro={seleccionado} />
          </>
        )}
      </div>
    </div>
  );
}
