// =================================================================
// Archivo: src/pages/DuenoInicioPage/DuenoInicioPage.tsx
// RESPONSABILIDAD: Dashboard de inicio del dueño (stats, próxima cita,
// grid de mascotas). Migrado de dueno-inicio.html + cargarDashboardInicio()
// de dueno.js — misma llamada Promise.allSettled a los 3 endpoints.
// =================================================================
import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { mascotasService } from '../../services/mascotasService';
import type { Mascota } from '../../services/mascotasService';
import { citasService } from '../../services/citasService';
import type { Cita } from '../../services/citasService';
import { historialService } from '../../services/historialService';
import MascotaCard from '../../components/MascotaCard/MascotaCard';
import '../../assets/css/dueno.css';
import { useToast } from '../../components/Toast/ToastContext';

export default function DuenoInicioPage() {
  const { usuario } = useAuth();

  const [mascotas, setMascotas] = useState<Mascota[]>([]);
  const [totalCitasPendientes, setTotalCitasPendientes] = useState<number | string>('—');
  const [totalHistorial, setTotalHistorial] = useState<number | string>('—');
  const [proximaCita, setProximaCita] = useState<Cita | null>(null);
  const [sinProximas, setSinProximas] = useState(false);
  const { mostrarToast } = useToast();

  useEffect(() => {
    async function cargar() {
      // Cada módulo se resuelve por separado: un fallo puntual en citas o
      // historial no debe dejar vacío todo el dashboard (igual que el original).
      const [resMasc, resCitas, resHist] = await Promise.allSettled([
        mascotasService.mias(),
        citasService.mias(),
        historialService.mias(),
      ]);

      const fallos = [resMasc, resCitas, resHist].filter((r) => r.status === 'rejected').length;
      if (fallos) {
        mostrarToast(
          fallos === 3 ? 'No se pudo conectar con el servidor.' : 'Una parte de tu resumen no se pudo cargar.',
          'error'
        );
      }

      const misMascotas = resMasc.status === 'fulfilled' ? resMasc.value : [];
      const misCitas = resCitas.status === 'fulfilled' ? resCitas.value : [];
      const todoHistorial = resHist.status === 'fulfilled' ? resHist.value : [];

      if (resMasc.status === 'rejected' && resCitas.status === 'rejected' && resHist.status === 'rejected') {
        setTotalCitasPendientes('–');
        setTotalHistorial('–');
        return;
      }

      const misIdsMasc = misMascotas.map((m) => m.idMascota);
      const misHistorial = todoHistorial.filter((h) => misIdsMasc.includes(h.idMascota));

      setMascotas(misMascotas.filter((m) => m.estado === 'activo'));
      setTotalCitasPendientes(misCitas.filter((c) => c.estado === 'pendiente').length);
      setTotalHistorial(misHistorial.length);

      const ahora = new Date();
      const proximas = misCitas
        .filter((c) => c.estado === 'pendiente' && new Date(c.fechaHora) > ahora)
        .sort((a, b) => new Date(a.fechaHora).getTime() - new Date(b.fechaHora).getTime());

      if (proximas.length) {
        setProximaCita(proximas[0]);
      } else {
        setSinProximas(true);
      }
    }

    cargar();
  }, []);

  const fecha = proximaCita ? new Date(proximaCita.fechaHora) : null;

  return (
    <section className="section active">
      <div className="section-header">
        <div>
          <div className="page-title">¡Hola, {usuario?.nombre}!</div>
          <div className="page-sub">Aquí tienes un resumen de tus mascotas y próximas citas.</div>
        </div>
      </div>

      <div className="vet-banner">
        <div className="vet-banner-icon">
          <i className="ti ti-stethoscope" />
        </div>
        <div className="vet-banner-info">
          <div className="vet-banner-nombre">Clínica Veterinaria VitalPet</div>
          <div className="vet-banner-detalle">
            <i className="ti ti-map-pin" style={{ fontSize: 14 }} /> Cra. 15 #45-20 — Bogotá, Colombia
          </div>
          <div className="vet-banner-detalle">
            <i className="ti ti-phone" style={{ fontSize: 14 }} /> (601) 234-5678
          </div>
          <span className="vet-banner-badge">
            <i className="ti ti-check" /> Quedaste anexo a esta veterinaria
          </span>
        </div>
      </div>

      <div className="stats">
        <div className="stat">
          <div className="stat-icon">
            <i className="ti ti-paw" />
          </div>
          <div>
            <div className="stat-label">Mis mascotas</div>
            <div className="stat-value">{mascotas.length || '—'}</div>
          </div>
        </div>
        <div className="stat">
          <div className="stat-icon verde">
            <i className="ti ti-calendar-check" />
          </div>
          <div>
            <div className="stat-label">Citas activas</div>
            <div className="stat-value verde">{totalCitasPendientes}</div>
          </div>
        </div>
        <div className="stat">
          <div className="stat-icon acento">
            <i className="ti ti-clipboard-list" />
          </div>
          <div>
            <div className="stat-label">Registros clínicos</div>
            <div className="stat-value acento">{totalHistorial}</div>
          </div>
        </div>
      </div>

      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: 'var(--color-nav)',
          marginBottom: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <i className="ti ti-calendar-event" /> Próxima cita
      </div>

      {proximaCita && fecha ? (
        <div className="cita-card">
          <div className="cita-icono">
            <i className="ti ti-calendar-event" />
          </div>
          <div className="cita-info">
            <div className="cita-titulo">{proximaCita.motivo || 'Consulta veterinaria'}</div>
            <div className="cita-detalle">
              <i className="ti ti-calendar" style={{ fontSize: 14 }} />{' '}
              {fecha.toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
            <div className="cita-detalle">
              <i className="ti ti-clock" style={{ fontSize: 14 }} />{' '}
              {fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <span className={`estado-badge ${proximaCita.estado}`}>{proximaCita.estado}</span>
          </div>
        </div>
      ) : sinProximas ? (
        <div className="cita-vacia">
          <i className="ti ti-calendar-off" style={{ fontSize: 22, display: 'block', margin: '0 auto 8px', opacity: 0.4 }} />
          No tienes citas próximas agendadas.
        </div>
      ) : null}

      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: 'var(--color-nav)',
          marginBottom: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginTop: 6,
        }}
      >
        <i className="ti ti-paw" /> Mis mascotas
      </div>

      <div className="grid-mascotas">
        {mascotas.length ? (
          mascotas.map((m) => <MascotaCard key={m.idMascota} mascota={m} />)
        ) : (
          <div className="vacio">
            <i className="ti ti-paw" />
            No tienes mascotas registradas aún.
            <br />
            <small>Usa "Agregar mascota" para registrar la primera.</small>
          </div>
        )}
      </div>
    </section>
  );
}
