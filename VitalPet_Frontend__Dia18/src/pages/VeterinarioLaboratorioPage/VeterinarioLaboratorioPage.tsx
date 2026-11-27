// =================================================================
// Archivo: src/pages/VeterinarioLaboratorioPage/VeterinarioLaboratorioPage.tsx
// RESPONSABILIDAD: Pantalla del laboratorio para el veterinario/admin.
// Muestra los exámenes de TODOS los pacientes (pendientes primero, el que
// más lleva esperando arriba) y deja registrar resultados abriendo el mismo
// panel de laboratorio que ya se usa en la consulta.
// =================================================================
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CATEGORIAS_EXAMEN, ETIQUETA_ESTADO_EXAMEN, laboratorioService } from '../../services/laboratorioService';
import type { ExamenListado } from '../../services/laboratorioService';
import LaboratorioPanel from '../../components/LaboratorioPanel/LaboratorioPanel';
import '../../assets/css/admin.css';
import '../../components/LaboratorioPanel/LaboratorioPanel.css';
import './VeterinarioLaboratorioPage.css';

type Filtro = 'pendientes' | 'solicitado' | 'en_proceso' | 'entregado' | 'todos';

// Desde cuántos días esperando se considera "demorado".
const DIAS_DEMORA = 3;

const esPendiente = (e: ExamenListado) => e.estado === 'solicitado' || e.estado === 'en_proceso';
const etiquetaCategoria = (c: string) => CATEGORIAS_EXAMEN.find((x) => x.valor === c)?.etiqueta ?? c;

function diasEsperando(e: ExamenListado): number {
  if (!e.fecha_solicitud) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(e.fecha_solicitud).getTime()) / 86_400_000));
}

function textoEspera(dias: number): string {
  if (dias === 0) return 'Solicitado hoy';
  return dias === 1 ? 'Esperando 1 día' : `Esperando ${dias} días`;
}

const tonoEspera = (dias: number) => (dias >= 5 ? 'rojo' : dias >= DIAS_DEMORA ? 'naranja' : 'neutro');

export default function VeterinarioLaboratorioPage() {
  const navigate = useNavigate();
  const [examenes, setExamenes] = useState<ExamenListado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('pendientes');
  const [abierto, setAbierto] = useState<ExamenListado | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      setExamenes(await laboratorioService.todos());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los exámenes.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Escape cierra la ventana de resultados.
  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (ev: KeyboardEvent) => ev.key === 'Escape' && cerrar();
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  });

  function cerrar() {
    setAbierto(null);
    cargar(); // el veterinario pudo registrar un resultado: se refresca la lista
  }

  const resumen = useMemo(() => ({
    solicitados: examenes.filter((e) => e.estado === 'solicitado').length,
    enProceso: examenes.filter((e) => e.estado === 'en_proceso').length,
    entregados: examenes.filter((e) => e.estado === 'entregado').length,
    demorados: examenes.filter((e) => esPendiente(e) && diasEsperando(e) >= DIAS_DEMORA).length,
  }), [examenes]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return examenes.filter((e) => {
      const pasaFiltro = filtro === 'todos' || (filtro === 'pendientes' ? esPendiente(e) : e.estado === filtro);
      const texto = `${e.nombre_mascota ?? ''} ${e.nombre_dueno ?? ''} ${e.tipo_examen}`.toLowerCase();
      return pasaFiltro && (!q || texto.includes(q));
    });
  }, [examenes, busqueda, filtro]);

  return (
    <section id="sec-laboratorio" className="seccion activa">
      <div className="sec-header">
        <div>
          <div className="sec-titulo">Laboratorio</div>
          <div className="sec-subtitulo">Exámenes de todos los pacientes: solicitados, en proceso y entregados</div>
        </div>
        <button className="btn-nuevo" onClick={cargar} disabled={cargando}>
          <i className="ti ti-refresh" /> Actualizar
        </button>
      </div>

      <div className="stats">
        <div className="stat">
          <div className="stat-icono"><i className="ti ti-clock" /></div>
          <div>
            <div className="stat-label">Por realizar</div>
            <div className="stat-valor">{resumen.solicitados}</div>
          </div>
        </div>
        <div className="stat">
          <div className="stat-icono"><i className="ti ti-flask" /></div>
          <div>
            <div className="stat-label">En proceso</div>
            <div className="stat-valor">{resumen.enProceso}</div>
          </div>
        </div>
        <div className="stat">
          <div className="stat-icono verde"><i className="ti ti-check" /></div>
          <div>
            <div className="stat-label">Entregados</div>
            <div className="stat-valor verde">{resumen.entregados}</div>
          </div>
        </div>
        <div className="stat">
          <div className="stat-icono acento"><i className="ti ti-alert-triangle" /></div>
          <div>
            <div className="stat-label">Demorados (+{DIAS_DEMORA} días)</div>
            <div className="stat-valor acento">{resumen.demorados}</div>
          </div>
        </div>
      </div>

      <div className="toolbar">
        <div className="buscador">
          <i className="ti ti-search" />
          <input
            type="text"
            placeholder="Buscar por mascota, dueño o examen..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <select className="filtro" aria-label="Filtrar por estado" value={filtro} onChange={(e) => setFiltro(e.target.value as Filtro)}>
          <option value="pendientes">Pendientes</option>
          <option value="solicitado">Por realizar</option>
          <option value="en_proceso">En proceso</option>
          <option value="entregado">Entregados</option>
          <option value="todos">Todos</option>
        </select>
      </div>

      {cargando && <p className="conteo">Cargando...</p>}
      {!cargando && error && (
        <div className="vacio">
          <i className="ti ti-wifi-off" />
          {error}
        </div>
      )}
      {!cargando && !error && <p className="conteo">{visibles.length} examen(es) encontrado(s)</p>}

      <div className="hist-lista">
        {!cargando && !error && !visibles.length && (
          <div className="vacio">
            <i className="ti ti-flask-off" />
            {filtro === 'pendientes' && !busqueda ? 'No hay exámenes pendientes. ¡Todo al día!' : 'Sin exámenes para este filtro.'}
          </div>
        )}
        {!cargando && !error && visibles.map((e) => {
          const dias = diasEsperando(e);
          return (
            <div className="hist-card" key={e.idExamen}>
              <div className="hist-header">
                <span className="hist-mascota">
                  {e.nombre_mascota || `Mascota #${e.idMascota}`}{e.especie ? ` · ${e.especie}` : ''}
                </span>
                <span className={`lab-estado ${e.estado}`}>{ETIQUETA_ESTADO_EXAMEN[e.estado]}</span>
              </div>
              <div className="hist-campo">
                <label>Examen</label>
                <p>
                  <span className="labv-examen">{e.tipo_examen}</span>{' '}
                  <span className="labv-categoria">· {etiquetaCategoria(e.categoria)}</span>
                </p>
              </div>
              <div className="hist-campo">
                <label>Dueño</label>
                <p>{e.nombre_dueno || '—'}</p>
              </div>
              <div className="hist-campo">
                <label>{esPendiente(e) ? 'Solicitado' : 'Entregado'}</label>
                <div className="labv-fila">
                  <p>
                    {new Date((esPendiente(e) ? e.fecha_solicitud : e.fecha_resultado || e.fecha_solicitud) ?? '')
                      .toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </p>
                  {esPendiente(e) && (
                    <span className={`labv-espera ${tonoEspera(dias)}`}>
                      <i className="ti ti-hourglass" /> {textoEspera(dias)}
                    </span>
                  )}
                </div>
              </div>
              <div className="hist-acciones">
                <button onClick={() => setAbierto(e)}>
                  <i className="ti ti-edit" /> {e.estado === 'entregado' ? 'Ver / corregir resultado' : 'Registrar resultado'}
                </button>
                <button onClick={() => navigate(`/admin/ficha/${e.idMascota}`)}>
                  <i className="ti ti-file-description" /> Ver ficha
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className={`modal-fondo${abierto ? ' abierto' : ''}`}>
        <div className="modal-caja modal-historia">
          <div className="modal-titulo-fila">
            <div className="modal-titulo">Laboratorio · {abierto?.nombre_mascota}</div>
            <button className="btn-cerrar" aria-label="Cerrar" onClick={cerrar}>
              <i className="ti ti-x" />
            </button>
          </div>
          {abierto && (
            <>
              <p className="labv-modal-sub">Dueño: {abierto.nombre_dueno || '—'}. Aquí ves todos los exámenes de esta consulta.</p>
              <LaboratorioPanel idHistorial={abierto.idHistorial} modo="veterinario" />
            </>
          )}
        </div>
      </div>
    </section>
  );
}