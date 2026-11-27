// =================================================================
// Archivo: src/pages/DuenoMascotaPage/DuenoMascotaPage.tsx
// RESPONSABILIDAD: La "carpeta" de una mascota para su dueño. Arriba, quién
// es y lo más importante de un vistazo (próxima cita, pendientes, peso);
// abajo, pestañas con TODO lo suyo: Resumen, Historial, Laboratorio,
// Vacunación y Certificados. La pestaña activa vive en la URL (?tab=...).
// =================================================================
import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { mascotasService } from '../../services/mascotasService';
import type { Mascota } from '../../services/mascotasService';
import { citasService } from '../../services/citasService';
import type { Cita } from '../../services/citasService';
import { laboratorioService, ETIQUETA_ESTADO_EXAMEN } from '../../services/laboratorioService';
import type { EstadoExamen, ExamenLaboratorio } from '../../services/laboratorioService';
import { esquemaSanitarioService } from '../../services/esquemaSanitarioService';
import type { EsquemaSanitario } from '../../services/esquemaSanitarioService';
import { certificadosService, etiquetaTipoCertificado } from '../../services/certificadosService';
import type { Certificado } from '../../services/certificadosService';
import { historialService } from '../../services/historialService';
import type { RegistroHistorial } from '../../services/historialService';
import { emojiEspecie } from '../../constants/mascotas';
import FichaTabs from '../../components/FichaCarpeta/FichaTabs';
import HistorialMascota from '../../components/HistorialMascota/HistorialMascota';
import ExamenDueno from '../../components/ExamenDueno/ExamenDueno';
import CertificacionVacunacion from '../../components/CertificacionVacunacion/CertificacionVacunacion';
import CertificadoPdfBoton from '../../components/CertificadoPdfBoton/CertificadoPdfBoton';
import EmptyState from '../../components/EmptyState/EmptyState';
import Skeleton from '../../components/Skeleton/Skeleton';
import { capitalizar } from '../../components/AgendaVet/fechas';
import '../../assets/css/dueno.css';
import '../../components/FichaCarpeta/FichaCarpeta.css';
import './DuenoMascotaPage.css';

type TabId = 'resumen' | 'historial' | 'laboratorio' | 'vacunacion' | 'certificados';
const TABS: TabId[] = ['resumen', 'historial', 'laboratorio', 'vacunacion', 'certificados'];

const fechaLarga = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }) : '—';
const fechaCorta = (v?: string | null) =>
  v ? capitalizar(new Date(v).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' }).replace('.', '')) : '—';

function edadTexto(nacimiento?: string | null): string {
  if (!nacimiento) return '';
  const n = new Date(nacimiento);
  if (isNaN(n.getTime())) return '';
  const meses = (new Date().getFullYear() - n.getFullYear()) * 12 + (new Date().getMonth() - n.getMonth());
  if (meses < 1) return 'menos de 1 mes';
  if (meses < 24) return `${meses} mes${meses === 1 ? '' : 'es'}`;
  return `${Math.floor(meses / 12)} años`;
}

interface Aviso { clave: string; icono: string; titulo: string; detalle: string; ir: TabId }

export default function DuenoMascotaPage() {
  const { idMascota } = useParams();
  const id = Number(idMascota);
  const [params, setParams] = useSearchParams();

  const pedida = params.get('tab') as TabId | null;
  const tab: TabId = pedida && TABS.includes(pedida) ? pedida : 'resumen';
  const irATab = (nueva: string) =>
    setParams((previos) => {
      const siguientes = new URLSearchParams(previos);
      if (nueva === 'resumen') siguientes.delete('tab'); else siguientes.set('tab', nueva);
      return siguientes;
    }, { replace: true });

  const [mascota, setMascota] = useState<Mascota | null>(null);
  const [citas, setCitas] = useState<Cita[]>([]);
  const [examenes, setExamenes] = useState<ExamenLaboratorio[]>([]);
  const [esquema, setEsquema] = useState<EsquemaSanitario | null>(null);
  const [certificados, setCertificados] = useState<Certificado[]>([]);
  const [ultimo, setUltimo] = useState<RegistroHistorial | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    setError('');
    Promise.all([
      mascotasService.obtener(id),
      // Todo lo demás es un extra de la carpeta: si algo falla, la carpeta se ve igual.
      citasService.mias().catch(() => [] as Cita[]),
      laboratorioService.mias().catch(() => [] as ExamenLaboratorio[]),
      esquemaSanitarioService.porMascota(id).catch(() => null),
      certificadosService.deMascota(id).catch(() => [] as Certificado[]),
      historialService.porMascota(id).catch(() => [] as RegistroHistorial[]),
    ])
      .then(([m, cs, ex, esq, certs, hist]) => {
        if (!vivo) return;
        setMascota(m);
        setCitas(cs.filter((c) => c.idMascota === id));
        setExamenes(ex.filter((e) => e.idMascota === id));
        setEsquema(esq);
        setCertificados(certs);
        const activos = hist.filter((h) => h.estado === 'activo')
          .sort((a, b) => (b.fechaRegistro || '').localeCompare(a.fechaRegistro || ''));
        setUltimo(activos[0] ?? null);
      })
      .catch((err) => vivo && setError(err instanceof Error ? err.message : 'No se pudo abrir la carpeta de esta mascota.'))
      .finally(() => vivo && setCargando(false));
    return () => { vivo = false; };
  }, [id]);

  if (cargando) return <section className="section active"><Skeleton variante="fila" cantidad={4} /></section>;
  if (error || !mascota) {
    return (
      <section className="section active">
        <EmptyState icono="ti-paw" mensaje={error || 'No encontramos esta mascota.'}
          accion={<Link to="/dueno/mascotas">Volver a Mis mascotas</Link>} />
      </section>
    );
  }

  // ---- Datos clave ----
  const inicioHoy = new Date(); inicioHoy.setHours(0, 0, 0, 0);
  const proxima = citas
    .filter((c) => (c.estado === 'pendiente' || c.estado === 'confirmada') && new Date(c.fechaHora) >= inicioHoy)
    .sort((a, b) => a.fechaHora.localeCompare(b.fechaHora))[0] ?? null;
  const examenesPendientes = examenes.filter((e) => e.estado === 'solicitado' || e.estado === 'en_proceso');
  const vacunasAtrasadas = (esquema?.items ?? []).filter((i) => i.estado === 'vencida' && !i.opcional);
  const pendientes = examenesPendientes.length + vacunasAtrasadas.length;

  const avisos: Aviso[] = [
    ...vacunasAtrasadas.map((i) => ({ clave: `v-${i.clave}`, icono: 'ti-vaccine', titulo: i.nombre, detalle: i.mensaje, ir: 'vacunacion' as TabId })),
    ...examenesPendientes.map((e) => ({
      clave: `e-${e.idExamen}`, icono: 'ti-flask', titulo: e.tipo_examen,
      detalle: ETIQUETA_ESTADO_EXAMEN[e.estado as EstadoExamen] || e.estado, ir: 'laboratorio' as TabId,
    })),
  ];

  const detalles = [mascota.especie, mascota.raza, mascota.sexo].filter(Boolean).join(' · ');
  const edad = edadTexto(mascota.fechaNacimiento);

  const pestanas = [
    { id: 'resumen', etiqueta: 'Resumen', alerta: pendientes > 0 },
    { id: 'historial', etiqueta: 'Historial' },
    { id: 'laboratorio', etiqueta: 'Laboratorio', cantidad: examenes.length, alerta: examenesPendientes.length > 0 },
    { id: 'vacunacion', etiqueta: 'Vacunación', alerta: vacunasAtrasadas.length > 0 },
    { id: 'certificados', etiqueta: 'Certificados', cantidad: certificados.length },
  ];

  return (
    <section className="section active">
      <header className="fc-cabecera">
        <Link to="/dueno/mascotas" className="fc-volver"><i className="ti ti-arrow-left" /> Mis mascotas</Link>

        <div className="fc-fila-principal">
          <div className="fc-avatar" aria-hidden="true">{emojiEspecie(mascota.especie)}</div>
          <div className="fc-identidad">
            <h1 className="fc-nombre">{mascota.nombre_mascota}</h1>
            <div className="fc-detalles">{detalles}{edad && ` · ${edad}`}</div>
          </div>
          <div className="dm-acciones">
            <Link to="/dueno/citas" className="dm-btn primario"><i className="ti ti-calendar-plus" /> Agendar cita</Link>
            <Link to="/dueno/triaje" className="dm-btn"><i className="ti ti-heartbeat" /> Reportar cómo está</Link>
          </div>
        </div>

        <div className="fc-datos">
          <div className="fc-dato">
            <span className="fc-dato-et">Próxima cita</span>
            {proxima
              ? <span className="fc-dato-val">{fechaCorta(proxima.fechaHora)}{proxima.franja ? ` · ${proxima.franja.nombre}` : ''}</span>
              : <span className="fc-dato-val tenue">Sin cita próxima</span>}
          </div>
          <div className={`fc-dato ${pendientes ? 'atencion' : 'ok'}`}>
            <span className="fc-dato-et">Pendientes</span>
            <span className="fc-dato-val">{pendientes ? `${pendientes} por atender` : 'Todo al día'}</span>
          </div>
          <div className="fc-dato">
            <span className="fc-dato-et">Peso</span>
            <span className="fc-dato-val">{mascota.peso_kg != null ? `${mascota.peso_kg} kg` : '—'}</span>
          </div>
          <div className="fc-dato">
            <span className="fc-dato-et">Último control</span>
            <span className="fc-dato-val">{ultimo ? fechaCorta(ultimo.fechaRegistro) : 'Sin controles'}</span>
          </div>
        </div>
      </header>

      <FichaTabs pestanas={pestanas} activa={tab} onCambiar={irATab} />

      {tab === 'resumen' && (
        <div className="fc-resumen">
          <section className="fc-tarjeta">
            <h2 className="fc-tarjeta-tit">Requiere atención</h2>
            {avisos.length === 0 ? (
              <p className="fc-ok"><i className="ti ti-circle-check" /> {mascota.nombre_mascota} está al día: sin vacunas atrasadas ni exámenes por entregar.</p>
            ) : (
              <ul className="fc-avisos">
                {avisos.map((a) => (
                  <li key={a.clave}>
                    <button type="button" onClick={() => irATab(a.ir)}>
                      <i className={`ti ${a.icono}`} />
                      <span><strong>{a.titulo}</strong><small>{a.detalle}</small></span>
                      <i className="ti ti-chevron-right fc-flecha" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="fc-tarjeta">
            <h2 className="fc-tarjeta-tit">Próxima cita</h2>
            {proxima ? (
              <>
                <p className="dm-cita"><strong>{fechaLarga(proxima.fechaHora)}</strong>{proxima.franja ? ` · ${proxima.franja.nombre}` : ''}</p>
                <p className="dm-detalle">
                  {proxima.motivo || 'Sin motivo indicado'} · {proxima.estado === 'pendiente' ? 'Por confirmar por la clínica' : 'Confirmada'}
                </p>
                <Link to="/dueno/citas" className="dm-btn">Ver mis citas</Link>
              </>
            ) : (
              <>
                <p className="fc-vacio">No hay citas agendadas para {mascota.nombre_mascota}.</p>
                <p style={{ margin: '12px 0 0' }}><Link to="/dueno/citas" className="dm-btn primario"><i className="ti ti-calendar-plus" /> Agendar cita</Link></p>
              </>
            )}
          </section>

          <section className="fc-tarjeta fc-ancha">
            <h2 className="fc-tarjeta-tit">Último control</h2>
            {ultimo ? (
              <>
                <p className="fc-linea">
                  <strong>{new Date(ultimo.fechaRegistro).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
                  {ultimo.motivo_consulta ? ` — ${ultimo.motivo_consulta}` : ''}
                </p>
                {ultimo.diagnostico && <p className="fc-linea"><span className="fc-et">Diagnóstico:</span> {ultimo.diagnostico}</p>}
                <button type="button" className="dm-btn" onClick={() => irATab('historial')}>Ver todo el historial</button>
              </>
            ) : (
              <p className="fc-vacio">Aún no hay controles registrados.</p>
            )}
          </section>
        </div>
      )}

      {tab === 'historial' && (
        <div className="dm-contenido"><HistorialMascota idMascota={id} ocultarMascota /></div>
      )}

      {tab === 'laboratorio' && (
        <div className="dm-contenido">
          {examenes.length === 0 && <EmptyState icono="ti-flask" mensaje={`${mascota.nombre_mascota} aún no tiene exámenes de laboratorio.`} />}
          {[...examenes]
            .sort((a, b) => new Date(b.fecha_solicitud ?? 0).getTime() - new Date(a.fecha_solicitud ?? 0).getTime())
            .map((e) => <ExamenDueno key={e.idExamen} examen={e} mostrarMascota={false} />)}
        </div>
      )}

      {tab === 'vacunacion' && (
        <div className="dm-contenido">
          <h2 className="dm-bloque-titulo">Certificación de vacunación</h2>
          <CertificacionVacunacion idMascota={id} />
        </div>
      )}

      {tab === 'certificados' && (
        <div className="dm-contenido">
          {certificados.length === 0 && (
            <EmptyState icono="ti-certificate" mensaje="Aún no hay certificados emitidos."
              detalle="Cuando la clínica emita un certificado de esta mascota, podrás descargarlo aquí." />
          )}
          {certificados.map((c) => (
            <div key={c.idCertificado} className="fc-tarjeta" style={{ marginBottom: 12 }}>
              <h2 className="fc-tarjeta-tit">{etiquetaTipoCertificado(c.tipo)} · {c.codigo}</h2>
              <p className="dm-detalle">
                Emitido el {c.fechaEmision ? new Date(c.fechaEmision).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
                {c.vigenciaHasta ? ` · Vigente hasta ${new Date(c.vigenciaHasta).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}
                {c.estado === 'anulado' ? ' · ANULADO' : ''}
              </p>
              {c.estado !== 'anulado' && c.integro && <CertificadoPdfBoton certificado={c} />}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}