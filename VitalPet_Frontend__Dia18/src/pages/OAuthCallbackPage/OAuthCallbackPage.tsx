// =================================================================
// Archivo: src/pages/OAuthCallbackPage/OAuthCallbackPage.tsx
// RESPONSABILIDAD: Recibe el redirect de "Continuar con Google" con
// el token en el hash de la URL, guarda la sesión y redirige según
// el rol. Migrado de oauth-callback.html.
// =================================================================
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { rutaInicioPorRol } from '../../routes/ProtectedRoute';
import type { Rol } from '../../services/authService';
import AuthPanel from '../../components/AuthPanel/AuthPanel';
import '../../assets/css/auth.css';

export default function OAuthCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  // StrictMode ejecuta el efecto dos veces en desarrollo; la 2.ª vez el hash ya
  // fue borrado y mostraría un error falso. Se procesa una sola vez.
  const procesado = useRef(false);

  useEffect(() => {
    if (procesado.current) return;
    procesado.current = true;

    const errorParam = params.get('error');
    if (errorParam) {
      setError(errorParam);
      return;
    }

    const datos = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = datos.get('access_token');

    if (!accessToken) {
      setError('No se recibió la información de Google. Intenta de nuevo.');
      return;
    }

    const rol = (datos.get('rol') as Rol) || 'dueno';

    login({
      access_token: accessToken,
      idUsuario: parseInt(datos.get('idUsuario') || '0', 10),
      nombre: datos.get('nombre') || '',
      apellido: datos.get('apellido') || '',
      rol,
      email: datos.get('email') || '',
    });

    window.history.replaceState(null, '', window.location.pathname);
    navigate(rutaInicioPorRol(rol), { replace: true });
    // Solo se ejecuta una vez al montar, con los params de la URL de entrada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="vp-auth">
      <AuthPanel />
      <div className="panel-right">
        <div className="form-container" style={{ textAlign: 'center' }}>
          <h1>{error ? 'No se pudo iniciar sesión' : 'Iniciando sesión con Google...'}</h1>
          {!error && (
            <p className="subtitle">Espera un momento, estamos completando tu acceso a VitalPet.</p>
          )}
          {error && <p className="modal-recuperar-error">{error}</p>}
          {error && (
            <Link
              to="/login"
              className="btn-principal"
              style={{ display: 'inline-block', textAlign: 'center', textDecoration: 'none' }}
            >
              Volver al login
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
