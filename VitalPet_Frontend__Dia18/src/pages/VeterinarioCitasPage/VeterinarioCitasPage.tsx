// =================================================================
// Archivo: src/pages/VeterinarioCitasPage/VeterinarioCitasPage.tsx
// RESPONSABILIDAD: Gestión de todas las citas (crear, editar, cambiar
// estado) con filtro por días y "Ver todo". Cada cita muestra la mascota,
// el dueño y quién la atiende (nombres, no IDs), separadas en Próximas y
// Anteriores, con acceso directo a la ficha del paciente.
// =================================================================
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { citasService } from '../../services/citasService';
import type { Cita } from '../../services/citasService';
import { mascotasService } from '../../services/mascotasService';
import type { Mascota } from '../../services/mascotasService';
import { useToast } from '../../components/Toast/ToastContext';
import FilterBar from '../../components/FilterBar/FilterBar';
import EmptyState from '../../components/EmptyState/EmptyState';
import Skeleton from '../../components/Skeleton/Skeleton';
import FiltroDias from '../../components/FiltroDias/FiltroDias';
import SelectorPaciente from '../../components/SelectorPaciente/SelectorPaciente';
import { useFiltrosURL } from '../../hooks/useFiltrosURL';
import { dentroDeDias, enRango } from '../../utils/fechas';
import '../../assets/css/admin.css';
import '../../components/AgendaVet/AgendaVet.css'; // botones .av-btn y etiqueta .av-urgente
import './VeterinarioCitasPage.css';

// Filtros que se guardan en la URL: ?q=control&estado=pendiente&dias=30
const FILTROS = { q: '', estado: '', desde: '', hasta: '', dias: '' };

function toDatetimeLocal(iso: string): string {
  const f = new Date(iso);
  if (isNaN(f.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${f.getFullYear()}-${pad(f.getMonth() + 1)}-${pad(f.getDate())}T${pad(f.getHours())}:${pad(f.getMinutes())}`;
}

const ETIQUETA_ESTADO: Record<string, string> = {
  pendiente: 'Pendiente',
  confirmada: 'Confirmada',
  completada: 'Completada',
  cancelada: 'Cancelada',
};

interface FilaProps {
  cita: Cita;
  onEditar: (c: Cita) => void;
  onEstado: (c: Cita, estado: string) => void;
  onFicha: (idMascota: number) => void;
}

function CitaFila({ cita: c, onEditar, onEstado, onFicha }: FilaProps) {
  const f = new Date(c.fechaHora);
  const mes = f.toLocaleDateString('es-CO', { month: 'short' }).toUpperCase();
  // Las citas por franja se guardan a la hora de inicio de la franja: ahí se muestra
  // "Mañana"/"Tarde" y no una hora exacta que no existe.
  const cuando = c.franja?.nombre ?? f.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  const abierta = c.estado === 'pendiente' || c.estado === 'confirmada';

  return (
    <div className={`cita-fila vc-fila ${c.estado}`}>
      <div className="cita-fecha-bloque">
        <div className="cita-dia">{f.getDate()}</div>
        <div className="cita-mes">{mes}</div>
        <div className="cita-hora">{cuando}</div>
      </div>

      <div className="cita-info">
        <div className="cita-mascota">
          {c.nombre_mascota || `Mascota #${c.idMascota}`}
          {c.especie && <span className="vc-especie"> · {c.especie}</span>}
          {c.canal_contacto === 'urgente' && <span className="av-urgente">Urgente</span>}
        </div>
        <div className="cita-motivo">
          {c.nombre_dueno || 'Sin dueño'}
          {c.motivo ? ` — ${c.motivo}` : ''}
        </div>
        <div className="vc-vet">
          {c.nombre_veterinario ? `Atiende: ${c.nombre_veterinario}` : <span className="vc-sin-vet">Sin veterinario asignado</span>}
        </div>
      </div>

      <div className="vc-lado">
        <span className={`chip ${c.estado}`}>{ETIQUETA_ESTADO[c.estado] ?? c.estado}</span>
        <div className="vc-acciones">
          <button type="button" className="av-btn" onClick={() => onFicha(c.idMascota)}>Abrir ficha</button>
          {c.estado !== 'cancelada' && <button type="button" className="av-btn" onClick={() => onEditar(c)}>Editar</button>}
          {c.estado === 'pendiente' && (
            <button type="button" className="av-btn primario" onClick={() => onEstado(c, 'confirmada')}>Confirmar</button>
          )}
          {abierta && <button type="button" className="av-btn peligro" onClick={() => onEstado(c, 'cancelada')}>Cancelar</button>}
        </div>
      </div>
    </div>
  );
}

export default function VeterinarioCitasPage() {
  const [citas, setCitas] = useState<Cita[]>([]);
  const [mascotasActivas, setMascotasActivas] = useState<Mascota[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const { filtros, setFiltro, limpiar, hayFiltros } = useFiltrosURL(FILTROS);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [form, setForm] = useState({
    idMascota: '',
    fecha: '',
    motivo: '',
    estado: 'pendiente',
  });
  const [guardando, setGuardando] = useState(false);

  const { mostrarToast, confirmar } = useToast();
  const navigate = useNavigate();

  async function cargar() {
    setCargando(true);
    setError('');

    try {
      const data = await citasService.todas();
      setCitas(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar citas.');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  const filtradas = useMemo(() => {
    const q = filtros.q.trim().toLowerCase();

    return citas.filter(
      (c) =>
        (!q ||
          [c.motivo, c.nombre_mascota, c.nombre_dueno, c.nombre_veterinario, c.especie]
            .some((t) => (t || '').toLowerCase().includes(q))) &&
        (!filtros.estado || c.estado === filtros.estado) &&
        dentroDeDias(c.fechaHora, filtros.dias) &&
        enRango(c.fechaHora, filtros.desde, filtros.hasta)
    );
  }, [citas, filtros]);

  // Próximas (de hoy en adelante, la más cercana primero) y anteriores (la más reciente primero).
  const { proximas, anteriores } = useMemo(() => {
    const inicioHoy = new Date();
    inicioHoy.setHours(0, 0, 0, 0);
    const t = (c: Cita) => new Date(c.fechaHora).getTime();
    return {
      proximas: filtradas.filter((c) => t(c) >= inicioHoy.getTime()).sort((a, b) => t(a) - t(b)),
      anteriores: filtradas.filter((c) => t(c) < inicioHoy.getTime()).sort((a, b) => t(b) - t(a)),
    };
  }, [filtradas]);

  async function abrirNueva() {
    setEditandoId(null);
    setForm({
      idMascota: '',
      fecha: '',
      motivo: '',
      estado: 'pendiente',
    });

    const data = await mascotasService.todas().catch(() => []);
    setMascotasActivas(data.filter((m) => m.estado === 'activo'));
    setModalAbierto(true);
  }

  async function abrirEditar(c: Cita) {
    setEditandoId(c.idCita);

    setForm({
      idMascota: String(c.idMascota),
      fecha: toDatetimeLocal(c.fechaHora),
      motivo: c.motivo || '',
      estado: c.estado || 'pendiente',
    });

    const data = await mascotasService.todas().catch(() => []);
    setMascotasActivas(data.filter((m) => m.estado === 'activo'));
    setModalAbierto(true);
  }

  async function guardar() {
    const idMascota = Number(form.idMascota);

    if (!idMascota) {
      return mostrarToast('Selecciona una mascota.', 'error');
    }

    if (!form.fecha) {
      return mostrarToast('Selecciona la fecha y hora.', 'error');
    }

    setGuardando(true);

    try {
      if (editandoId) {
        // Solo se puede actualizar estado/fecha/motivo — no el dueño ni la mascota.
        await citasService.actualizar(editandoId, {
          fechaHora: new Date(form.fecha).toISOString(),
          motivo: form.motivo.trim() || null,
          estado: form.estado,
        });

        mostrarToast('Cita actualizada.', 'ok');
      } else {
        const mascota = await mascotasService.obtener(idMascota).catch(() => null);

        if (!mascota || !mascota.idUsuario) {
          mostrarToast('No se pudo determinar el dueño de la mascota.', 'error');
          setGuardando(false);
          return;
        }

        await citasService.crear({
          fechaHora: new Date(form.fecha).toISOString(),
          motivo: form.motivo.trim() || null,
          idUsuario: mascota.idUsuario,
          idMascota,
        });

        mostrarToast('Cita creada.', 'ok');
      }

      setModalAbierto(false);
      await cargar();
    } catch (err) {
      mostrarToast(
        err instanceof Error ? err.message : 'Error al guardar la cita.',
        'error'
      );
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarEstado(c: Cita, nuevoEstado: string) {
    if (nuevoEstado === 'cancelada') {
      const quien = c.nombre_mascota ? ` de ${c.nombre_mascota}` : '';
      if (!(await confirmar(`¿Cancelar la cita${quien}?`))) return;
    }
    try {
      await citasService.actualizar(c.idCita, { estado: nuevoEstado });
      mostrarToast(`Cita ${nuevoEstado}.`, 'ok');
      await cargar();
    } catch (err) {
      mostrarToast(
        err instanceof Error ? err.message : 'Error al actualizar la cita.',
        'error'
      );
    }
  }

  return (
    <section id="sec-citas" className="seccion activa">
      <div className="sec-header">
        <div>
          <div className="sec-titulo">Citas</div>
          <div className="sec-subtitulo">Gestión de citas veterinarias</div>
        </div>

        <button className="btn-nuevo" onClick={abrirNueva}>
          <i className="ti ti-plus" /> Nueva cita
        </button>
      </div>

      <FiltroDias
        dias={filtros.dias}
        onChange={(v) => {
          setFiltro('dias', v);
          setFiltro('desde', '');
          setFiltro('hasta', '');
        }}
      />

      <FilterBar
        busqueda={filtros.q}
        onBusqueda={(v) => setFiltro('q', v)}
        placeholder="Buscar por paciente, dueño o motivo..."
        hayFiltros={hayFiltros}
        onLimpiar={limpiar}
      >
        <select
          className="filtro"
          value={filtros.estado}
          onChange={(e) => setFiltro('estado', e.target.value)}
        >
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="confirmada">Confirmada</option>
          <option value="completada">Completada</option>
          <option value="cancelada">Cancelada</option>
        </select>

        <label className="filter-bar-fecha">
          Desde
          <input
            type="date"
            value={filtros.desde}
            max={filtros.hasta || undefined}
            onChange={(e) => {
              setFiltro('desde', e.target.value);
              setFiltro('dias', '');
            }}
          />
        </label>

        <label className="filter-bar-fecha">
          Hasta
          <input
            type="date"
            value={filtros.hasta}
            min={filtros.desde || undefined}
            onChange={(e) => {
              setFiltro('hasta', e.target.value);
              setFiltro('dias', '');
            }}
          />
        </label>
      </FilterBar>


      {!cargando && error && (
        <EmptyState
          icono="ti-wifi-off"
          mensaje={error}
          accion={<button onClick={cargar}>Reintentar</button>}
        />
      )}

      {!cargando && !error && (
        <p className="conteo">{filtradas.length} cita(s) encontrada(s)</p>
      )}

      <div className="citas-lista">
        {cargando && <Skeleton variante="fila" cantidad={4} />}


        {!cargando && !error && !filtradas.length && (
          <EmptyState
            icono="ti-calendar-off"
            mensaje={
              hayFiltros
                ? 'Ninguna cita coincide con los filtros'
                : 'Sin citas registradas'
            }
            accion={
              hayFiltros ? (
                <button onClick={limpiar}>Limpiar filtros</button>
              ) : undefined
            }
          />
        )}

        {!cargando && !error && proximas.length > 0 && (
          <div className="vc-grupo">
            <div className="vc-grupo-titulo">Próximas <span>{proximas.length}</span></div>
            <div className="citas-lista">
              {proximas.map((c) => (
                <CitaFila key={c.idCita} cita={c} onEditar={abrirEditar} onEstado={cambiarEstado}
                  onFicha={(id) => navigate(`/admin/ficha/${id}`)} />
              ))}
            </div>
          </div>
        )}

        {!cargando && !error && anteriores.length > 0 && (
          <div className="vc-grupo">
            <div className="vc-grupo-titulo">Anteriores <span>{anteriores.length}</span></div>
            <div className="citas-lista">
              {anteriores.map((c) => (
                <CitaFila key={c.idCita} cita={c} onEditar={abrirEditar} onEstado={cambiarEstado}
                  onFicha={(id) => navigate(`/admin/ficha/${id}`)} />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className={`modal-fondo${modalAbierto ? ' abierto' : ''}`}>
        <div className="modal-caja">
          <div className="modal-titulo-fila">
            <div className="modal-titulo">
              {editandoId ? 'Editar cita' : 'Nueva cita'}
            </div>

            <button
              className="btn-cerrar"
              onClick={() => setModalAbierto(false)}
            >
              <i className="ti ti-x" />
            </button>
          </div>

          <SelectorPaciente
            mascotas={mascotasActivas}
            valor={form.idMascota}
            onChange={(v) => setForm((f) => ({ ...f, idMascota: v }))}
            disabled={!!editandoId}
          />

          <div className="campo">
            <label>Fecha y hora</label>

            <input
              type="datetime-local"
              value={form.fecha}
              onChange={(e) =>
                setForm((f) => ({ ...f, fecha: e.target.value }))
              }
            />
          </div>

          <div className="campo">
            <label>Motivo</label>

            <input
              type="text"
              placeholder="ej. Revisión general"
              value={form.motivo}
              onChange={(e) =>
                setForm((f) => ({ ...f, motivo: e.target.value }))
              }
            />
          </div>

          <div className="campo">
            <label>Estado</label>

            <select
              value={form.estado}
              onChange={(e) =>
                setForm((f) => ({ ...f, estado: e.target.value }))
              }
            >
              <option value="pendiente">Pendiente</option>
              <option value="confirmada">Confirmada</option>
              <option value="completada">Completada</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </div>

          <div className="modal-pie">
            <button
              className="btn-cancelar"
              onClick={() => setModalAbierto(false)}
            >
              Cancelar
            </button>

            <button
              className="btn-guardar"
              onClick={guardar}
              disabled={guardando}
            >
              <i className="ti ti-device-floppy" />{' '}
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}