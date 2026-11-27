// =================================================================
// Archivo: src/pages/AdministracionUsuariosPage/AdministracionUsuariosPage.tsx
// RESPONSABILIDAD: Gestión de cuentas por el administrador.
//  - Pestaña "Dueños": buscar, editar, desactivar y reactivar.
//    (Los dueños se registran solos; el admin no los crea.)
//  - Pestaña "Administradores": además permite crear nuevos.
// Endpoints: GET /users/, PUT /users/{id}, DELETE /users/{id},
//            PUT /users/{id}/reactivar, POST /users/staff
// =================================================================
import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import { usersService } from '../../services/usersService';
import type { UsuarioAdmin } from '../../services/usersService';
import { useToast } from '../../components/Toast/ToastContext';
import { useAuth } from '../../context/AuthContext';
import AdminModal from '../../components/AdminModal/AdminModal';
import FilterBar from '../../components/FilterBar/FilterBar';
import EmptyState from '../../components/EmptyState/EmptyState';
import Skeleton from '../../components/Skeleton/Skeleton';
import { useFiltrosURL } from '../../hooks/useFiltrosURL';
import '../../assets/css/admin.css';
import '../../assets/css/administracion.css';

type Pestana = 'dueno' | 'administrador';

// Filtros que se guardan en la URL: ?q=perez&inactivos=1
// (la pestaña Dueños / Administradores sigue siendo estado local)
const FILTROS = { q: '', inactivos: '' };

const FORM_VACIO = { nombre: '', apellido: '', documento: '', telefono: '', email: '', contrasena: '' };

export default function AdministracionUsuariosPage() {
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const [pestana, setPestana] = useState<Pestana>('dueno');
  const { filtros, setFiltro, limpiar, hayFiltros } = useFiltrosURL(FILTROS);
  const verInactivosURL = filtros.inactivos === '1';

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);

  const { mostrarToast, confirmar } = useToast();
  const { usuario } = useAuth();

  async function cargar() {
    setCargando(true);
    setError('');
    try {
      setUsuarios(await usersService.listar(true));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar los usuarios.');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activos = (rol: Pestana) => usuarios.filter((u) => u.rol === rol && u.estado !== 'inactivo').length;
  const totalInactivos = usuarios.filter((u) => (u.rol === 'dueno' || u.rol === 'administrador') && u.estado === 'inactivo').length;

  const filtrados = useMemo(() => {
    const q = filtros.q.trim().toLowerCase();

    return usuarios.filter(
      (u) =>
        u.rol === pestana &&
        (verInactivosURL || u.estado !== 'inactivo') &&
        (!q ||
          `${u.nombre} ${u.apellido}`.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.documento || '').toLowerCase().includes(q))
    );
  }, [usuarios, pestana, filtros.q, verInactivosURL]);

  const campo = (k: keyof typeof FORM_VACIO) => (e: ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function abrirNuevo() {
    setEditandoId(null);
    setForm(FORM_VACIO);
    setModalAbierto(true);
  }

  function abrirEditar(u: UsuarioAdmin) {
    setEditandoId(u.idUsuario);
    setForm({
      nombre: u.nombre,
      apellido: u.apellido,
      documento: u.documento || '',
      telefono: u.telefono || '',
      email: u.email,
      contrasena: '',
    });
    setModalAbierto(true);
  }

  async function guardar() {
    if (form.nombre.trim().length < 2) return mostrarToast('El nombre debe tener al menos 2 caracteres.', 'error');
    if (form.apellido.trim().length < 2) return mostrarToast('El apellido debe tener al menos 2 caracteres.', 'error');
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return mostrarToast('Escribe un correo válido.', 'error');
    if (!editandoId && form.contrasena.length < 10) {
      return mostrarToast('La contraseña debe tener al menos 10 caracteres.', 'error');
    }
    if (editandoId && form.contrasena && form.contrasena.length < 10) {
      return mostrarToast('La nueva contraseña debe tener al menos 10 caracteres.', 'error');
    }

    setGuardando(true);
    try {
      if (editandoId) {
        await usersService.actualizar(editandoId, {
          nombre: form.nombre.trim(),
          apellido: form.apellido.trim(),
          documento: form.documento.trim() || null,
          telefono: form.telefono.trim() || null,
          email: form.email.trim(),
          ...(form.contrasena ? { contrasena: form.contrasena } : {}),
        });
        mostrarToast('Usuario actualizado.', 'ok');
      } else {
        await usersService.crearStaff({
          nombre: form.nombre.trim(),
          apellido: form.apellido.trim(),
          documento: form.documento.trim() || null,
          telefono: form.telefono.trim() || null,
          email: form.email.trim(),
          contrasena: form.contrasena,
          rol: 'administrador',
        });
        mostrarToast('Administrador creado.', 'ok');
      }
      setModalAbierto(false);
      await cargar();
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : 'No se pudo guardar.', 'error');
    } finally {
      setGuardando(false);
    }
  }

  async function desactivar(u: UsuarioAdmin) {
    if (!await confirmar(`¿Desactivar la cuenta de ${u.nombre} ${u.apellido}? No podrá iniciar sesión.`)) return;
    try {
      await usersService.desactivar(u.idUsuario);
      mostrarToast('Cuenta desactivada.', 'ok');
      await cargar();
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : 'No se pudo desactivar.', 'error');
    }
  }

  async function reactivar(u: UsuarioAdmin) {
    try {
      await usersService.reactivar(u.idUsuario);
      mostrarToast('Cuenta reactivada.', 'ok');
      await cargar();
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : 'No se pudo reactivar.', 'error');
    }
  }

  return (
    <section className="seccion activa">
      <div className="sec-header">
        <div>
          <div className="sec-titulo">Usuarios</div>
          <div className="sec-subtitulo">Gestión de cuentas de dueños y administradores</div>
        </div>
        {pestana === 'administrador' && (
          <button className="btn-nuevo" onClick={abrirNuevo}>
            <i className="ti ti-plus" /> Nuevo administrador
          </button>
        )}
      </div>

      <div className="stats">
        <div className="stat">
          <div className="stat-icono">
            <i className="ti ti-users" />
          </div>
          <div>
            <div className="stat-label">Dueños activos</div>
            <div className="stat-valor">{activos('dueno')}</div>
          </div>
        </div>
        <div className="stat">
          <div className="stat-icono verde">
            <i className="ti ti-shield-check" />
          </div>
          <div>
            <div className="stat-label">Administradores</div>
            <div className="stat-valor verde">{activos('administrador')}</div>
          </div>
        </div>
        <div className="stat">
          <div className="stat-icono acento">
            <i className="ti ti-user-off" />
          </div>
          <div>
            <div className="stat-label">Cuentas desactivadas</div>
            <div className="stat-valor acento">{totalInactivos}</div>
          </div>
        </div>
      </div>

      <div className="adm-tabs">
        <button className={`adm-tab${pestana === 'dueno' ? ' activa' : ''}`} onClick={() => setPestana('dueno')}>
          Dueños
        </button>
        <button
          className={`adm-tab${pestana === 'administrador' ? ' activa' : ''}`}
          onClick={() => setPestana('administrador')}
        >
          Administradores
        </button>
      </div>

      <FilterBar
        busqueda={filtros.q}
        onBusqueda={(v) => setFiltro('q', v)}
        placeholder="Buscar por nombre, correo o documento..."
        hayFiltros={hayFiltros}
        onLimpiar={limpiar}
      >
        <label className="adm-check" style={{ margin: 0 }}>
          <input
            type="checkbox"
            checked={verInactivosURL}
            onChange={(e) => setFiltro('inactivos', e.target.checked ? '1' : '')}
          />
          Mostrar desactivados
        </label>
      </FilterBar>

      {cargando && (
        <div className="skeleton-lista">
          <Skeleton variante="fila" cantidad={4} />
        </div>
      )}


      {!cargando && error && (
        <EmptyState
          icono="ti-wifi-off"
          mensaje={error}
          accion={<button onClick={cargar}>Reintentar</button>}
        />
      )}

      {!cargando && !error && <p className="conteo">{filtrados.length} usuario(s) encontrado(s)</p>}


      {!cargando && !error && !filtrados.length && (
        <EmptyState
          icono="ti-users-minus"
          mensaje={hayFiltros ? 'Ningún usuario coincide con los filtros' : 'No hay usuarios para mostrar'}
          accion={hayFiltros ? <button onClick={limpiar}>Limpiar filtros</button> : undefined}
        />
      )}

      {!cargando && !error && filtrados.length > 0 && (
        <div className="adm-tabla-wrap">
          <table className="adm-tabla tarjetas">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Documento</th>
                <th>Teléfono</th>
                <th>Registro</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtrados.map((u) => {
                const inactivo = u.estado === 'inactivo';
                const esYo = u.idUsuario === usuario?.idUsuario;
                return (
                  <tr key={u.idUsuario} className={inactivo ? 'inactiva' : ''}>
                    <td>
                      <strong>
                        {u.nombre} {u.apellido}
                      </strong>
                      <div className="adm-sub">{u.email}</div>
                    </td>
                    <td data-label="Documento">{u.documento || '—'}</td>
                    <td data-label="Teléfono">{u.telefono || '—'}</td>
                    <td data-label="Registro">
                      {u.fechaCreacion ? new Date(u.fechaCreacion).toLocaleDateString('es-CO') : '—'}
                    </td>
                    <td data-label="Estado">
                      <span className={`chip ${inactivo ? 'inactivo' : 'activo'}`}>
                        {inactivo ? 'Desactivado' : 'Activo'}
                      </span>
                    </td>
                    <td>
                      <div className="adm-acciones">
                        <button className="btn-ico" title="Editar" onClick={() => abrirEditar(u)}>
                          <i className="ti ti-edit" />
                        </button>
                        {inactivo ? (
                          <button className="btn-ico verde" title="Reactivar" onClick={() => reactivar(u)}>
                            <i className="ti ti-user-check" />
                          </button>
                        ) : (
                          !esYo && (
                            <button className="btn-ico rojo" title="Desactivar" onClick={() => desactivar(u)}>
                              <i className="ti ti-user-off" />
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <AdminModal
        abierto={modalAbierto}
        titulo={editandoId ? 'Editar usuario' : 'Nuevo administrador'}
        onClose={() => setModalAbierto(false)}
        pie={
          <>
            <button className="btn-cancelar" onClick={() => setModalAbierto(false)}>
              Cancelar
            </button>
            <button className="btn-guardar" onClick={guardar} disabled={guardando}>
              <i className="ti ti-device-floppy" /> {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          </>
        }
      >
        <div className="campo-2">
          <div className="campo" style={{ margin: 0 }}>
            <label>Nombre</label>
            <input type="text" value={form.nombre} onChange={campo('nombre')} />
          </div>
          <div className="campo" style={{ margin: 0 }}>
            <label>Apellido</label>
            <input type="text" value={form.apellido} onChange={campo('apellido')} />
          </div>
        </div>

        <div className="campo-2">
          <div className="campo" style={{ margin: 0 }}>
            <label>Documento (opcional)</label>
            <input type="text" value={form.documento} onChange={campo('documento')} />
          </div>
          <div className="campo" style={{ margin: 0 }}>
            <label>Teléfono (opcional)</label>
            <input type="text" value={form.telefono} onChange={campo('telefono')} />
          </div>
        </div>

        <div className="campo">
          <label>Correo electrónico</label>
          <input type="email" value={form.email} onChange={campo('email')} />
        </div>

        <div className="campo">
          <label>{editandoId ? 'Nueva contraseña (opcional)' : 'Contraseña'}</label>
          <input
            type="password"
            value={form.contrasena}
            onChange={campo('contrasena')}
            autoComplete="new-password"
          />
          <div className="adm-ayuda">
            {editandoId ? 'Déjala vacía para no cambiarla. ' : ''}Mínimo 10 caracteres.
          </div>
        </div>
      </AdminModal>
    </section>
  );
}