// =================================================================
// Archivo: src/pages/VeterinarioPacientesPage/VeterinarioPacientesPage.tsx
// RESPONSABILIDAD: Grid de todos los pacientes (mascotas) con buscador,
// filtro por estado, editar y desactivar. Migrado de admin-pacientes.html
// + renderMascotas()/guardarMascota()/confirmarEliminar() de admin.js.
// =================================================================
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ESPECIES } from '../../constants/mascotas';
import { mascotasService } from '../../services/mascotasService';
import type { Mascota } from '../../services/mascotasService';
import { citasService } from '../../services/citasService';
import type { Cita } from '../../services/citasService';
import { useToast } from '../../components/Toast/ToastContext';
import FotoMascota from '../../components/FotoMascota/FotoMascota';
import FilterBar from '../../components/FilterBar/FilterBar';
import EmptyState from '../../components/EmptyState/EmptyState';
import Skeleton from '../../components/Skeleton/Skeleton';
import { useFiltrosURL } from '../../hooks/useFiltrosURL';

import '../../assets/css/admin.css';
import './VeterinarioPacientesPage.css';

const FILTROS = { q: '', estado: '', especie: '' };

const diaCorto = (iso: string) =>
  new Date(iso).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' }).replace('.', '');

function fechaCorta(iso?: string): string {
  if (!iso) return '—';
  const f = new Date(iso);
  return isNaN(f.getTime()) ? '—' : f.toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function VeterinarioPacientesPage() {
  const [mascotas, setMascotas] = useState<Mascota[]>([]);
  const [citas, setCitas] = useState<Cita[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const { filtros, setFiltro, limpiar, hayFiltros } = useFiltrosURL(FILTROS);

  const especies = useMemo(
    () => Array.from(new Set(mascotas.map((m) => m.especie).filter(Boolean))).sort(),
    [mascotas]
  );

  const [editando, setEditando] = useState<Mascota | null>(null);
  const [form, setForm] = useState({ nombre: '', especie: '', raza: '', fecha: '', estado: 'activo' as 'activo' | 'inactivo' });
  const [guardando, setGuardando] = useState(false);

  const [eliminando, setEliminando] = useState<Mascota | null>(null);

  const { mostrarToast } = useToast();

  async function cargar() {
    setCargando(true);
    setError('');
    try {
      const data = await mascotasService.todas();
      setMascotas(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar pacientes.');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
    citasService
      .todas()
      .then(setCitas)
      .catch(() => mostrarToast('No se pudieron cargar las citas de los pacientes.', 'error'));
  }, []);

  const { proximaPorMascota, citasPendientes } = useMemo(() => {
    const inicioHoy = new Date();
    inicioHoy.setHours(0, 0, 0, 0);
    const proximas = citas
      .filter((c) => (c.estado === 'pendiente' || c.estado === 'confirmada') && new Date(c.fechaHora) >= inicioHoy)
      .sort((a, b) => a.fechaHora.localeCompare(b.fechaHora));
    const mapa = new Map<number, Cita>();
    proximas.forEach((c) => { if (!mapa.has(c.idMascota)) mapa.set(c.idMascota, c); });
    return { proximaPorMascota: mapa, citasPendientes: proximas.filter((c) => c.estado === 'pendiente').length };
  }, [citas]);

  const filtradas = useMemo(() => {
    const q = filtros.q.trim().toLowerCase();
    return mascotas.filter(
      (m) =>
        (!q ||
          m.nombre_mascota.toLowerCase().includes(q) ||
          m.especie.toLowerCase().includes(q) ||
          (m.nombre_dueno || '').toLowerCase().includes(q)) &&
        (!filtros.estado || m.estado === filtros.estado) &&
        (!filtros.especie || m.especie === filtros.especie)
    );
  }, [mascotas, filtros]);

  const totalActivos = mascotas.filter((m) => m.estado === 'activo').length;
  const totalInactivos = mascotas.filter((m) => m.estado === 'inactivo').length;

  function abrirEditar(m: Mascota) {
    setEditando(m);
    setForm({
      nombre: m.nombre_mascota || '',
      especie: m.especie || '',
      raza: m.raza || '',
      fecha: m.fechaNacimiento || '',
      estado: m.estado || 'activo',
    });
  }

  async function guardar() {
    if (!editando) return;
    if (!form.nombre.trim() || !form.especie.trim()) {
      mostrarToast('Nombre y especie son obligatorios.', 'error');
      return;
    }
    setGuardando(true);
    try {
      await mascotasService.actualizar(editando.idMascota, {
        nombre_mascota: form.nombre.trim(),
        especie: form.especie.trim(),
        raza: form.raza.trim() || null,
        fechaNacimiento: form.fecha || null,
        estado: form.estado,
      });
      mostrarToast('Mascota actualizada.', 'ok');
      setEditando(null);
      await cargar();
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : 'Error al actualizar.', 'error');
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar() {
    if (!eliminando) return;
    try {
      await mascotasService.eliminar(eliminando.idMascota);
      mostrarToast('Mascota desactivada.', 'ok');
      setEliminando(null);
      await cargar();
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : 'Error al desactivar.', 'error');
    }
  }

  return (
    <section id="sec-mascotas" className="seccion activa">
      <div className="sec-header">
        <div>
          <div className="sec-titulo">Pacientes</div>
          <div className="sec-subtitulo">Todas las mascotas registradas por los dueños</div>
        </div>
      </div>

      <div className="stats">
        <div className="stat">
          <div className="stat-icono">
            <i className="ti ti-list" />
          </div>
          <div>
            <div className="stat-label">Total pacientes</div>
            <div className="stat-valor">{mascotas.length}</div>
          </div>
        </div>
        <div className="stat">
          <div className="stat-icono verde">
            <i className="ti ti-heart" />
          </div>
          <div>
            <div className="stat-label">Activos</div>
            <div className="stat-valor verde">{totalActivos}</div>
          </div>
        </div>
        <div className="stat">
          <div className="stat-icono acento">
            <i className="ti ti-moon" />
          </div>
          <div>
            <div className="stat-label">Inactivos</div>
            <div className="stat-valor acento">{totalInactivos}</div>
          </div>
        </div>
        <div className="stat">
          <div className="stat-icono">
            <i className="ti ti-calendar" />
          </div>
          <div>
            <div className="stat-label">Citas pendientes</div>
            <div className="stat-valor">{citasPendientes}</div>
          </div>
        </div>
      </div>

      <FilterBar
        busqueda={filtros.q}
        onBusqueda={(v) => setFiltro('q', v)}
        placeholder="Buscar por mascota, especie o dueño..."
        hayFiltros={hayFiltros}
        onLimpiar={limpiar}
      >
        <select className="filtro" value={filtros.estado} onChange={(e) => setFiltro('estado', e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="activo">Activos</option>
          <option value="inactivo">Inactivos</option>
        </select>
        <select className="filtro" value={filtros.especie} onChange={(e) => setFiltro('especie', e.target.value)}>
          <option value="">Todas las especies</option>
          {especies.map((esp) => (
            <option key={esp} value={esp}>
              {esp}
            </option>
          ))}
        </select>
      </FilterBar>

      {!cargando && !error && <p className="conteo">{filtradas.length} paciente(s) encontrado(s)</p>}

      <div className="grid">
        {cargando && <Skeleton variante="tarjeta" cantidad={6} />}

        {!cargando && error && (
          <EmptyState
            icono="ti-wifi-off"
            mensaje={error}
            accion={<button onClick={cargar}>Reintentar</button>}
          />
        )}

        {!cargando && !error && !filtradas.length && (
          <EmptyState
            icono="ti-paw"
            mensaje={hayFiltros ? 'Ningún paciente coincide con los filtros' : 'Aún no hay pacientes'}
            accion={hayFiltros ? <button onClick={limpiar}>Limpiar filtros</button> : undefined}
          />
        )}

        {!cargando &&
          !error &&
          filtradas.map((m) => (
            <div className="card" key={m.idMascota}>
              <Link to={`/admin/ficha/${m.idMascota}`} className="pp-enlace" title="Abrir la ficha del paciente">
                <div className="card-top">
                  <FotoMascota mascota={m} tamano={88} forma="redondeado" />
                  <div className={`dot ${m.estado}`} />
                </div>
                <div className="pet-nombre">{m.nombre_mascota}</div>
              </Link>
              <div className="pet-especie">
                {m.especie} · {m.raza || '—'}
              </div>
              <div className="pet-dato pp-dueno">
                <i className="ti ti-user" /> {m.nombre_dueno || `Dueño #${m.idUsuario}`}
              </div>
              <div className="pet-dato">
                <i className="ti ti-cake" /> {fechaCorta(m.fechaNacimiento)}
              </div>
              <div className="pet-dato">
                <i className="ti ti-weight" /> {m.peso_kg ? `${m.peso_kg} kg` : '—'}
              </div>
              {(() => {
                const cita = proximaPorMascota.get(m.idMascota);
                if (!cita) return <div className="pp-cita nada"><i className="ti ti-calendar-off" /> Sin cita próxima</div>;
                return (
                  <div
                    className={`pp-cita ${cita.estado === 'pendiente' ? 'pend' : 'hay'}`}
                    title={cita.estado === 'pendiente' ? 'Cita por confirmar' : 'Cita confirmada'}
                  >
                    <i className="ti ti-calendar-event" />
                    {diaCorto(cita.fechaHora)}{cita.franja ? ` · ${cita.franja.nombre}` : ''}
                  </div>
                );
              })()}
              <div className="card-acciones">
                <Link to={`/admin/ficha/${m.idMascota}`} className="btn-ficha" title="Ver ficha del paciente" aria-label={`Ficha de ${m.nombre_mascota}`}>
                  <i className="ti ti-file-description" /> Ficha
                </Link>
                <button onClick={() => abrirEditar(m)}>
                  <i className="ti ti-edit" />
                </button>
                <button className="btn-del" onClick={() => setEliminando(m)}>
                  <i className="ti ti-trash" />
                </button>
              </div>
            </div>
          ))}
      </div>

      {/* Modal editar */}
      <div className={`modal-fondo${editando ? ' abierto' : ''}`}>
        <div className="modal-caja">
          <div className="modal-titulo-fila">
            <div className="modal-titulo">Editar mascota</div>
            <button className="btn-cerrar" onClick={() => setEditando(null)}>
              <i className="ti ti-x" />
            </button>
          </div>
          <div className="campo">
            <label>Nombre</label>
            <input
              type="text"
              placeholder="ej. Luna"
              value={form.nombre}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
            />
          </div>
          <div className="campo-2">
            <div className="campo" style={{ margin: 0 }}>
              <label>Especie</label>
              <select
                value={form.especie}
                onChange={(e) => setForm((f) => ({ ...f, especie: e.target.value }))}
              >
                <option value="">Seleccionar...</option>
                {ESPECIES.map((esp) => (
                  <option key={esp} value={esp}>{esp}</option>
                ))}
                {form.especie && !(ESPECIES as readonly string[]).includes(form.especie) && (
                  <option value={form.especie}>{form.especie}</option>
                )}
              </select>
            </div>
            <div className="campo" style={{ margin: 0 }}>
              <label>Raza</label>
              <input
                type="text"
                placeholder="ej. Siamés"
                value={form.raza}
                onChange={(e) => setForm((f) => ({ ...f, raza: e.target.value }))}
              />
            </div>
          </div>
          <div className="campo">
            <label>Fecha de nacimiento</label>
            <input type="date" value={form.fecha} onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))} />
          </div>
          <div className="campo">
            <label>Estado</label>
            <select
              value={form.estado}
              onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value as 'activo' | 'inactivo' }))}
            >
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
            </select>
          </div>
          <div className="modal-pie">
            <button className="btn-cancelar" onClick={() => setEditando(null)}>
              Cancelar
            </button>
            <button className="btn-guardar" onClick={guardar} disabled={guardando}>
              <i className="ti ti-device-floppy" /> {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>

      {/* Modal confirmar desactivar */}
      <div className={`modal-fondo${eliminando ? ' abierto' : ''}`}>
        <div className="modal-caja">
          <div className="modal-titulo-fila">
            <div className="modal-titulo" style={{ color: '#A32D2D' }}>
              <i className="ti ti-alert-triangle" style={{ fontSize: 15, verticalAlign: -2, marginRight: 6 }} />
              Desactivar mascota
            </div>
            <button className="btn-cerrar" onClick={() => setEliminando(null)}>
              <i className="ti ti-x" />
            </button>
          </div>
          <p className="del-texto">
            ¿Deseas desactivar a <strong>{eliminando?.nombre_mascota}</strong>?
          </p>
          <p className="del-sub">El registro no se borra, queda inactivo. Puedes reactivarlo después.</p>
          <div className="modal-pie">
            <button className="btn-cancelar" onClick={() => setEliminando(null)}>
              Cancelar
            </button>
            <button className="btn-eliminar" onClick={eliminar}>
              <i className="ti ti-trash" /> Sí, desactivar
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}