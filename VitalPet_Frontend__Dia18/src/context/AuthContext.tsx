// =================================================================
// Archivo: src/context/AuthContext.tsx
// RESPONSABILIDAD: Estado global de sesión. Reemplaza las lecturas
// sueltas de localStorage (vp_token, vp_nombre, vp_rol...) que hacía
// cada página en el proyecto original, centralizándolas en un solo lugar.
// El acceso a localStorage en sí vive en services/storage.ts (P4).
// =================================================================
import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Usuario } from '../services/authService';
import { storage, alEscucharSesionVencida } from '../services/storage';

interface SesionUsuario {
  idUsuario: number;
  nombre: string;
  apellido: string;
  rol: Usuario['rol'];
  email: string;
}

interface AuthContextType {
  usuario: SesionUsuario | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (usuario: Usuario) => void;
  logout: () => void;
  // Actualiza nombre/apellido/email de la sesión activa tras editar el
  // perfil (módulo de actualización de datos), sin necesidad de re-login.
  actualizarUsuario: (datos: Partial<Pick<SesionUsuario, 'nombre' | 'apellido' | 'email'>>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function leerSesionInicial(): { usuario: SesionUsuario | null; token: string | null } {
  const sesion = storage.leerSesion();
  if (!sesion) return { usuario: null, token: null };

  return {
    token: sesion.token,
    usuario: {
      idUsuario: sesion.idUsuario,
      nombre: sesion.nombre,
      apellido: sesion.apellido,
      rol: sesion.rol as SesionUsuario['rol'],
      email: sesion.email,
    },
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [{ usuario, token }, setSesion] = useState(leerSesionInicial());

  const login = (data: Usuario) => {
    storage.guardarSesion({
      token: data.access_token,
      idUsuario: data.idUsuario,
      nombre: data.nombre,
      apellido: data.apellido || '',
      rol: data.rol,
      email: data.email,
    });

    setSesion({
      token: data.access_token,
      usuario: {
        idUsuario: data.idUsuario,
        nombre: data.nombre,
        apellido: data.apellido,
        rol: data.rol,
        email: data.email,
      },
    });
  };

  const logout = () => {
    storage.limpiarSesion();
    setSesion({ usuario: null, token: null });
  };

  // Si api.ts detecta un 401 (token vencido), ya limpió localStorage y
  // disparó este evento: aquí se refleja ese cierre de sesión en el
  // estado de React, sin necesidad de recargar la página.
  useEffect(() => alEscucharSesionVencida(logout), []);

  const actualizarUsuario: AuthContextType['actualizarUsuario'] = (datos) => {
    storage.actualizarCampos(datos);
    setSesion((s) => (s.usuario ? { ...s, usuario: { ...s.usuario, ...datos } } : s));
  };

  return (
    <AuthContext.Provider value={{ usuario, token, isAuthenticated: !!token, login, logout, actualizarUsuario }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}

