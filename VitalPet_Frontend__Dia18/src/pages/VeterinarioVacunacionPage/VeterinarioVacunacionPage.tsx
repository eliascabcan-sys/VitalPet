// =================================================================
// Archivo: src/pages/VeterinarioVacunacionPage/VeterinarioVacunacionPage.tsx
// RESPONSABILIDAD: Control de vacunas de todas las mascotas (stats,
// buscador, filtro por estado, CRUD). Migrado de admin-vacunacion.html
// + renderVacunas()/guardarVacuna()/eliminarVacuna() de admin.js.
// =================================================================
import { useEffect, useMemo, useState } from 'react';
import { ETIQUETA_TIPO_APLICACION, vacunasService } from '../../services/vacunasService';
import type { TipoAplicacion, Vacuna } from '../../services/vacunasService';
import { esquemaSanitarioService } from '../../services/esquemaSanitarioService';
import type { EsquemaSanitario as Esquema } from '../../services/esquemaSanitarioService';
import EsquemaSanitario from '../../components/EsquemaSanitario/EsquemaSanitario';
import { mascotasService } from '../../services/mascotasService';
import type { Mascota } from '../../services/mascotasService';
import { useToast } from '../../components/Toast/ToastContext';
import { useAuth } from '../../context/AuthContext';
import SelectorPaciente from '../../components/SelectorPaciente/SelectorPaciente';
import '../../assets/css/admin.css';

type EstadoVacuna = 'al_dia' | 'proxima' | 'vencida';

function estadoDeVacuna(v: Vacuna, hoy: Date, en30dias: Date): EstadoVacuna {
  if (!v.proxima_dosis) return 'al_dia';
  const prox = new Date(`${v.proxima_dosis}T00:00:00`);
  if (prox < hoy) return 'vencida';
  if (prox <= en30dias) return 'proxima';
  return 'al_dia';
}

const ETIQUETA: Record<EstadoVacuna, [string, string]> = {
  al_dia: ['Al día', 'verde'],
  proxima: ['Próxima a vencer', 'acento'],
  vencida: ['Vencida', 'rojo'],
};

export default function VeterinarioVacunacionPage() {
  const [vacunas, setVacunas] = useState<Vacuna[]>([]);
  const [mascotasActivas, setMascotasActivas] = useState<Mascota[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState('');

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [form, setForm] = useState({ idMascota: '', tipo: 'vacuna' as TipoAplicacion, nombre: '', fechaAplicacion: '', proximaFecha: '', veterinario: '' });
  const [idEsquema, setIdEsquema] = useState('');
  const [esquema, setEsquema] = useState<Esquema | null>(null);
  const [errorEsquema, setErrorEsquema] = useState('');
  const [guardando, setGuardando] = useState(false);

  const { mostrarToast, confirmar } = useToast();
  // El backend solo permite eliminar/desactivar al administrador (403 para veterinario).
  const { usuario } = useAuth();
  const esAdmin = usuario?.rol === 'administrador';

  const hoy = useMemo(() => {
    const h = new Date();
    h.setHours(0, 0, 0, 0);
    return h;
  }, []);
  const en30dias = useMemo(() => {
    const d = new Date(hoy);
    d.setDate(d.getDate() + 30);
    return d;
  }, [hoy]);

  async function cargar() {
    setCargando(true);
    setError('');
    try {
      const mascotas = (await mascotasService.todas()).filter((m) => m.estado === 'activo');
      setMascotasActivas(mascotas);
      const porMascota = await Promise.all(
        mascotas.map((m) => vacunasService.porMascota(m.idMascota).catch(() => []))
      );
      setVacunas(porMascota.flat().filter((v) => v.estado !== 'inactivo'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar mascotas.');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalAlDia = vacunas.filter((v) => estadoDeVacuna(v, hoy, en30dias) === 'al_dia').length;
  const totalProximasOVencidas = vacunas.filter((v) => estadoDeVacuna(v, hoy, en30dias) !== 'al_dia').length;

  const filtradas = useMemo(() => {
    const q = busqueda.toLowerCase();
    return vacunas.filter(
      (v) =>
        (!q || (v.nombre_mascota || '').toLowerCase().includes(q) || v.nombre_vacuna.toLowerCase().includes(q)) &&
        (!filtro || estadoDeVacuna(v, hoy, en30dias) === filtro)
    );
  }, [vacunas, busqueda, filtro, hoy, en30dias]);

  function abrirNueva() {
    setEditandoId(null);
    setForm({ idMascota: '', tipo: 'vacuna', nombre: '', fechaAplicacion: '', proximaFecha: '', veterinario: '' });
    setModalAbierto(true);
  }

  async function verEsquema(id: string) {
    setIdEsquema(id);
    setEsquema(null);
    setErrorEsquema('');
    if (!id) return;
    try {
      setEsquema(await esquemaSanitarioService.porMascota(Number(id)));
    } catch (err) {
      setErrorEsquema(err instanceof Error ? err.message : 'No se pudo cargar el esquema.');
    }
  }

  async function abrirEditar(id: number) {
    try {
      const data = await vacunasService.obtener(id);
      setEditandoId(id);
      setForm({
        idMascota: String(data.idMascota),
        tipo: data.tipo ?? 'vacuna',
        nombre: data.nombre_vacuna || '',
        fechaAplicacion: data.fecha_aplicacion || '',
        proximaFecha: data.proxima_dosis || '',
        veterinario: data.veterinario || '',
      });
      setModalAbierto(true);
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : 'Error al cargar la vacuna.', 'error');
    }
  }

  async function guardar() {
    if (!form.nombre.trim()) return mostrarToast('Escribe el nombre de la vacuna o del producto.', 'error');
    if (!form.fechaAplicacion) return mostrarToast('Selecciona la fecha de aplicación.', 'error');
    if (form.proximaFecha && form.proximaFecha <= form.fechaAplicacion) {
      return mostrarToast('La próxima dosis debe ser posterior a la fecha de aplicación.', 'error');
    }

    setGuardando(true);
    try {
      if (editandoId) {
        await vacunasService.actualizar(editandoId, {
          tipo: form.tipo,
          nombre_vacuna: form.nombre.trim(),
          fecha_aplicacion: form.fechaAplicacion,
          proxima_dosis: form.proximaFecha || null,
          veterinario: form.veterinario.trim() || null,
        });
        mostrarToast('Vacuna actualizada.', 'ok');
      } else {
        const idMascota = Number(form.idMascota);
        if (!idMascota) {
          mostrarToast('Selecciona una mascota.', 'error');
          setGuardando(false);
          return;
        }
        await vacunasService.crear({
          idMascota,
          tipo: form.tipo,
          nombre_vacuna: form.nombre.trim(),
          fecha_aplicacion: form.fechaAplicacion,
          proxima_dosis: form.proximaFecha || null,
          veterinario: form.veterinario.trim() || null,
        });
        mostrarToast('Vacuna registrada.', 'ok');
      }
      setModalAbierto(false);
      await cargar();
      if (idEsquema) esquemaSanitarioService.porMascota(Number(idEsquema)).then(setEsquema).catch(() => undefined);
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : 'No se pudo registrar la vacuna.', 'error');
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(id: number) {
    if (!await confirmar('¿Desactivar esta vacuna de la certificación de vacunación?')) return;
    try {
      await vacunasService.eliminar(id);
      mostrarToast('Vacuna desactivada.', 'ok');
      await cargar();
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : 'Error al desactivar.', 'error');
    }
  }

  return (
    <section id="sec-vacunacion" className="seccion activa">
      <div className="sec-header">
        <div>
          <div className="sec-titulo">Esquema sanitario</div>
          <div className="sec-subtitulo">Vacunas, desparasitación y antipulgas: lo aplicado y lo que le toca a cada paciente</div>
        </div>
        <button className="btn-nuevo" onClick={abrirNueva}>
          <i className="ti ti-plus" /> Nueva aplicación
        </button>
      </div>

      <div className="stats">
        <div className="stat">
          <div className="stat-icono">
            <i className="ti ti-vaccine" />
          </div>
          <div>
            <div className="stat-label">Total aplicadas</div>
            <div className="stat-valor">{vacunas.length}</div>
          </div>
        </div>
        <div className="stat">
          <div className="stat-icono verde">
            <i className="ti ti-check" />
          </div>
          <div>
            <div className="stat-label">Al día</div>
            <div className="stat-valor verde">{totalAlDia}</div>
          </div>
        </div>
        <div className="stat">
          <div className="stat-icono acento">
            <i className="ti ti-clock" />
          </div>
          <div>
            <div className="stat-label">Próximas a vencer</div>
            <div className="stat-valor acento">{totalProximasOVencidas}</div>
          </div>
        </div>
      </div>

      <div className="toolbar" style={{ flexWrap: 'wrap', gap: 8 }}>
        <select
          className="filtro"
          aria-label="Ver esquema sanitario de"
          value={idEsquema}
          onChange={(e) => verEsquema(e.target.value)}
        >
          <option value="">Esquema sanitario de...</option>
          {mascotasActivas.map((m) => (
            <option key={m.idMascota} value={m.idMascota}>{m.nombre_mascota} ({m.especie})</option>
          ))}
        </select>
      </div>
      {errorEsquema && <p className="conteo">{errorEsquema}</p>}
      {esquema && <EsquemaSanitario esquema={esquema} />}

      <div className="toolbar">
        <div className="buscador">
          <i className="ti ti-search" />
          <input
            type="text"
            placeholder="Buscar por mascota o vacuna..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <select className="filtro" value={filtro} onChange={(e) => setFiltro(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="al_dia">Al día</option>
          <option value="proxima">Próxima a vencer</option>
          <option value="vencida">Vencida</option>
        </select>
      </div>

      {cargando && <p className="conteo">Cargando...</p>}
      {!cargando && error && (
        <div className="vacio">
          <i className="ti ti-wifi-off" />
          {error}
        </div>
      )}
      {!cargando && !error && <p className="conteo">{filtradas.length} vacuna(s) encontrada(s)</p>}

      <div className="hist-lista">
        {!cargando && !error && !filtradas.length && (
          <div className="vacio">
            <i className="ti ti-vaccine-off" />
            Sin vacunas registradas.
          </div>
        )}
        {!cargando &&
          !error &&
          filtradas.map((v) => {
            const [texto, clase] = ETIQUETA[estadoDeVacuna(v, hoy, en30dias)];
            return (
              <div className="hist-card" key={v.idVacuna}>
                <div className="hist-header">
                  <span className="hist-mascota">{v.nombre_mascota || `Mascota ID: ${v.idMascota}`}</span>
                  <span className={`stat-valor ${clase}`} style={{ fontSize: 14 }}>
                    {texto}
                  </span>
                </div>
                <div className="hist-campo">
                  <label>{ETIQUETA_TIPO_APLICACION[v.tipo ?? 'vacuna']}</label>
                  <p>{v.nombre_vacuna}</p>
                </div>
                <div className="hist-campo">
                  <label>Aplicada</label>
                  <p>{v.fecha_aplicacion}</p>
                </div>
                {v.proxima_dosis && (
                  <div className="hist-campo">
                    <label>Próxima dosis</label>
                    <p>{v.proxima_dosis}</p>
                  </div>
                )}
                {v.veterinario && (
                  <div className="hist-campo">
                    <label>Veterinario</label>
                    <p>{v.veterinario}</p>
                  </div>
                )}
                <div className="hist-acciones">
                  <button onClick={() => abrirEditar(v.idVacuna)}>
                    <i className="ti ti-edit" /> Editar
                  </button>
                  {esAdmin && (
                    <button className="btn-del" onClick={() => eliminar(v.idVacuna)}>
                      <i className="ti ti-trash" /> Eliminar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
      </div>

      <div className={`modal-fondo${modalAbierto ? ' abierto' : ''}`}>
        <div className="modal-caja">
          <div className="modal-titulo-fila">
            <div className="modal-titulo">{editandoId ? 'Editar aplicación' : 'Nueva aplicación'}</div>
            <button className="btn-cerrar" onClick={() => setModalAbierto(false)}>
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
            <label>Tipo</label>
            <select value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value as TipoAplicacion }))}>
              {(Object.keys(ETIQUETA_TIPO_APLICACION) as TipoAplicacion[]).map((t) => (
                <option key={t} value={t}>{ETIQUETA_TIPO_APLICACION[t]}</option>
              ))}
            </select>
          </div>

          <div className="campo">
            <label>{form.tipo === 'vacuna' ? 'Vacuna' : 'Producto aplicado'}</label>
            <input type="text" value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} />
          </div>

          <div className="campo">
            <label>Fecha de aplicación</label>
            <input
              type="date"
              value={form.fechaAplicacion}
              onChange={(e) => setForm((f) => ({ ...f, fechaAplicacion: e.target.value }))}
            />
          </div>

          <div className="campo">
            <label>Próxima dosis (opcional)</label>
            <input
              type="date"
              value={form.proximaFecha}
              onChange={(e) => setForm((f) => ({ ...f, proximaFecha: e.target.value }))}
            />
          </div>

          <div className="campo">
            <label>Veterinario (opcional)</label>
            <input
              type="text"
              value={form.veterinario}
              onChange={(e) => setForm((f) => ({ ...f, veterinario: e.target.value }))}
            />
          </div>

          <div className="modal-pie">
            <button className="btn-cancelar" onClick={() => setModalAbierto(false)}>
              Cancelar
            </button>
            <button className="btn-guardar" onClick={guardar} disabled={guardando}>
              <i className="ti ti-device-floppy" /> {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
