// =================================================================
// Archivo: src/pages/RegistroPage/RegistroPage.tsx
// RESPONSABILIDAD: Registro de dueños (el único rol que se autorregistra;
// veterinario/administrador los crea el admin). Migrado de registro.html.
// =================================================================
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '../../services/authService';
import { useToast } from '../../components/Toast/ToastContext';
import AuthPanel from '../../components/AuthPanel/AuthPanel';
import '../../assets/css/auth.css';

// Campo de contraseña con botón de ojo para mostrar / ocultar lo escrito.
function CampoContrasena({ value, onChange, autoComplete }: {
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={visible ? 'text' : 'password'}
        required
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ paddingRight: 44 }}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        aria-pressed={visible}
        style={{
          position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
          width: 36, height: 36, padding: 0, border: 'none', background: 'transparent',
          cursor: 'pointer', color: '#6b7280', fontSize: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <i className={visible ? 'ti ti-eye-off' : 'ti ti-eye'} />
      </button>
    </div>
  );
}

export default function RegistroPage() {
  const { mostrarToast } = useToast();
  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    documento: '',
    telefono: '',
    fechaNacimiento: '',
    correo: '',
    password: '',
    confirmar: '',
  });
  const [cargando, setCargando] = useState(false);
  const navigate = useNavigate();

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
  e.preventDefault();

  if (form.password !== form.confirmar) {
    mostrarToast('Las contraseñas no coinciden.', 'error');
    return;
  }
  if (form.password.length < 10) {
    mostrarToast('La contraseña debe tener al menos 10 caracteres.', 'error');
    return;
  }

  setCargando(true);
  try {
    await authService.registro({
      nombre: form.nombre.trim(),
      apellido: form.apellido.trim(),
      documento: form.documento.trim() || null,
      telefono: form.telefono.trim() || null,
      fechaNacimiento: form.fechaNacimiento || null,
      email: form.correo.trim(),
      contrasena: form.password,
    });
    mostrarToast('Usuario registrado. Ahora inicia sesión.', 'ok');
    navigate('/login');
  } catch (err) {
    mostrarToast(err instanceof Error ? err.message : 'Error al registrar. Intenta con otro correo.', 'error');
  } finally {
    setCargando(false);
  }
}

  return (
    <div className="vp-auth">
      <AuthPanel />
      <div className="panel-right">
        <div className="form-container form-container-ancho">
          <Link to="/" className="back-home">
            ← Volver al inicio
          </Link>

          <h1>Crear cuenta</h1>
          <p className="subtitle">Regístrate como dueño para acceder a VitalPet</p>

          <form onSubmit={handleSubmit} className="form-registro">
            <div className="field">
              <label>Nombres</label>
              <input
                type="text"
                minLength={2}
                required
                value={form.nombre}
                onChange={(e) => set('nombre', e.target.value)}
              />
            </div>

            <div className="field">
              <label>Apellidos</label>
              <input
                type="text"
                minLength={2}
                required
                value={form.apellido}
                onChange={(e) => set('apellido', e.target.value)}
              />
            </div>

            <div className="field">
              <label>Documento (opcional)</label>
              <input
                type="text"
                maxLength={20}
                value={form.documento}
                onChange={(e) => set('documento', e.target.value)}
              />
            </div>

            <div className="field">
              <label>Teléfono (opcional)</label>
              <input
                type="text"
                maxLength={20}
                value={form.telefono}
                onChange={(e) => set('telefono', e.target.value)}
              />
            </div>

            <div className="field">
              <label>Fecha de nacimiento (opcional)</label>
              <input
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                value={form.fechaNacimiento}
                onChange={(e) => set('fechaNacimiento', e.target.value)}
              />
            </div>

            <div className="field">
              <label>Correo electrónico</label>
              <input
                type="email"
                required
                value={form.correo}
                onChange={(e) => set('correo', e.target.value)}
              />
            </div>

            <div className="field">
              <label>Contraseña</label>
              <CampoContrasena
                value={form.password}
                onChange={(v) => set('password', v)}
                autoComplete="new-password"
              />
            </div>

            <div className="field">
              <label>Confirmar contraseña</label>
              <CampoContrasena
                value={form.confirmar}
                onChange={(v) => set('confirmar', v)}
                autoComplete="new-password"
              />
            </div>


            <button type="submit" className="btn-principal" disabled={cargando}>
              {cargando ? 'Registrando...' : 'Registrarse'}
            </button>

            <div className="register">
              ¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}