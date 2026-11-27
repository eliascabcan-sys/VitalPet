// =================================================================
// Archivo: src/components/NavBar/NavBar.tsx
// RESPONSABILIDAD: ÚNICO menú de navegación de la app. Muestra un set de
// enlaces según el rol (dueño, veterinario, administrador) y se adapta:
//   · escritorio (>1024px): menú lateral completo
//   · tablet (641-1024px):  menú lateral compacto (solo iconos)
//   · móvil (≤640px):       barra inferior con accesos + menú deslizable
//     (botón "Más" o botón de la topbar)
// =================================================================
import AdminModal from '../AdminModal/AdminModal';
import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useAlertasPendientes } from '../../hooks/useAlertasPendientes';
import { usePreguntasPendientes } from '../../hooks/usePreguntasPendientes';
import PerfilModal from '../PerfilModal/PerfilModal';
import logo from '../../assets/img/Adobe Express - file.png';
import './NavBar.css';

interface NavItem {
  to: string;
  icon: string;
  label: string;
}

// Los enlaces van agrupados por TAREA (no por módulo técnico) para que el menú
// se lea de un vistazo. Un grupo sin título es un acceso suelto (ej. "Inicio").
interface NavGrupo {
  titulo?: string;
  items: NavItem[];
}

const NAV_DUENO: NavGrupo[] = [
  { items: [{ to: '/dueno/inicio', icon: 'ti-home', label: 'Inicio' }] },
  {
    titulo: 'Mis mascotas',
    items: [
      { to: '/dueno/mascotas', icon: 'ti-paw', label: 'Mis mascotas' },
      { to: '/dueno/agregar-mascota', icon: 'ti-circle-plus', label: 'Agregar mascota' },
      // Historial, laboratorio y vacunación viven ahora dentro de la carpeta de cada mascota.
      // Las rutas /dueno/historial, /dueno/laboratorio y /dueno/carnet siguen funcionando.
    ],
  },
  {
    titulo: 'Citas y cuidado',
    items: [
      { to: '/dueno/citas', icon: 'ti-calendar-event', label: 'Mis citas' },
      { to: '/dueno/seguimiento', icon: 'ti-clipboard-check', label: 'Seguimiento' },
      { to: '/dueno/triaje', icon: 'ti-alert-triangle', label: 'Alertas / Triaje' },
    ],
  },
  {
    titulo: 'Mi cuenta',
    items: [{ to: '/dueno/autorizaciones', icon: 'ti-shield-check', label: 'Autorizaciones' }],
  },
];

const NAV_VETERINARIO: NavGrupo[] = [
  {
    titulo: 'Mi día',
    items: [
      { to: '/admin/agenda', icon: 'ti-calendar-stats', label: 'Agenda' },
      { to: '/admin/citas', icon: 'ti-calendar-event', label: 'Citas' },
    ],
  },
  {
    titulo: 'Pacientes',
    items: [
      { to: '/admin/pacientes', icon: 'ti-users', label: 'Pacientes' },
      { to: '/admin/historial', icon: 'ti-clipboard-list', label: 'Historial' },
      { to: '/admin/vacunacion', icon: 'ti-vaccine', label: 'Esquema sanitario' },
      { to: '/admin/laboratorio', icon: 'ti-flask', label: 'Laboratorio' },
    ],
  },
  {
    titulo: 'Clínica',
    items: [
      { to: '/admin/alertas', icon: 'ti-bell-ringing', label: 'Alertas' },
      { to: '/administracion/seguimiento', icon: 'ti-bell', label: 'Seguimiento' },
      { to: '/admin/triaje', icon: 'ti-first-aid-kit', label: 'Triaje (Manchester)' },
    ],
  },
  {
    titulo: 'Negocio',
    items: [{ to: '/administracion/ventas', icon: 'ti-receipt', label: 'Ventas' }],
  },
];

const NAV_ADMINISTRADOR: NavGrupo[] = [
  {
    titulo: 'Personas',
    items: [
      { to: '/administracion/usuarios', icon: 'ti-users', label: 'Usuarios (dueños)' },
      { to: '/administracion/veterinarios', icon: 'ti-stethoscope', label: 'Veterinarios' },
    ],
  },
  {
    titulo: 'Clínica',
    items: [
      { to: '/admin/agenda', icon: 'ti-calendar-stats', label: 'Agenda' },
      { to: '/admin/pacientes', icon: 'ti-clipboard-heart', label: 'Panel clínico' },
      { to: '/admin/laboratorio', icon: 'ti-flask', label: 'Laboratorio' },
      { to: '/admin/alertas', icon: 'ti-bell-ringing', label: 'Alertas' },
      { to: '/administracion/seguimiento', icon: 'ti-bell', label: 'Seguimiento' },
    ],
  },
  {
    titulo: 'Negocio',
    items: [
      { to: '/administracion/catalogo', icon: 'ti-package', label: 'Catálogo' },
      { to: '/administracion/ventas', icon: 'ti-receipt', label: 'Ventas' },
    ],
  },
];

// Accesos rápidos de la barra inferior en móvil (4 + botón "Más").
const ACCESOS_MOVIL: Record<string, string[]> = {
  dueno: ['/dueno/inicio', '/dueno/mascotas', '/dueno/citas', '/dueno/triaje'],
  veterinario: ['/admin/agenda', '/admin/pacientes', '/admin/citas', '/admin/alertas'],
  administrador: ['/administracion/usuarios', '/administracion/catalogo', '/administracion/ventas', '/admin/alertas'],
};

// Etiqueta corta para que quepa bajo el icono en la barra inferior.
const ETIQUETA_CORTA: Record<string, string> = {
  '/dueno/mascotas': 'Mascotas',
  '/dueno/triaje': 'Triaje',
  '/administracion/usuarios': 'Usuarios',
  '/administracion/catalogo': 'Catálogo',
};

const ETIQUETA_ROL: Record<string, string> = {
  dueno: 'Panel Dueño',
  veterinario: 'Panel Veterinario',
  administrador: 'Administrador',
};

interface NavBarProps {
  open?: boolean;
  onClose?: () => void;
  onOpen?: () => void; // abre el menú deslizable desde el botón "Más"
}

export default function NavBar({ open, onClose, onOpen }: NavBarProps) {
  const { usuario, logout } = useAuth();
  const [perfilAbierto, setPerfilAbierto] = useState(false);
  const { pathname } = useLocation();
  const [confirmandoSalida, setConfirmandoSalida] = useState(false);

  // Globito con las alertas por atender (solo personal de la clínica).
  const alertas = useAlertasPendientes(usuario?.rol === 'veterinario' || usuario?.rol === 'administrador');

  // Globito con las preguntas de seguimiento que el dueño aún no responde.
  const preguntas = usePreguntasPendientes(usuario?.rol === 'dueno');

  if (!usuario) return null;

  // La ficha del paciente cuelga de "Pacientes": mientras se está en ella, ese ítem queda marcado.
  const enFicha = pathname.startsWith('/admin/ficha');

  const grupos =
    usuario.rol === 'dueno' ? NAV_DUENO : usuario.rol === 'veterinario' ? NAV_VETERINARIO : NAV_ADMINISTRADOR;
  const items = grupos.flatMap((g) => g.items); // lista plana, para buscar los accesos de la barra inferior
  const accesos = (ACCESOS_MOVIL[usuario.rol] ?? [])
    .map((to) => items.find((i) => i.to === to))
    .filter((i): i is NavItem => Boolean(i));

  return (
    <>
    {/* Fondo oscuro detrás del sidebar en móvil: tocarlo cierra el menú,
        como un "regresar" táctil, sin bloquear el resto de la pantalla. */}
    {open && <div className="sidebar-overlay" onClick={onClose} />}

    <aside className={`sidebar rol-${usuario.rol}${open ? ' open' : ''}`}>
      <div className="sidebar-logo">
        <img src={logo} alt="" className="sidebar-logo-img" />
        <div className="logo-textos">
          <div className="logo-name">Vital<span>Pet</span></div>
          <div className="logo-sub">{ETIQUETA_ROL[usuario.rol]}</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {grupos.map((grupo, i) => (
          <div className="nav-grupo" key={grupo.titulo ?? `grupo-${i}`}>
            {grupo.titulo && <div className="nav-seccion">{grupo.titulo}</div>}
            {grupo.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `nav-item${isActive || (enFicha && item.to === '/admin/pacientes') ? ' active' : ''}`}
                title={item.label}
                onClick={onClose}
              >
                <i className={`ti ${item.icon}`} />
                <span className="nav-label">{item.label}</span>
                {item.to === '/dueno/seguimiento' && preguntas > 0 && (
                  <span
                    className="nav-badge"
                    title={`${preguntas} ${preguntas === 1 ? 'pregunta' : 'preguntas'} por responder`}
                  >
                    {preguntas}
                  </span>
                )}
                {item.to === '/admin/alertas' && alertas.total > 0 && (
                  <span
                    className={`nav-badge${alertas.graves > 0 ? ' grave' : ''}`}
                    title={alertas.graves > 0 ? `${alertas.total} alertas por atender, ${alertas.graves} graves` : `${alertas.total} alertas por atender`}
                  >
                    {alertas.total}
                  </span>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button
          type="button"
          className="sidebar-footer-perfil"
          title="Editar mi perfil"
          onClick={() => setPerfilAbierto(true)}
        >
          <div className="avatar-side">
            {(usuario.nombre || '?').charAt(0).toUpperCase()}
          </div>
          <div className="user-textos">
            <div className="user-name-side">{usuario.nombre}</div>
            <div className="user-role-side">{ETIQUETA_ROL[usuario.rol]}</div>
          </div>
        </button>
        <button className="btn-logout" title="Cerrar sesión" onClick={() => setConfirmandoSalida(true)}>
          <i className="ti ti-logout" />
        </button>
      </div>
    </aside>

    {/* Barra inferior: solo se ve en móvil (≤640px). */}
    <nav className="bottom-nav" aria-label="Accesos rápidos">
      {accesos.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) => `bottom-nav-item${isActive ? ' active' : ''}`}
        >
          <i className={`ti ${item.icon}`} />
          <span>{ETIQUETA_CORTA[item.to] ?? item.label}</span>
        </NavLink>
      ))}
      <button type="button" className="bottom-nav-item" onClick={onOpen} aria-label="Abrir menú completo">
        <i className="ti ti-menu-2" />
        <span>Más</span>
      </button>
    </nav>

    {/* Fuera del <aside>: si quedara adentro, el transform que el sidebar
        recibe en móvil (max-width: 640px) convierte el
        position:fixed del modal en relativo al sidebar y lo deja
        atrapado/recortado dentro de sus 220px, rompiéndolo. */}
    <PerfilModal abierto={perfilAbierto} onClose={() => setPerfilAbierto(false)} />
    <AdminModal
      abierto={confirmandoSalida}
      titulo="Cerrar sesión"
      onClose={() => setConfirmandoSalida(false)}
      ancho={380}
      pie={
        <>
          <button className="btn-cancelar" onClick={() => setConfirmandoSalida(false)}>
            Cancelar
          </button>
          <button
            className="btn-eliminar"
            onClick={() => {
              setConfirmandoSalida(false);
              logout();
            }}
          >
            <i className="ti ti-logout" /> Sí, cerrar sesión
          </button>
        </>
      }
    >
      <p>¿Seguro que quieres cerrar sesión?</p>
    </AdminModal>
    </>
  );
}