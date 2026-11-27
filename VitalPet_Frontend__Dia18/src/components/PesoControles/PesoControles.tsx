import { useEffect, useState } from 'react';
import { historialService } from '../../services/historialService';
import type { PesoControl } from '../../services/historialService';

export default function PesoControles({ idMascota }: { idMascota: number }) {
  const [pesos, setPesos] = useState<PesoControl[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!idMascota) { setPesos([]); return; }
    setError(false);
    historialService.pesos(idMascota).then(setPesos).catch(() => setError(true));
  }, [idMascota]);

  if (!idMascota) return null;
  if (error) return <p style={{ fontSize: 14 }}>No se pudo cargar el peso de los controles.</p>;
  if (!pesos.length) return <p style={{ fontSize: 14 }}>Aún no hay pesos registrados en los controles.</p>;

  return (
    <div style={{ margin: '8px 0 16px', fontSize: 14 }}>
      <strong><i className="ti ti-weight" /> Peso en cada control</strong>
      <table style={{ width: '100%', marginTop: 6, borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left' }}><th>Fecha</th><th>Peso</th><th>Cambio</th></tr>
        </thead>
        <tbody>
          {pesos.map((p, i) => {
            const dif = i > 0 ? Number(p.peso_kg) - Number(pesos[i - 1].peso_kg) : null;
            return (
              <tr key={p.idHistorial}>
                <td>{new Date(p.fecha).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                <td>{Number(p.peso_kg)} kg</td>
                <td>{dif === null ? '—' : `${dif > 0 ? '+' : ''}${dif.toFixed(2)} kg`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}