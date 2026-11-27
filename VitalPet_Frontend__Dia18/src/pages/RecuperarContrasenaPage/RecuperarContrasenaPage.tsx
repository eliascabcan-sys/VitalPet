// =================================================================
// Archivo: src/pages/RecuperarContrasenaPage/RecuperarContrasenaPage.tsx
// RESPONSABILIDAD: Página que abre el enlace del correo de recuperación
// (?token=...) y permite definir la nueva contraseña. Migrado de
// recuperar-contrasena.html.
// =================================================================
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { authService } from '../../services/authService';
import AuthPanel from '../../components/AuthPanel/AuthPanel';
import '../../assets/css/auth.css';

export default function RecuperarContrasenaPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const navigate = useNavigate();

  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [error, setError] = useState('');
  const [exito, setExito] = useState(false);
  const [cargando, setCargando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (nueva !== confirmar) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    if (nueva.length < 10) {
      setError('La contraseña debe tener al menos 10 caracteres.');
      return;
    }

    setCargando(true);
    try {
      await authService.restablecerContrasena(token as string, nueva);
      setExito(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo restablecer la contraseña.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="vp-auth">
      <AuthPanel />
      <div className="panel-right">
        <div className="form-container">
          <Link to="/login" className="back-home">
            ← Volver al login
          </Link>

          <h1>Restablecer contraseña</h1>

          {!token ? (
            <>
              <p className="subtitle">Escribe tu nueva contraseña.</p>
              <p className="modal-recuperar-texto">
                Este enlace no es válido o ya expiró. Solicita uno nuevo desde la pantalla de inicio de
                sesión.
              </p>
              <Link
                to="/login"
                className="btn-principal"
                style={{ display: 'inline-block', textAlign: 'center', textDecoration: 'none' }}
              >
                Volver al login
              </Link>
            </>
          ) : exito ? (
            <p
              className="modal-recuperar-texto"
              style={{ color: '#2D6A4F', fontWeight: 600 }}
            >
              ✅ Tu contraseña se actualizó correctamente. Ya puedes iniciar sesión.
            </p>
          ) : (
            <>
              <p className="subtitle">Escribe tu nueva contraseña.</p>
              <form onSubmit={handleSubmit}>
                <div className="field">
                  <label>Nueva contraseña</label>
                  <input
                    type="password"
                    placeholder="Mínimo 10 caracteres"
                    minLength={10}
                    required
                    value={nueva}
                    onChange={(e) => setNueva(e.target.value)}
                  />
                </div>

                <div className="field">
                  <label>Confirmar contraseña</label>
                  <input
                    type="password"
                    placeholder="Repite la contraseña"
                    minLength={10}
                    required
                    value={confirmar}
                    onChange={(e) => setConfirmar(e.target.value)}
                  />
                </div>

                <button type="submit" className="btn-principal" disabled={cargando}>
                  {cargando ? 'Guardando...' : 'Guardar nueva contraseña'}
                </button>
              </form>

              {error && <p className="modal-recuperar-error">{error}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
