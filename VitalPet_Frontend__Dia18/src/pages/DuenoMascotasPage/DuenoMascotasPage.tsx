// =================================================================
// Archivo: src/pages/DuenoMascotasPage/DuenoMascotasPage.tsx
// RESPONSABILIDAD: "Mis mascotas": una tarjeta por mascota que abre su carpeta
// (historial, laboratorio, vacunación y certificados). Cada tarjeta muestra
// de un vistazo la próxima cita y si hay algo pendiente.
// =================================================================
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { mascotasService } from '../../services/mascotasService';
import type { Mascota } from '../../services/mascotasService';
import { citasService } from '../../services/citasService';
import type { Cita } from '../../services/citasService';
import { laboratorioService } from '../../services/laboratorioService';
import type { ExamenLaboratorio } from '../../services/laboratorioService';
import { esquemaSanitarioService } from '../../services/esquemaSanitarioService';
import type { EsquemaSanitario } from '../../services/esquemaSanitarioService';
import MascotaCard from '../../components/MascotaCard/MascotaCard';
import { capitalizar } from '../../components/AgendaVet/fechas';
import '../../assets/css/dueno.css';
import { useToast } from '../../components/Toast/ToastContext';

export default function DuenoMascotasPage() {
  const [mascotas, setMascotas] = useState<Mascota[]>([]);
  const [citas, setCitas] = useState<Cita[]>([]);
  const [examenes, setExamenes] = useState<ExamenLaboratorio[]>([]);
  const [esquemas, setEsquemas] = useState<EsquemaSanitario[]>([]);
  const [error, setError] = useState(false);
  const { mostrarToast } = useToast();

  useEffect(() => {
    mascotasService
      .mias()
      .then((data) => setMascotas(data.filter((m) => m.estado === 'activo')))
      .catch(() => {
        setError(true);
        mostrarToast('No se pudieron cargar tus mascotas.', 'error');
      });
    // Los indicadores de las tarjetas son un extra: si fallan, las tarjetas se ven sin ellos.
    citasService.mias().then(setCitas).catch(() => setCitas([]));
    laboratorioService.mias().then(setExamenes).catch(() => setExamenes([]));
    esquemaSanitarioService.mias().then(setEsquemas).catch(() => setEsquemas([]));
  }, []);

  // Por cada mascota: próxima cita (texto) y cuántas cosas están pendientes.
  const indicadores = useMemo(() => {
    const inicioHoy = new Date();
    inicioHoy.setHours(0, 0, 0, 0);
    const datos = new Map<number, { cita: string | null; pendientes: number }>();
    mascotas.forEach((m) => {
      const prox = citas
        .filter((c) => c.idMascota === m.idMascota && (c.estado === 'pendiente' || c.estado === 'confirmada') && new Date(c.fechaHora) >= inicioHoy)
        .sort((a, b) => a.fechaHora.localeCompare(b.fechaHora))[0];
      const dia = prox ? capitalizar(new Date(prox.fechaHora).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' }).replace('.', '')) : null;
      const atrasadas = (esquemas.find((e) => e.idMascota === m.idMascota)?.items ?? []).filter((i) => i.estado === 'vencida' && !i.opcional).length;
      const pendEx = examenes.filter((e) => e.idMascota === m.idMascota && (e.estado === 'solicitado' || e.estado === 'en_proceso')).length;
      datos.set(m.idMascota, { cita: prox ? `${dia}${prox.franja ? ` · ${prox.franja.nombre}` : ''}` : null, pendientes: atrasadas + pendEx });
    });
    return datos;
  }, [mascotas, citas, examenes, esquemas]);

  return (
    <section className="section active">
      <div className="section-header">
        <div>
          <div className="page-title">Mis mascotas</div>
          <div className="page-sub">Abre la carpeta de cada una para ver su historial, exámenes, vacunas y certificados.</div>
        </div>
        <div className="toolbar">
          <Link className="btn-nuevo" to="/dueno/agregar-mascota">
            <i className="ti ti-circle-plus" style={{ fontSize: 16 }} /> Agregar mascota
          </Link>
        </div>
      </div>

      <div className="grid-mascotas">
        {error && <div className="vacio"><i className="ti ti-wifi-off" />Error al cargar mascotas.</div>}
        {!error && !mascotas.length && (
          <div className="vacio">
            <i className="ti ti-paw" />
            No tienes mascotas registradas aún.
            <br />
            <small>Usa "Agregar mascota" para registrar la primera.</small>
          </div>
        )}
        {mascotas.map((m) => {
          const d = indicadores.get(m.idMascota);
          return <MascotaCard key={m.idMascota} mascota={m} proximaCita={d?.cita ?? null} pendientes={d?.pendientes ?? 0} />;
        })}
      </div>
    </section>
  );
}