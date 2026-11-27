// =================================================================
// Archivo: src/pages/DuenoLaboratorioPage/DuenoLaboratorioPage.tsx
// RESPONSABILIDAD: Laboratorio del dueño. Todos los exámenes de TODAS sus
// mascotas en una sola pantalla, solo lectura. Filtros por mascota, estado
// y días (guardados en la URL). El resultado se ve cuando el laboratorio
// lo entrega; antes solo se muestra que está pendiente.
// =================================================================
import { useEffect, useMemo, useState } from 'react';
import { ETIQUETA_ESTADO_EXAMEN, laboratorioService } from '../../services/laboratorioService';
import type { EstadoExamen, ExamenLaboratorio } from '../../services/laboratorioService';
import FiltroDias from '../../components/FiltroDias/FiltroDias';
import ExamenDueno from '../../components/ExamenDueno/ExamenDueno';
import EmptyState from '../../components/EmptyState/EmptyState';
import Skeleton from '../../components/Skeleton/Skeleton';
import { useToast } from '../../components/Toast/ToastContext';
import { useFiltrosURL } from '../../hooks/useFiltrosURL';
import { dentroDeDias } from '../../utils/fechas';
import '../../assets/css/dueno.css';
import '../../components/LaboratorioPanel/LaboratorioPanel.css';

const FILTROS = { mascota: '', estado: '', dias: '' };

export default function DuenoLaboratorioPage() {
  const { mostrarToast } = useToast();
  const { filtros, setFiltro, limpiar, hayFiltros } = useFiltrosURL(FILTROS);
  const [examenes, setExamenes] = useState<ExamenLaboratorio[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  async function cargar() {
    setCargando(true);
    setError('');
    try {
      setExamenes(await laboratorioService.mias());
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudieron cargar tus exámenes.';
      setError(msg);
      mostrarToast(msg, 'error');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Mascotas que tienen exámenes (para el selector)
  const mascotas = useMemo(() => {
    const mapa = new Map<number, string>();
    examenes.forEach((e) => mapa.set(e.idMascota, e.nombre_mascota || `Mascota ${e.idMascota}`));
    return [...mapa.entries()].sort((a, b) => a[1].localeCompare(b[1], 'es'));
  }, [examenes]);

  const visibles = useMemo(
    () => examenes
      .filter((e) => !filtros.mascota || String(e.idMascota) === filtros.mascota)
      .filter((e) => !filtros.estado || e.estado === filtros.estado)
      .filter((e) => dentroDeDias(e.fecha_solicitud, filtros.dias))
      .sort((a, b) => new Date(b.fecha_solicitud ?? 0).getTime() - new Date(a.fecha_solicitud ?? 0).getTime()),
    [examenes, filtros.mascota, filtros.estado, filtros.dias],
  );

  const pendientes = examenes.filter((e) => e.estado === 'solicitado' || e.estado === 'en_proceso').length;

  return (
    <section className="section active">
      <div className="section-header">
        <div>
          <div className="page-title">Laboratorio</div>
          <div className="page-sub">
            Exámenes de tus mascotas. {pendientes > 0 ? `${pendientes} pendiente${pendientes === 1 ? '' : 's'} de entrega.` : 'Aquí aparecen los resultados cuando el laboratorio los entrega.'}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div>
          <label className="form-label" htmlFor="lab-mascota">Mascota</label>
          <select id="lab-mascota" className="form-input" style={{ minWidth: 180 }}
            value={filtros.mascota} onChange={(e) => setFiltro('mascota', e.target.value)}>
            <option value="">Todas</option>
            {mascotas.map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label" htmlFor="lab-estado">Estado</label>
          <select id="lab-estado" className="form-input" style={{ minWidth: 160 }}
            value={filtros.estado} onChange={(e) => setFiltro('estado', e.target.value)}>
            <option value="">Todos</option>
            {(Object.keys(ETIQUETA_ESTADO_EXAMEN) as EstadoExamen[]).filter((s) => s !== 'cancelado').map((s) => (
              <option key={s} value={s}>{ETIQUETA_ESTADO_EXAMEN[s]}</option>
            ))}
          </select>
        </div>
      </div>

      <FiltroDias dias={filtros.dias} onChange={(v) => setFiltro('dias', v)} />
      {hayFiltros && (
        <button type="button" className="lab-btn sec" style={{ marginBottom: 12 }} onClick={limpiar}>
          <i className="ti ti-filter-off" /> Ver todo
        </button>
      )}

      {cargando && <Skeleton variante="fila" cantidad={3} />}

      {!cargando && error && (
        <EmptyState icono="ti-wifi-off" mensaje={error}
          accion={<button type="button" className="lab-btn" onClick={cargar}>Reintentar</button>} />
      )}

      {!cargando && !error && !examenes.length && (
        <EmptyState icono="ti-flask" mensaje="Tus mascotas aún no tienen exámenes de laboratorio." />
      )}

      {!cargando && !error && examenes.length > 0 && !visibles.length && (
        <EmptyState icono="ti-filter-off" mensaje="No hay exámenes con ese filtro." detalle='Usa "Ver todo" para ver todos los exámenes.' />
      )}

      {!cargando && !error && visibles.map((e) => <ExamenDueno key={e.idExamen} examen={e} />)}
    </section>
  );
}