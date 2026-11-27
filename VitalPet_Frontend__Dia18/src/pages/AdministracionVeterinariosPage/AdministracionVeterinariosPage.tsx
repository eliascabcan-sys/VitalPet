// =================================================================
// Archivo: src/pages/AdministracionVeterinariosPage/AdministracionVeterinariosPage.tsx
// RESPONSABILIDAD: El administrador crea y gestiona veterinarios
// (RQF-16/18): alta con cuenta de acceso, edición de datos
// profesionales, reseteo de contraseña, desactivar y reactivar.
// Endpoints: /veterinarios/ (GET, POST, PUT, DELETE, PUT reactivar)
// =================================================================
import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import { veterinariosService } from '../../services/veterinariosService';
import type { Veterinario } from '../../services/veterinariosService';
import { useToast } from '../../components/Toast/ToastContext';
import AdminModal from '../../components/AdminModal/AdminModal';
import '../../assets/css/admin.css';
import '../../assets/css/administracion.css';

const FORM_VACIO = {
  nombre: '',
  apellido: '',
  documento: '',
  telefono: '',
  email: '',
  contrasena: '',
  especialidad: '',
  tarjetaProfesional: '',
};

export default function AdministracionVeterinariosPage() {
  const [vets, setVets] = useState<Veterinario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const [busqueda, setBusqueda] = useState('');
  const [verInactivos, setVerInactivos] = useState(false);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Veterinario | null>(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);

  const { mostrarToast, confirmar } = useToast();

  async function cargar() {
    setCargando(true);
    setError('');
    try {
      setVets(await veterinariosService.listar(true));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar los veterinarios.');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalActivos = vets.filter((v) => v.estado !== 'inactivo').length;
  const totalInactivos = vets.length - totalActivos;

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return vets.filter(
      (v) =>
        (verInactivos || v.estado !== 'inactivo') &&
        (!q ||
          `${v.nombre || ''} ${v.apellido || ''}`.toLowerCase().includes(q) ||
          (v.email || '').toLowerCase().includes(q) ||
          (v.especialidad || '').toLowerCase().includes(q) ||
          v.tarjetaProfesional.toLowerCase().includes(q))
    );
  }, [vets, busqueda, verInactivos]);

  const campo = (k: keyof typeof FORM_VACIO) => (e: ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function abrirNuevo() {
    setEditando(null);
    setForm(FORM_VACIO);
    setModalAbierto(true);
  }

  function abrirEditar(v: Veterinario) {
    setEditando(v);
    setForm({
      ...FORM_VACIO,
      especialidad: v.especialidad || '',
      tarjetaProfesional: v.tarjetaProfesional,
    });
    setModalAbierto(true);
  }

  async function guardar() {
    if (form.tarjetaProfesional.trim().length < 3) {
      return mostrarToast('La tarjeta profesional debe tener al menos 3 caracteres.', 'error');
    }
    if (editando) {
      if (form.contrasena && form.contrasena.length < 10) {
        return mostrarToast('La nueva contraseña debe tener al menos 10 caracteres.', 'error');
      }
    } else {
      if (form.nombre.trim().length < 2) return mostrarToast('El nombre debe tener al menos 2 caracteres.', 'error');
      if (form.apellido.trim().length < 2) return mostrarToast('El apellido debe tener al menos 2 caracteres.', 'error');
      if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return mostrarToast('Escribe un correo válido.', 'error');
      if (form.contrasena.length < 10) return mostrarToast('La contraseña debe tener al menos 10 caracteres.', 'error');
    }

    setGuardando(true);
    try {
      if (editando) {
        await veterinariosService.actualizar(editando.idVeterinario, {
          especialidad: form.especialidad.trim() || null,
          tarjetaProfesional: form.tarjetaProfesional.trim(),
          ...(form.contrasena ? { contrasena: form.contrasena } : {}),
        });
        mostrarToast('Veterinario actualizado.', 'ok');
      } else {
        await veterinariosService.crear({
          nombre: form.nombre.trim(),
          apellido: form.apellido.trim(),
          documento: form.documento.trim() || null,
          telefono: form.telefono.trim() || null,
          email: form.email.trim(),
          contrasena: form.contrasena,
          especialidad: form.especialidad.trim() || null,
          tarjetaProfesional: form.tarjetaProfesional.trim(),
        });
        mostrarToast('Veterinario creado.', 'ok');
      }
      setModalAbierto(false);
      await cargar();
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : 'No se pudo guardar.', 'error');
    } finally {
      setGuardando(false);
    }
  }

  async function desactivar(v: Veterinario) {
    if (!await confirmar(`¿Desactivar a ${v.nombre || ''} ${v.apellido || ''}? No podrá iniciar sesión.`)) return;
    try {
      await veterinariosService.desactivar(v.idVeterinario);
      mostrarToast('Veterinario desactivado.', 'ok');
      await cargar();
    } catch (err) {
      // Ej.: "tiene N cita(s) futura(s) pendiente(s)" (RQF-18)
      mostrarToast(err instanceof Error ? err.message : 'No se pudo desactivar.', 'error');
    }
  }

  async function reactivar(v: Veterinario) {
    try {
      await veterinariosService.reactivar(v.idVeterinario);
      mostrarToast('Veterinario reactivado.', 'ok');
      await cargar();
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : 'No se pudo reactivar.', 'error');
    }
  }

  return (
    <section className="seccion activa">
      <div className="sec-header">
        <div>
          <div className="sec-titulo">Veterinarios</div>
          <div className="sec-subtitulo">Cuentas y datos profesionales del equipo clínico</div>
        </div>
        <button className="btn-nuevo" onClick={abrirNuevo}>
          <i className="ti ti-plus" /> Nuevo veterinario
        </button>
      </div>

      <div className="stats">
        <div className="stat">
          <div className="stat-icono">
            <i className="ti ti-stethoscope" />
          </div>
          <div>
            <div className="stat-label">Total</div>
            <div className="stat-valor">{vets.length}</div>
          </div>
        </div>
        <div className="stat">
          <div className="stat-icono verde">
            <i className="ti ti-check" />
          </div>
          <div>
            <div className="stat-label">Activos</div>
            <div className="stat-valor verde">{totalActivos}</div>
          </div>
        </div>
        <div className="stat">
          <div className="stat-icono acento">
            <i className="ti ti-user-off" />
          </div>
          <div>
            <div className="stat-label">Desactivados</div>
            <div className="stat-valor acento">{totalInactivos}</div>
          </div>
        </div>
      </div>

      <div className="toolbar">
        <div className="buscador">
          <i className="ti ti-search" />
          <input
            type="text"
            placeholder="Buscar por nombre, correo, especialidad o tarjeta..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <label className="adm-check" style={{ margin: 0 }}>
          <input type="checkbox" checked={verInactivos} onChange={(e) => setVerInactivos(e.target.checked)} />
          Mostrar desactivados
        </label>
      </div>

      {cargando && <p className="conteo">Cargando...</p>}
      {!cargando && error && (
        <div className="vacio">
          <i className="ti ti-wifi-off" />
          {error}
        </div>
      )}
      {!cargando && !error && <p className="conteo">{filtrados.length} veterinario(s) encontrado(s)</p>}

      {!cargando && !error && !filtrados.length && (
        <div className="vacio">
          <i className="ti ti-stethoscope-off" />
          No hay veterinarios para mostrar.
        </div>
      )}

      {!cargando && !error && filtrados.length > 0 && (
        <div className="adm-tabla-wrap">
          <table className="adm-tabla tarjetas">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Especialidad</th>
                <th>Tarjeta profesional</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtrados.map((v) => {
                const inactivo = v.estado === 'inactivo';
                return (
                  <tr key={v.idVeterinario} className={inactivo ? 'inactiva' : ''}>
                    <td>
                      <strong>
                        {v.nombre} {v.apellido}
                      </strong>
                      <div className="adm-sub">{v.email}</div>
                    </td>
                    <td data-label="Especialidad">{v.especialidad || 'General'}</td>
                    <td data-label="Tarjeta profesional">{v.tarjetaProfesional}</td>
                    <td data-label="Estado">
                      <span className={`chip ${inactivo ? 'inactivo' : 'activo'}`}>{inactivo ? 'Desactivado' : 'Activo'}</span>
                    </td>
                    <td>
                      <div className="adm-acciones">
                        <button className="btn-ico" title="Editar" onClick={() => abrirEditar(v)}>
                          <i className="ti ti-edit" />
                        </button>
                        {inactivo ? (
                          <button className="btn-ico verde" title="Reactivar" onClick={() => reactivar(v)}>
                            <i className="ti ti-user-check" />
                          </button>
                        ) : (
                          <button className="btn-ico rojo" title="Desactivar" onClick={() => desactivar(v)}>
                            <i className="ti ti-user-off" />
                          </button>
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
        titulo={editando ? `Editar a ${editando.nombre || ''} ${editando.apellido || ''}` : 'Nuevo veterinario'}
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
        {!editando && (
          <>
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
          </>
        )}

        <div className="campo-2">
          <div className="campo" style={{ margin: 0 }}>
            <label>Especialidad</label>
            <input type="text" placeholder="General" value={form.especialidad} onChange={campo('especialidad')} />
          </div>
          <div className="campo" style={{ margin: 0 }}>
            <label>Tarjeta profesional</label>
            <input type="text" value={form.tarjetaProfesional} onChange={campo('tarjetaProfesional')} />
          </div>
        </div>

        <div className="campo">
          <label>{editando ? 'Nueva contraseña (opcional)' : 'Contraseña'}</label>
          <input type="password" value={form.contrasena} onChange={campo('contrasena')} autoComplete="new-password" />
          <div className="adm-ayuda">
            {editando ? 'Déjala vacía para no cambiarla. ' : ''}Mínimo 10 caracteres.
          </div>
        </div>
      </AdminModal>
    </section>
  );
}