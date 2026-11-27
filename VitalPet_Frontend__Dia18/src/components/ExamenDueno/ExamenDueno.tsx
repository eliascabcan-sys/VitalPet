// =================================================================
// Archivo: src/components/ExamenDueno/ExamenDueno.tsx
// RESPONSABILIDAD: Un examen de laboratorio visto por el dueño (solo lectura).
// El resultado se muestra cuando el laboratorio lo entrega; antes solo se
// avisa que está pendiente. Lo usan "Laboratorio" y la carpeta de la mascota.
// =================================================================
import { CATEGORIAS_EXAMEN, ETIQUETA_ESTADO_EXAMEN } from '../../services/laboratorioService';
import type { ExamenLaboratorio } from '../../services/laboratorioService';
import '../LaboratorioPanel/LaboratorioPanel.css';

const etiquetaCategoria = (c: string) => CATEGORIAS_EXAMEN.find((x) => x.valor === c)?.etiqueta ?? c;
const fecha = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

interface Props {
  examen: ExamenLaboratorio;
  mostrarMascota?: boolean; // en la carpeta de una mascota no hace falta repetir su nombre
}

export default function ExamenDueno({ examen: e, mostrarMascota = true }: Props) {
  return (
    <div className={`lab-item ${e.estado}`}>
      <div className="lab-item-cab">
        <div>
          <div className="lab-nombre">
            {e.tipo_examen}{mostrarMascota ? ` — ${e.nombre_mascota || 'Mascota'}` : ''}
          </div>
          <div className="lab-meta">
            {etiquetaCategoria(e.categoria)} · Solicitado {fecha(e.fecha_solicitud)}
            {e.fecha_resultado ? ` · Entregado ${fecha(e.fecha_resultado)}` : ''}
          </div>
        </div>
        <span className={`lab-estado ${e.estado}`}>{ETIQUETA_ESTADO_EXAMEN[e.estado] ?? e.estado}</span>
      </div>

      {e.observaciones && <p className="lab-obs">{e.observaciones}</p>}

      {e.estado === 'entregado' ? (
        <div className="lab-resultado">
          {e.resultado && <p className="lab-texto">{e.resultado}</p>}
          {!!e.valores?.length && (
            <div className="lab-tabla-wrap">
              <table className="lab-tabla">
                <thead><tr><th>Parámetro</th><th>Valor</th><th>Unidad</th><th>Referencia</th></tr></thead>
                <tbody>
                  {e.valores.map((v, i) => (
                    <tr key={i}><td>{v.parametro}</td><td>{v.valor}</td><td>{v.unidad || '—'}</td><td>{v.referencia || '—'}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {e.archivo_url && /^https?:\/\//i.test(e.archivo_url) && (
            <a className="lab-enlace" href={e.archivo_url} target="_blank" rel="noopener noreferrer">
              <i className="ti ti-file-download" /> Ver archivo del resultado
            </a>
          )}
        </div>
      ) : (
        <p className="lab-pendiente"><i className="ti ti-clock" /> El resultado estará disponible cuando el laboratorio lo entregue.</p>
      )}
    </div>
  );
}