// =================================================================
// Archivo: src/pages/LoginPage/LoginPage.tsx
// RESPONSABILIDAD: Login + modal de "olvidé mi contraseña", migrado
// de login.html + auth.js. Redirige según el rol que devuelve la API.
// =================================================================
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '../../services/authService';
import { useAuth } from '../../context/AuthContext';
import { rutaInicioPorRol } from '../../routes/ProtectedRoute';
import { useToast } from '../../components/Toast/ToastContext';
import AuthPanel from '../../components/AuthPanel/AuthPanel';
import '../../assets/css/auth.css';

// Campo de contraseña con botón de ojo para mostrar / ocultar lo escrito.
function CampoContrasena({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [visible, setVisible] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={visible ? 'text' : 'password'}
        placeholder="••••••••"
        autoComplete="current-password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
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

export default function LoginPage() {
  const { mostrarToast } = useToast();
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [modalAbierto, setModalAbierto] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setCargando(true);
    try {
      const usuario = await authService.login(correo.trim(), password);
      login(usuario);
      navigate(rutaInicioPorRol(usuario.rol));
    } catch (err) {
    mostrarToast(err instanceof Error ? err.message : 'Correo o contraseña incorrectos.', 'error');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="vp-auth">
      <AuthPanel />
      <div className="panel-right">
      <div className="form-container">
        <Link to="/" className="back-home">
          ← Volver al inicio
        </Link>

        <h1>Bienvenido de nuevo</h1>
        <p className="subtitle">Inicia sesión para continuar en VitalPet</p>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Correo electrónico</label>
            <input
              type="email"
              placeholder="usuario@ejemplo.com"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label>Contraseña</label>
            <CampoContrasena value={password} onChange={setPassword} />
          </div>

          <div className="options">
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setModalAbierto(true);
              }}
            >
              ¿Olvidaste tu contraseña?
            </a>
          </div>

          

          <button type="submit" className="btn-principal" disabled={cargando}>
            {cargando ? 'Ingresando...' : 'Iniciar sesión'}
          </button>

          <a href={authService.loginConGoogleUrl()} className="btn-principal btn-google">
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
            </svg>
            Continuar con Google
          </a>
        </form>

        <div className="register">
          ¿No tienes cuenta? <Link to="/registro">Regístrate aquí</Link>
        </div>

        <div className="admin-access">
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              mostrarToast(
                'Usa el mismo formulario de arriba con tu correo y la contraseña que te asignó el administrador.'
              );
            }}
          >
            Acceder como veterinario/administrador
          </a>
        </div>
      </div>

      {modalAbierto && (
        <ModalRecuperar correoInicial={correo} onClose={() => setModalAbierto(false)} />
      )}
      </div>
    </div>
  );
}

// ---- Modal de recuperación (paso 1: pedir correo / paso 2: confirmación) ----
function ModalRecuperar({ correoInicial, onClose }: { correoInicial: string; onClose: () => void }) {
  const [correo, setCorreo] = useState(correoInicial);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!correo) return;
    setError('');
    setEnviando(true);
    try {
      // El backend siempre responde 200 exista o no el correo, para
      // no revelar qué correos están registrados.
      await authService.solicitarRecuperacion(correo.trim());
      setEnviado(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo procesar la solicitud.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="modal-fondo abierto">
      <div className="modal-recuperar">
        <div className="modal-recuperar-header">
          <h2>Recuperar contraseña</h2>
          <button type="button" className="btn-cerrar-modal" onClick={onClose}>
            <i>&times;</i>
          </button>
        </div>

        {!enviado ? (
          <>
            <p className="modal-recuperar-texto">
              Escribe el correo con el que te registraste. Te enviaremos un enlace para restablecer tu
              contraseña.
            </p>
            <form onSubmit={handleSubmit}>
              <div className="field">
                <label>Correo electrónico</label>
                <input
                  type="email"
                  placeholder="usuario@ejemplo.com"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="btn-principal" disabled={enviando}>
                {enviando ? 'Enviando...' : 'Enviar enlace de recuperación'}
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="modal-recuperar-texto">
              ✅ Si el correo está registrado, te llegará un enlace para restablecer tu contraseña en unos
              minutos. Revisa también la carpeta de spam.
            </p>
            <button type="button" className="btn-principal" onClick={onClose}>
              Entendido
            </button>
          </>
        )}

        {error && <p className="modal-recuperar-error">{error}</p>}
      </div>
    </div>
  );
}