// =================================================================
// Archivo: src/App.tsx
// RESPONSABILIDAD: Define todas las rutas de la app y qué layout /
// protección aplica a cada una. Reemplaza la navegación por archivos
// .html sueltos del proyecto original.
// =================================================================
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './routes/ProtectedRoute';
import MainLayout from './layouts/MainLayout';

import HomePage from './pages/HomePage/HomePage';
import LoginPage from './pages/LoginPage/LoginPage';
import RegistroPage from './pages/RegistroPage/RegistroPage';
import RecuperarContrasenaPage from './pages/RecuperarContrasenaPage/RecuperarContrasenaPage';
import OAuthCallbackPage from './pages/OAuthCallbackPage/OAuthCallbackPage';

import DuenoInicioPage from './pages/DuenoInicioPage/DuenoInicioPage';
import DuenoMascotasPage from './pages/DuenoMascotasPage/DuenoMascotasPage';
import DuenoAgregarMascotaPage from './pages/DuenoAgregarMascotaPage/DuenoAgregarMascotaPage';
import DuenoCitasPage from './pages/DuenoCitasPage/DuenoCitasPage';
import DuenoHistorialPage from './pages/DuenoHistorialPage/DuenoHistorialPage';
import DuenoCarnetPage from './pages/DuenoCarnetPage/DuenoCarnetPage';
import DuenoReportePage from './pages/DuenoReportePage/DuenoReportePage';
import DuenoSeguimientoPage from './pages/DuenoSeguimientoPage/DuenoSeguimientoPage';
import DuenoMascotaPage from './pages/DuenoMascotaPage/DuenoMascotaPage';
import DuenoTriajePage from './pages/DuenoTriajePage/DuenoTriajePage';
import DuenoLaboratorioPage from './pages/DuenoLaboratorioPage/DuenoLaboratorioPage';
import VerificarCertificadoPage from './pages/VerificarCertificadoPage/VerificarCertificadoPage';
import VeterinarioLaboratorioPage from './pages/VeterinarioLaboratorioPage/VeterinarioLaboratorioPage';

// Panel clínico (veterinario). En el proyecto original estos archivos y los
// de /administracion/* se llamaban parecido ("admin-*.html" vs
// "administracion-*.html") y se prestaban a confusión; acá se separan
// claramente con el prefijo "Veterinario" (panel clínico) vs
// "Administracion" (gestión, solo rol administrador) más abajo.
import VeterinarioPacientesPage from './pages/VeterinarioPacientesPage/VeterinarioPacientesPage';
import VeterinarioCitasPage from './pages/VeterinarioCitasPage/VeterinarioCitasPage';
import VeterinarioAgendaPage from './pages/VeterinarioAgendaPage/VeterinarioAgendaPage';
import VeterinarioHistorialPage from './pages/VeterinarioHistorialPage/VeterinarioHistorialPage';
import VeterinarioVacunacionPage from './pages/VeterinarioVacunacionPage/VeterinarioVacunacionPage';
import VeterinarioTriajePage from './pages/VeterinarioTriajePage/VeterinarioTriajePage';
import VeterinarioAlertasPage from './pages/VeterinarioAlertasPage/VeterinarioAlertasPage';
import AdministracionUsuariosPage from './pages/AdministracionUsuariosPage/AdministracionUsuariosPage';
import AdministracionVeterinariosPage from './pages/AdministracionVeterinariosPage/AdministracionVeterinariosPage';
import AdministracionCatalogoPage from './pages/AdministracionCatalogoPage/AdministracionCatalogoPage';
import AdministracionVentasPage from './pages/AdministracionVentasPage/AdministracionVentasPage';
import AdministracionSeguimientoPage from './pages/AdministracionSeguimientoPage/AdministracionSeguimientoPage';
import FichaPacientePage from './pages/FichaPacientePage/FichaPacientePage';
import VeterinarioCertificadosPage from './pages/VeterinarioCertificadosPage/VeterinarioCertificadosPage';
// Panel temporal de QA (P4) para probar el ciclo de automatización desde el
// navegador. @P5: puedes moverlo/quitarlo cuando construyas las alertas reales.
import AutomatizacionQAPage from './pages/AutomatizacionQAPage/AutomatizacionQAPage';
import DuenoAutorizacionesPage from './pages/DuenoAutorizacionesPage/DuenoAutorizacionesPage';
import AutorizacionesPersonalPage from './pages/AutorizacionesPersonalPage/AutorizacionesPersonalPage';


export default function App() {
  return (
    <Routes>
      {/* ---- Rutas públicas ---- */}
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/registro" element={<RegistroPage />} />
      <Route path="/recuperar-contrasena" element={<RecuperarContrasenaPage />} />
      <Route path="/oauth-callback" element={<OAuthCallbackPage />} />
      <Route path="/verificar" element={<VerificarCertificadoPage />} />
      <Route path="/verificar/:codigo" element={<VerificarCertificadoPage />} />

      {/* ---- Panel Dueño ---- */}
      <Route element={<ProtectedRoute rolesPermitidos={['dueno']} />}>
        <Route element={<MainLayout title="VitalPet" />}>
          <Route path="/dueno/inicio" element={<DuenoInicioPage />} />
          <Route path="/dueno/mascotas" element={<DuenoMascotasPage />} />
          <Route path="/dueno/mascotas/:idMascota" element={<DuenoMascotaPage />} />
          <Route path="/dueno/agregar-mascota" element={<DuenoAgregarMascotaPage />} />
          <Route path="/dueno/citas" element={<DuenoCitasPage />} />
          <Route path="/dueno/historial" element={<DuenoHistorialPage />} />
          <Route path="/dueno/laboratorio" element={<DuenoLaboratorioPage />} />
          <Route path="/dueno/carnet" element={<DuenoCarnetPage />} />
          <Route path="/dueno/reporte" element={<DuenoReportePage />} />
          <Route path="/dueno/seguimiento" element={<DuenoSeguimientoPage />} />
          <Route path="/dueno/triaje" element={<DuenoTriajePage />} />
          <Route path="/dueno/autorizaciones" element={<DuenoAutorizacionesPage />} />
        </Route>
      </Route>

      {/* ---- Panel Veterinario (clínico) — accesible también por administrador ---- */}
      <Route element={<ProtectedRoute rolesPermitidos={['veterinario', 'administrador']} />}>
        <Route element={<MainLayout title="VitalPet" />}>
          <Route path="/admin/pacientes" element={<VeterinarioPacientesPage />} />
          <Route path="/admin/citas" element={<VeterinarioCitasPage />} />
          <Route path="/admin/agenda" element={<VeterinarioAgendaPage />} />
          <Route path="/admin/historial" element={<VeterinarioHistorialPage />} />
          <Route path="/admin/vacunacion" element={<VeterinarioVacunacionPage />} />
          <Route path="/admin/laboratorio" element={<VeterinarioLaboratorioPage />} />
          <Route path="/admin/triaje" element={<VeterinarioTriajePage />} />
          <Route path="/admin/alertas" element={<VeterinarioAlertasPage />} />
          <Route path="/admin/ficha/:idMascota" element={<FichaPacientePage />} />
          <Route path="/admin/certificados" element={<VeterinarioCertificadosPage />} />
          <Route path="/admin/autorizaciones" element={<AutorizacionesPersonalPage />} />
        </Route>
      </Route>

      {/* ---- Ventas: compartida entre Veterinario y Administrador (como en el original) ---- */}
      <Route element={<ProtectedRoute rolesPermitidos={['veterinario', 'administrador']} />}>
        <Route element={<MainLayout title="VitalPet" />}>
          <Route path="/administracion/ventas" element={<AdministracionVentasPage />} />
        </Route>
      </Route>

      {/* ---- Seguimiento: compartido entre Veterinario y Administrador ----
          El backend (POST /seguimientos, /seguimientos/plantillas,
          /seguimientos/alertas/pendientes, etc.) ya acepta ambos roles
          (require_roles("administrador", "veterinario")), así que el
          veterinario usa la misma pantalla que el administrador. ---- */}
      <Route element={<ProtectedRoute rolesPermitidos={['veterinario', 'administrador']} />}>
        <Route element={<MainLayout title="VitalPet" />}>
          <Route path="/administracion/seguimiento" element={<AdministracionSeguimientoPage />} />
        </Route>
      </Route>

      {/* ---- QA temporal de Automatización (P4) ---- */}
      <Route element={<ProtectedRoute rolesPermitidos={['veterinario', 'administrador']} />}>
        <Route element={<MainLayout title="VitalPet" />}>
          <Route path="/administracion/automatizacion-qa" element={<AutomatizacionQAPage />} />
        </Route>
      </Route>

      {/* ---- Panel Administrador ---- */}
      <Route element={<ProtectedRoute rolesPermitidos={['administrador']} />}>
        <Route element={<MainLayout title="VitalPet" />}>
          <Route path="/administracion/usuarios" element={<AdministracionUsuariosPage />} />
          <Route path="/administracion/veterinarios" element={<AdministracionVeterinariosPage />} />
          <Route path="/administracion/catalogo" element={<AdministracionCatalogoPage />} />
        </Route>
      </Route>

      {/* ---- Cualquier otra ruta ---- */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}