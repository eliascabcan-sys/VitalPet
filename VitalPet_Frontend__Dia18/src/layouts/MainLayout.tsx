// =================================================================
// Archivo: src/layouts/MainLayout.tsx
// RESPONSABILIDAD: Estructura común de las páginas autenticadas
// (menú único + topbar móvil + contenido).
// =================================================================
import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import NavBar from '../components/NavBar/NavBar';
import { USAR_MOCK } from '../services/api';
import './MainLayout.css';
import '../assets/css/panel-visual.css';
import '../assets/css/panel-vitalpet.css';

interface Props {
  title: string; // título mostrado en la topbar móvil
}

export default function MainLayout({ title }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { pathname } = useLocation();
  const tituloVista = pathname.startsWith('/administracion') ? `${title} · Gestión` : title;

  return (
    <>
      <NavBar open={sidebarOpen} onOpen={() => setSidebarOpen(true)} onClose={() => setSidebarOpen(false)} />

      <div className="main-wrap">
        {USAR_MOCK && (
          <div className="demo-banner" role="status">
            <i className="ti ti-flask" /> Modo demo: estás viendo datos de ejemplo, no los reales.
          </div>
        )}
        <div className="topbar-mobile">
          <button className="menu-btn" onClick={() => setSidebarOpen((o) => !o)}>
            <i className="ti ti-menu-2" />
          </button>
          <span className="topbar-title">{tituloVista}</span>
        </div>

        <main className="body">
          <Outlet />
        </main>
      </div>
    </>
  );
}