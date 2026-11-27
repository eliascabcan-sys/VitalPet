// =================================================================
// Archivo: src/components/PerfilModal/PerfilModal.tsx
// RESPONSABILIDAD: Módulo de "Actualización de datos" (mi perfil).
// Migrado de templates/actualizacion-admin.html, actualizacion-dueno.html
// y actualizacion-veterinario.html, que eran EL MISMO formulario
// duplicado 3 veces (uno por rol). Acá es un único componente que
// sirve para los 3 roles, igual que hacía /users/me en el backend.
//
// Se abre desde el pie del sidebar (NavBar) en cualquiera de los 3
// paneles. Usa las clases .modal-fondo/.modal-caja/.campo/.modal-pie que
// ya existen en admin.css para no duplicar estilos.
// =================================================================
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/Toast/ToastContext';
import { usersService } from '../../services/usersService';
import '../../assets/css/admin.css';

interface Props {
  abierto: boolean;
  onClose: () => void;
}

interface FormPerfil {
  nombre: string;
  apellido: string;
  documento: string;
  telefono: string;
  fechaNacimiento: string;      // en la interface
  email: string;
  contrasena: string;
}

const FORM_VACIO: FormPerfil = {
  nombre: '',
  apellido: '',
  documento: '',
  telefono: '',
  fechaNacimiento: '',          // en FORM_VACIO
  email: '',
  contrasena: '',
};

export default function PerfilModal({ abierto, onClose }: Props) {
  const { actualizarUsuario } = useAuth();
  const { mostrarToast } = useToast();

  const [form, setForm] = useState<FormPerfil>(FORM_VACIO);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // Carga los datos actuales del usuario en sesión cada vez que se abre,
  // igual que hacía abrirModalPerfil() con GET /users/me.
  useEffect(() => {
    if (!abierto) return;

    setCargando(true);
    usersService
      .miPerfil()
      .then((u) => {
        setForm({
          nombre: u.nombre || '',
          apellido: u.apellido || '',
          documento: u.documento || '',
          telefono: u.telefono || '',
          fechaNacimiento: u.fechaNacimiento || '',
          email: u.email || '',
          contrasena: '',
        });
      })
      .catch((err) => {
        mostrarToast(err instanceof Error ? err.message : 'No se pudo cargar tu perfil.', 'error');
        onClose();
      })
      .finally(() => setCargando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  if (!abierto) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (form.nombre.trim().length < 2 || form.apellido.trim().length < 2) {
      mostrarToast('Nombre y apellido deben tener al menos 2 caracteres.', 'error');
      return;
    }
    if (form.contrasena && form.contrasena.length < 10) {
      mostrarToast('La nueva contraseña debe tener al menos 10 caracteres.', 'error');
      return;
    }

    setGuardando(true);
    try {
      const actualizado = await usersService.actualizarMiPerfil({
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim(),
        documento: form.documento.trim() || null,
        telefono: form.telefono.trim() || null,
        fechaNacimiento: form.fechaNacimiento || null,
        email: form.email.trim(),
        ...(form.contrasena ? { contrasena: form.contrasena } : {}),
      });
      // Refleja los cambios (nombre, email...) en el sidebar sin recargar la página.
      actualizarUsuario({ nombre: actualizado.nombre, apellido: actualizado.apellido, email: actualizado.email });
      mostrarToast('✅ Perfil actualizado correctamente.', 'ok');
      onClose();
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : 'No se pudo actualizar el perfil.', 'error');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="modal-fondo abierto">
      <div className="modal-caja">
        <div className="modal-titulo-fila">
          <div className="modal-titulo">
            <i className="ti ti-user-circle" /> Mi perfil
          </div>
          <button className="btn-cerrar" onClick={onClose}>
            <i className="ti ti-x" />
          </button>
        </div>

        {cargando ? (
          <p style={{ fontSize: 14, color: 'var(--color-texto-gris)' }}>Cargando...</p>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="campo-2">
              <div className="campo">
                <label>Nombre</label>
                <input
                  type="text"
                  required
                  minLength={2}
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                />
              </div>
              <div className="campo">
                <label>Apellido</label>
                <input
                  type="text"
                  required
                  minLength={2}
                  value={form.apellido}
                  onChange={(e) => setForm((f) => ({ ...f, apellido: e.target.value }))}
                />
              </div>
            </div>

            <div className="campo-2">
              <div className="campo">
                <label>Documento</label>
                <input
                  type="text"
                  value={form.documento}
                  onChange={(e) => setForm((f) => ({ ...f, documento: e.target.value }))}
                />
              </div>
              <div className="campo">
                <label>Teléfono</label>
                <input
                  type="text"
                  placeholder="Ej: 3001234567"
                  value={form.telefono}
                  onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
                />
              </div>
            </div>

            <div className="campo">
              <label>Fecha de nacimiento (opcional)</label>
              <input
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                value={form.fechaNacimiento}
                onChange={(e) => setForm((f) => ({ ...f, fechaNacimiento: e.target.value }))}
              />
            </div>

            <div className="campo">
              <label>Correo</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>

            <div className="campo">
              <label>Nueva contraseña (opcional, mín. 10 caracteres)</label>
              <input
                type="password"
                minLength={10}
                placeholder="Dejar vacío para no cambiarla"
                value={form.contrasena}
                onChange={(e) => setForm((f) => ({ ...f, contrasena: e.target.value }))}
              />
            </div>

            <div className="modal-pie">
              <button type="button" className="btn-cancelar" onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" className="btn-guardar" disabled={guardando}>
                <i className="ti ti-device-floppy" /> {guardando ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
