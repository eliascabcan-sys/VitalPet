// =================================================================
// Archivo: src/pages/VeterinarioAlertasPage/VeterinarioAlertasPage.tsx
// RESPONSABILIDAD: Bandeja de alertas de seguimiento para el
// veterinario/administrador. Las ordena por urgencia (nivel, bandera
// roja, puntos y antigüedad), permite filtrar por nivel y estado
// (guardado en la URL) y se actualiza sola cada 30 segundos.
// Endpoint: GET /seguimientos/alertas/pendientes y
//           PUT /seguimientos/alertas/{id}/vista
// =================================================================
import { useCallback, useEffect, useMemo, useState } from 'react';
import { seguimientoAdminService } from '../../services/seguimientoAdminService';
import type { Alerta, NivelAlerta } from '../../services/seguimientoAdminService';
import NivelChip from '../../components/NivelChip/NivelChip';
import FilterBar from '../../components/FilterBar/FilterBar';
import EmptyState from '../../components/EmptyState/EmptyState';
import Skeleton from '../../components/Skeleton/Skeleton';
import { useToast } from '../../components/Toast/ToastContext';
import { useFiltrosURL } from '../../hooks/useFiltrosURL';
import '../../assets/css/admin.css';
import '../../assets/css/administracion.css';
import './VeterinarioAlertasPage.css';

const INTERVALO_MS = 30_000;

const NIVELES: Record<NivelAlerta, string> = {
  rojo: 'Rojo (emergencia)',
  naranja: 'Naranja (muy urgente)',
  amarillo: 'Amarillo (urgente)',
  verde: 'Verde (estándar)',
};
const PESO_NIVEL: Record<NivelAlerta, number> = { rojo: 0, naranja: 1, amarillo: 2, verde: 3 };

// La bandeja solo trae alertas que el veterinario aún no revisó, por eso
// solo hay estos dos estados posibles aquí.
const ESTADOS: Record<string, string> = {
  pendiente: 'Pendiente',
  sin_respuesta: 'Dueño sin responder',
};

const FILTROS = { q: '', nivel: '', estado: '' };

function marca(iso?: string | null): number {
  const t = iso ? new Date(iso).getTime() : 0;
  return isNaN(t) ? 0 : t;
}

// Más urgente primero: nivel -> bandera roja -> puntos -> la más antigua
function porUrgencia(a: Alerta, b: Alerta): number {
  return (
    (PESO_NIVEL[a.nivel] ?? 9) - (PESO_NIVEL[b.nivel] ?? 9) ||
    Number(!!b.bandera_roja) - Number(!!a.bandera_roja) ||
    (b.puntos ?? 0) - (a.puntos ?? 0) ||
    marca(a.fecha_generada) - marca(b.fecha_generada)
  );
}

function hace(iso: string): string {
  const min = Math.max(0, Math.floor((Date.now() - marca(iso)) / 60000));
  if (min < 1) return 'hace un momento';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}

export default function VeterinarioAlertasPage() {
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [errorRefresco, setErrorRefresco] = useState(false);
  const [actualizado, setActualizado] = useState<Date | null>(null);
  const [marcando, setMarcando] = useState<number | null>(null);

  const { filtros, setFiltro, limpiar, hayFiltros } = useFiltrosURL(FILTROS);
  const { mostrarToast } = useToast();

  // silencioso = refresco automático: no muestra el skeleton ni borra la lista si falla
  const cargar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCargando(true);
    try {
      const data = await seguimientoAdminService.alertasPendientes();
      setAlertas(data);
      setError('');
      setErrorRefresco(false);
      setActualizado(new Date());
    } catch (err) {
      if (silencioso) setErrorRefresco(true);
      else setError(err instanceof Error ? err.message : 'No se pudieron cargar las alertas.');
    } finally {
      if (!silencioso) setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
    const refrescar = () => {
      if (!document.hidden) cargar(true); // no gasta peticiones con la pestaña oculta
    };
    const id = window.setInterval(refrescar, INTERVALO_MS);
    document.addEventListener('visibilitychange', refrescar);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', refrescar);
    };
  }, [cargar]);

  const ordenadas = useMemo(() => [...alertas].sort(porUrgencia), [alertas]);

  const filtradas = useMemo(() => {
    const q = filtros.q.trim().toLowerCase();
    return ordenadas.filter(
      (a) =>
        (!filtros.nivel || a.nivel === filtros.nivel) &&
        (!filtros.estado || (a.estado ?? 'pendiente') === filtros.estado) &&
        (!q ||
          (a.nombre_mascota ?? '').toLowerCase().includes(q) ||
          (a.texto_pregunta ?? '').toLowerCase().includes(q))
    );
  }, [ordenadas, filtros]);

  const rojas = alertas.filter((a) => a.nivel === 'rojo').length;

  async function marcarVista(a: Alerta) {
    setMarcando(a.idAlerta);
    try {
      await seguimientoAdminService.marcarAlertaVista(a.idAlerta);
      setAlertas((prev) => prev.filter((x) => x.idAlerta !== a.idAlerta));
      mostrarToast('Alerta marcada como revisada.', 'ok');
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : 'No se pudo marcar la alerta.', 'error');
    } finally {
      setMarcando(null);
    }
  }

  return (
    <section className="seccion activa">
      <div className="sec-header">
        <div>
          <div className="sec-titulo">Alertas</div>
          <div className="sec-subtitulo">
            Ordenadas por urgencia · se actualizan cada 30 s
            {actualizado && ` · última: ${actualizado.toLocaleTimeString('es-CO')}`}
          </div>
        </div>
        <button className="btn-nuevo" onClick={() => cargar()} disabled={cargando}>
          <i className="ti ti-refresh" /> Actualizar
        </button>
      </div>

      {errorRefresco && (
        <p className="alertas-aviso">
          <i className="ti ti-wifi-off" /> No se pudo actualizar; se muestran los últimos datos recibidos.
        </p>
      )}

      <FilterBar
        busqueda={filtros.q}
        onBusqueda={(v) => setFiltro('q', v)}
        placeholder="Buscar por mascota o pregunta..."
        hayFiltros={hayFiltros}
        onLimpiar={limpiar}
      >
        <select className="filtro" value={filtros.nivel} onChange={(e) => setFiltro('nivel', e.target.value)}>
          <option value="">Todos los niveles</option>
          {(Object.keys(NIVELES) as NivelAlerta[]).map((n) => (
            <option key={n} value={n}>
              {NIVELES[n]}
            </option>
          ))}
        </select>
        <select className="filtro" value={filtros.estado} onChange={(e) => setFiltro('estado', e.target.value)}>
          <option value="">Todos los estados</option>
          {Object.entries(ESTADOS).map(([valor, etiqueta]) => (
            <option key={valor} value={valor}>
              {etiqueta}
            </option>
          ))}
        </select>
      </FilterBar>

      {!cargando && !error && (
        <p className="conteo">
          {filtradas.length} de {alertas.length} alerta(s)
          {rojas > 0 && ` · ${rojas} en rojo`}
        </p>
      )}

      <div className="hist-lista">
        {cargando && <Skeleton variante="fila" cantidad={3} />}

        {!cargando && error && (
          <EmptyState
            icono="ti-wifi-off"
            mensaje={error}
            accion={<button onClick={() => cargar()}>Reintentar</button>}
          />
        )}

        {!cargando && !error && !filtradas.length && (
          <EmptyState
            icono="ti-bell-check"
            mensaje={hayFiltros ? 'Ninguna alerta coincide con los filtros' : 'No hay alertas pendientes'}
            detalle={hayFiltros ? undefined : 'Cuando un dueño responda "mal" o no responda, aparecerá aquí.'}
            accion={hayFiltros ? <button onClick={limpiar}>Limpiar filtros</button> : undefined}
          />
        )}

        {!cargando &&
          !error &&
          filtradas.map((a) => {
            const estado = a.estado ?? 'pendiente';
            return (
              <div className={`hist-fila alerta-fila alerta-${a.nivel}`} key={a.idAlerta}>
                <div className="hist-top">
                  <div>
                    <strong>{a.nombre_mascota || `Mascota #${a.idMascota ?? '?'}`}</strong>
                    <div className="adm-sub">
                      {new Date(a.fecha_generada).toLocaleString('es-CO')} · {hace(a.fecha_generada)}
                    </div>
                  </div>
                  <NivelChip nivel={a.nivel} texto={NIVELES[a.nivel] ?? a.nivel} />
                </div>

                <div className="alerta-etiquetas">
                  {a.bandera_roja && <span className="chip rojo">Bandera roja</span>}
                  {estado === 'sin_respuesta' && <span className="chip naranja">Dueño sin responder</span>}
                  {(a.veces_reescalada ?? 0) > 0 && (
                    <span className="chip naranja">Reescalada {a.veces_reescalada}×</span>
                  )}
                  {(a.puntos ?? 0) > 0 && <span className="chip">{a.puntos} pts</span>}
                </div>

                <div className="hist-campo">
                  <label>Pregunta de seguimiento</label>
                  <p>{a.texto_pregunta || '—'}</p>
                </div>

                <div className="hist-acciones">
                  <button onClick={() => marcarVista(a)} disabled={marcando === a.idAlerta}>
                    <i className="ti ti-check" /> {marcando === a.idAlerta ? 'Marcando...' : 'Marcar como revisada'}
                  </button>
                </div>
              </div>
            );
          })}
      </div>
    </section>
  );
}