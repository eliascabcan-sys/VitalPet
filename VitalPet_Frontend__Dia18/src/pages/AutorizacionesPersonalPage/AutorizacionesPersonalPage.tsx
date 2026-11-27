// =================================================================
// Archivo: src/pages/AutorizacionesPersonalPage/AutorizacionesPersonalPage.tsx
// RESPONSABILIDAD: Vista de VETERINARIO y ADMINISTRADOR de las
// autorizaciones de adultos mayores (60+): qué dueños la necesitan, quién
// tiene acudiente y consentimiento al día, y el teléfono del acudiente.
// Es solo lectura: el dueño registra su acudiente y firma desde su panel.
// Endpoints: GET /users/duenos y GET /autorizaciones/dueno/{idUsuario}
// =================================================================
import { useCallback, useEffect, useMemo, useState } from 'react';
import { autorizacionesService } from '../../services/autorizacionesService';
import type { EstadoAutorizacion } from '../../services/autorizacionesService';
import type { UsuarioAdmin } from '../../services/usersService';
import { useToast } from '../../components/Toast/ToastContext';
import FilterBar from '../../components/FilterBar/FilterBar';
import EmptyState from '../../components/EmptyState/EmptyState';
import Skeleton from '../../components/Skeleton/Skeleton';
import '../../assets/css/admin.css';
import '../DuenoAutorizacionesPage/DuenoAutorizacionesPage.css';
import './AutorizacionesPersonalPage.css';

type Vista = 'mayores' | 'pendientes' | 'todos';
// El backend decide quién es adulto mayor; aquí solo se usa la edad para saber a quién consultar.
const EDAD_ADULTO_MAYOR = 60;

function edadDe(fecha?: string | null): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha ?? '');
  if (!m) return null;
  const hoy = new Date();
  const [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const antes = hoy.getMonth() + 1 < mes || (hoy.getMonth() + 1 === mes && hoy.getDate() < dia);
  return hoy.getFullYear() - anio - (antes ? 1 : 0);
}

const sinTildes = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function Chip({ dueno, estado }: { dueno: UsuarioAdmin; estado?: EstadoAutorizacion | 'error' }) {
  const edad = edadDe(dueno.fechaNacimiento);
  if (edad === null) return <span className="aut-etiqueta neutro">Sin fecha de nacimiento</span>;
  if (edad < EDAD_ADULTO_MAYOR) return <span className="aut-etiqueta neutro">No aplica</span>;
  if (estado === 'error') return <span className="aut-etiqueta pendiente">No se pudo consultar</span>;
  if (!estado) return <span className="aut-etiqueta neutro">Consultando…</span>;
  return estado.completa
    ? <span className="aut-etiqueta ok">Completa</span>
    : <span className="aut-etiqueta pendiente">Faltan datos</span>;
}

export default function AutorizacionesPersonalPage() {
  const { mostrarToast } = useToast();
  const [duenos, setDuenos] = useState<UsuarioAdmin[]>([]);
  const [estados, setEstados] = useState<Record<number, EstadoAutorizacion | 'error'>>({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [vista, setVista] = useState<Vista>('mayores');
  const [abierto, setAbierto] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const lista = (await autorizacionesService.duenos()).filter((d) => d.estado !== 'inactivo');
      setDuenos(lista);
      // Solo se consulta el estado de quienes tienen 60 años o más (suelen ser pocos).
      const mayores = lista.filter((d) => (edadDe(d.fechaNacimiento) ?? 0) >= EDAD_ADULTO_MAYOR);
      const resultados = await Promise.allSettled(mayores.map((d) => autorizacionesService.deDueno(d.idUsuario)));
      const mapa: Record<number, EstadoAutorizacion | 'error'> = {};
      resultados.forEach((r, i) => {
        mapa[mayores[i].idUsuario] = r.status === 'fulfilled' ? r.value : 'error';
      });
      setEstados(mapa);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los dueños.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function alternar(d: UsuarioAdmin) {
    if (abierto === d.idUsuario) return setAbierto(null);
    setAbierto(d.idUsuario);
    if (estados[d.idUsuario] && estados[d.idUsuario] !== 'error') return;
    try {
      const estado = await autorizacionesService.deDueno(d.idUsuario);
      setEstados((e) => ({ ...e, [d.idUsuario]: estado }));
    } catch (err) {
      setEstados((e) => ({ ...e, [d.idUsuario]: 'error' }));
      mostrarToast(err instanceof Error ? err.message : 'No se pudo consultar la autorización.', 'error');
    }
  }

  const esMayor = (d: UsuarioAdmin) => (edadDe(d.fechaNacimiento) ?? 0) >= EDAD_ADULTO_MAYOR;
  const incompleta = (d: UsuarioAdmin) => {
    const e = estados[d.idUsuario];
    return !!e && e !== 'error' && !e.completa;
  };

  const resumen = useMemo(() => {
    const mayores = duenos.filter(esMayor);
    const completas = mayores.filter((d) => {
      const e = estados[d.idUsuario];
      return e && e !== 'error' && e.completa;
    }).length;
    return {
      mayores: mayores.length,
      completas,
      pendientes: mayores.filter(incompleta).length,
      sinFecha: duenos.filter((d) => !d.fechaNacimiento).length,
    };
    // esMayor e incompleta solo leen duenos y estados
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duenos, estados]);

  const filtrados = useMemo(() => {
    const q = sinTildes(busqueda.trim());
    return duenos
      .filter((d) => (vista === 'todos' ? true : vista === 'mayores' ? esMayor(d) : incompleta(d)))
      .filter((d) =>
        !q || [d.nombre, d.apellido, d.documento, d.email, d.telefono].some((v) => sinTildes(String(v ?? '')).includes(q)))
      .sort((a, b) => `${a.nombre} ${a.apellido}`.localeCompare(`${b.nombre} ${b.apellido}`, 'es'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duenos, estados, busqueda, vista]);

  return (
    <section id="sec-autorizaciones" className="seccion activa">
      <div className="sec-header">
        <div>
          <div className="sec-titulo">Autorizaciones</div>
          <div className="sec-subtitulo">Acudiente y consentimiento de los dueños adultos mayores (60+).</div>
        </div>
      </div>

      <div className="autp-resumen">
        <span className="aut-etiqueta neutro">{resumen.mayores} adulto(s) mayor(es)</span>
        <span className="aut-etiqueta ok">{resumen.completas} completa(s)</span>
        <span className="aut-etiqueta pendiente">{resumen.pendientes} con pendientes</span>
        {resumen.sinFecha > 0 && <span className="aut-etiqueta neutro">{resumen.sinFecha} sin fecha de nacimiento</span>}
      </div>

      <FilterBar
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        placeholder="Buscar por nombre, documento, correo o teléfono..."
        hayFiltros={!!busqueda || vista !== 'mayores'}
        onLimpiar={() => { setBusqueda(''); setVista('mayores'); }}
      >
        <select className="filtro" value={vista} onChange={(e) => setVista(e.target.value as Vista)} aria-label="Mostrar">
          <option value="mayores">Adultos mayores</option>
          <option value="pendientes">Con pendientes</option>
          <option value="todos">Todos los dueños</option>
        </select>
      </FilterBar>

      {cargando && <div className="skeleton-lista"><Skeleton variante="fila" cantidad={4} /></div>}

      {!cargando && error && (
        <EmptyState icono="ti-wifi-off" mensaje={error} accion={<button onClick={cargar}>Reintentar</button>} />
      )}

      {!cargando && !error && !filtrados.length && (
        <EmptyState
          icono="ti-shield-check"
          mensaje={vista === 'pendientes' ? 'Ningún dueño tiene autorizaciones pendientes' : 'No hay dueños para mostrar'}
          detalle={vista === 'mayores' ? 'La edad sale de la fecha de nacimiento que cada dueño registra en su perfil.' : undefined}
        />
      )}

      {!cargando && !error && filtrados.length > 0 && (
        <>
          <p className="conteo">{filtrados.length} dueño(s)</p>
          <div className="autp-lista">
            {filtrados.map((d) => {
              const estado = estados[d.idUsuario];
              const detalle = estado && estado !== 'error' ? estado : null;
              const edad = edadDe(d.fechaNacimiento);
              const abiertoAhora = abierto === d.idUsuario;
              return (
                <div className="autp-item" key={d.idUsuario}>
                  <button type="button" className="autp-cabecera" onClick={() => alternar(d)} aria-expanded={abiertoAhora}>
                    <span className="autp-nombre">
                      <strong>{d.nombre} {d.apellido}</strong>
                      <small>
                        {[edad !== null ? `${edad} años` : null, d.documento, d.telefono, d.email].filter(Boolean).join(' · ')}
                      </small>
                    </span>
                    <Chip dueno={d} estado={estado} />
                    <i className={`ti ${abiertoAhora ? 'ti-chevron-up' : 'ti-chevron-down'}`} />
                  </button>

                  {abiertoAhora && (
                    <div className="autp-detalle">
                      {!detalle && <p className="aut-texto">{estado === 'error' ? 'No se pudo consultar.' : 'Consultando…'}</p>}
                      {detalle && (
                        <>
                          {!detalle.requiere_autorizacion && (
                            <p className="aut-texto">
                              Este dueño no tiene que presentar autorización (solo se exige desde los 60 años).
                              {!detalle.fecha_nacimiento_registrada && ' No ha registrado su fecha de nacimiento.'}
                            </p>
                          )}
                          {detalle.pendientes.length > 0 && (
                            <ul className="aut-pendientes">{detalle.pendientes.map((p) => <li key={p}>{p}</li>)}</ul>
                          )}

                          <div className="aut-bloque-titulo" style={{ marginTop: 12 }}>
                            <span><i className="ti ti-users" />Acudientes</span>
                          </div>
                          {detalle.acudientes.length === 0 ? (
                            <div className="aut-vacio">Sin acudientes registrados.</div>
                          ) : (
                            <div className="aut-lista">
                              {detalle.acudientes.map((a) => (
                                <div className="aut-item" key={a.idAcudiente}>
                                  <div>
                                    <div className="aut-item-nombre">{a.nombre} {a.apellido}</div>
                                    <div className="aut-item-detalle">
                                      {a.parentesco ? `${a.parentesco} · ` : ''}
                                      <a href={`tel:${a.telefono.replace(/[^\d+]/g, '')}`}>{a.telefono}</a>
                                      {a.email ? ` · ${a.email}` : ''}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="aut-bloque-titulo" style={{ marginTop: 12 }}>
                            <span><i className="ti ti-file-certificate" />Consentimiento</span>
                            {detalle.consentimiento
                              ? <span className="aut-etiqueta ok">Vigente</span>
                              : <span className="aut-etiqueta pendiente">Sin firmar</span>}
                          </div>
                          {detalle.consentimiento && (
                            <p className="aut-texto">
                              Firmado el {new Date(detalle.consentimiento.fechaAceptacion).toLocaleDateString('es-CO')}
                              {(() => {
                                const a = detalle.acudientes.find((x) => x.idAcudiente === detalle.consentimiento?.idAcudiente);
                                return a ? ` con ${a.nombre} ${a.apellido} como acudiente.` : '.';
                              })()}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}