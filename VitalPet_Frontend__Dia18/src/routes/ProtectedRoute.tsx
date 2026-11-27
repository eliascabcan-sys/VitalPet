// =================================================================
// Archivo: src/routes/ProtectedRoute.tsx
// RESPONSABILIDAD: Bloquea el acceso a rutas si no hay sesión, y
// opcionalmente restringe por rol (dueno / veterinario / administrador).
// =================================================================
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { Rol } from '../services/authService';

interface Props {
  rolesPermitidos?: Rol[];
}

export default function ProtectedRoute({ rolesPermitidos }: Props) {
  const { isAuthenticated, usuario } = useAuth();

  if (!isAuthenticated || !usuario) {
    return <Navigate to="/login" replace />;
  }

  if (rolesPermitidos && !rolesPermitidos.includes(usuario.rol)) {
    // Sesión válida pero rol equivocado para esta sección -> a su propio panel
    return <Navigate to={rutaInicioPorRol(usuario.rol)} replace />;
  }

  return <Outlet />;
}

export function rutaInicioPorRol(rol: Rol): string {
  if (rol === 'dueno') return '/dueno/inicio';
  if (rol === 'veterinario') return '/admin/pacientes';
  return '/administracion/usuarios';
}
