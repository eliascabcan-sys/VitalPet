// =================================================================
// Archivo: src/pages/DuenoCitasPage/DuenoCitasPage.tsx
// RESPONSABILIDAD: Agendar cita (con disponibilidad real del
// veterinario) + mensaje de citas pendientes + listado de citas propias
// con pestañas por estado, filtro por días y cancelar/reprogramar.
// =================================================================
import { useEffect, useState } from 'react';
import { citasService } from '../../services/citasService';
import type { Cita, CitaPendiente, Veterinario, Derivacion, FranjaDisponibilidad, CanalContacto, PreparacionDeCita } from '../../services/citasService';
import { mascotasService } from '../../services/mascotasService';
import type { Mascota } from '../../services/mascotasService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/Toast/ToastContext';
import FiltroDias from '../../components/FiltroDias/FiltroDias';
import PreparacionCita from '../../components/PreparacionCita/PreparacionCita';
import { dentroDeDias } from '../../utils/fechas';

import '../../assets/css/dueno.css';

function fechaValida(fechaStr?: string): Date | null {
  if (!fechaStr) return null;
  const f = new Date(fechaStr);
  return isNaN(f.getTime()) ? null : f;
}

const hhmm = (h: string) => h.slice(0, 5);

// Canales con los que el dueño puede pedir que lo contacten por la cita.
const CANALES: { valor: CanalContacto; etiqueta: string }[] = [
  { valor: 'telefono', etiqueta: 'Llamada' },
  { valor: 'correo', etiqueta: 'Correo' },
  { valor: 'urgente', etiqueta: 'Urgente (contáctenme de inmediato)' },
];
const ETIQUETA_CANAL: Record<string, string> = {
  app: 'App', telefono: 'Llamada', correo: 'Correo', presencial: 'Presencial', urgente: 'Urgente',
};

const TABS: { valor: 'todas' | 'pendiente' | 'confirmada' | 'cancelada'; etiqueta: string }[] = [
  { valor: 'todas', etiqueta: 'Todas' },
  { valor: 'pendiente', etiqueta: 'Pendientes' },
  { valor: 'confirmada', etiqueta: 'Confirmadas' },
  { valor: 'cancelada', etiqueta: 'Canceladas' },
];

function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function DuenoCitasPage() {
  const { usuario } = useAuth();
  const { mostrarToast, confirmar } = useToast();

  const [mascotas, setMascotas] = useState<Mascota[]>([]);
  const [veterinarios, setVeterinarios] = useState<Veterinario[]>([]);
  const [derivacion, setDerivacion] = useState<Derivacion | null>(null);
  const [citas, setCitas] = useState<Cita[]>([]);
  const [pendientes, setPendientes] = useState<CitaPendiente[]>([]);
  const [preparaciones, setPreparaciones] = useState<Record<number, PreparacionDeCita>>({});
  const [cargandoCitas, setCargandoCitas] = useState(true);
  const [errorCitas, setErrorCitas] = useState(false);

  // filtros de la lista
  const [tab, setTab] = useState<'todas' | 'pendiente' | 'confirmada' | 'cancelada'>('todas');
  const [dias, setDias] = useState(''); // '' = Ver todo

  // formulario
  const [idMascota, setIdMascota] = useState('');
  const [idVeterinario, setIdVeterinario] = useState('');
  const [fecha, setFecha] = useState('');
  const [idFranja, setIdFranja] = useState<number | null>(null);
  const [canal, setCanal] = useState<CanalContacto>('telefono');
  const [motivo, setMotivo] = useState('');
  const [franjas, setFranjas] = useState<FranjaDisponibilidad[]>([]);
  const [cargandoFranjas, setCargandoFranjas] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function cargarCitas() {
    setCargandoCitas(true);
    setErrorCitas(false);
    try {
      const [dataCitas, dataMasc, dataPend, dataPrep] = await Promise.all([
        citasService.mias(),
        mascotasService.mias(),
        citasService.pendientesMias().catch(() => [] as CitaPendiente[]),
        // Si esto falla, las citas se ven igual, solo sin la etiqueta de pendientes.
        citasService.preparacionMias().catch(() => [] as PreparacionDeCita[]),
      ]);
      const mapaMascotas: Record<number, Mascota> = {};
      dataMasc.forEach((m) => (mapaMascotas[m.idMascota] = m));

      const ordenadas = [...dataCitas].sort((a, b) => {
        const fa = fechaValida(a.fechaHora);
        const fb = fechaValida(b.fechaHora);
        if (!fa && !fb) return 0;
        if (!fa) return 1;
        if (!fb) return -1;
        return fb.getTime() - fa.getTime();
      });

      setCitas(ordenadas);
      setPendientes(dataPend);
      setPreparaciones(Object.fromEntries(dataPrep.map((f) => [f.idCita, f])));
      setMascotasMapa(mapaMascotas);
    } catch {
      setErrorCitas(true);
    } finally {
      setCargandoCitas(false);
    }
  }

  const [mascotasMapa, setMascotasMapa] = useState<Record<number, Mascota>>({});

  useEffect(() => {
    mascotasService.mias().then((data) => setMascotas(data.filter((m) => m.estado === 'activo')));
    citasService
      .veterinariosPorEspecialidad('general')
      .then(setVeterinarios)
      .catch(() => mostrarToast('No se pudo cargar la lista de veterinarios.', 'error'));
    citasService
      .derivacionesMias()
      .then((data) => {
        const pendientesDeriv = data.filter((d) => String(d.estado || 'pendiente').toLowerCase() === 'pendiente');
        setDerivacion(pendientesDeriv[0] || null);
      })
      .catch(() => {});
    cargarCitas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Al elegir el día (y, si lo hay, el veterinario) se consultan los cupos de cada franja.
  useEffect(() => {
    setIdFranja(null);
    if (!fecha) {
      setFranjas([]);
      return;
    }
    setCargandoFranjas(true);
    citasService
      .disponibilidadFranjas(fecha, idVeterinario ? Number(idVeterinario) : undefined)
      .then(setFranjas)
      .catch(() => mostrarToast('No se pudo consultar la disponibilidad.', 'error'))
      .finally(() => setCargandoFranjas(false));
  }, [idVeterinario, fecha]); // eslint-disable-line react-hooks/exhaustive-deps

  async function usarDerivacion() {
    if (!derivacion) return;
    if (derivacion.idMascota) setIdMascota(String(derivacion.idMascota));
    const vets = await citasService.veterinariosPorEspecialidad(derivacion.especialidadDestino);
    setVeterinarios(vets);
    mostrarToast(`Selecciona un especialista en ${derivacion.especialidadDestino} y una franja del día.`, 'ok');
  }

  async function handleAgendar() {
    if (!idMascota) return mostrarToast('Selecciona una mascota.', 'error');
    if (!fecha) return mostrarToast('Selecciona el día de la cita.', 'error');
    if (!idFranja) return mostrarToast('Selecciona una franja del día (mañana o tarde).', 'error');

    setEnviando(true);
    try {
      await citasService.crear({
        fecha,
        idFranja,
        canal_contacto: canal,
        motivo: motivo.trim() || null,
        idUsuario: usuario!.idUsuario,
        idMascota: Number(idMascota),
        ...(idVeterinario ? { idVeterinario: Number(idVeterinario) } : {}),
      });
      mostrarToast(
        canal === 'urgente'
          ? 'Cita solicitada: queda pendiente de confirmación. Nos comunicaremos contigo de inmediato.'
          : 'Cita solicitada: queda pendiente de confirmación por la clínica.',
        'ok'
      );
      setFecha('');
      setIdFranja(null);
      setMotivo('');
      setFranjas([]);
      await cargarCitas();
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : 'No se pudo agendar la cita.', 'error');
    } finally {
      setEnviando(false);
    }
  }

  async function handleCancelar(idCita: number) {
    if (!await confirmar('¿Seguro que deseas cancelar esta cita?')) return;
    try {
      await citasService.cancelar(idCita);
      mostrarToast('✅ Cita cancelada.', 'ok');
      await cargarCitas();
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : 'No se pudo cancelar la cita.', 'error');
    }
  }

  // "Reprogramar": el dueño no puede editar la cita, así que se cancela
  // la actual y se precarga el formulario con los mismos datos.
  async function handleReprogramar(cita: Cita) {
    if (!await confirmar('Esto cancelará la cita actual y te permitirá agendar una nueva con los mismos datos. ¿Continuar?')) return;
    try {
      await citasService.cancelar(cita.idCita);
      setIdMascota(String(cita.idMascota));
      setMotivo(cita.motivo || '');
      mostrarToast('Cita anterior cancelada. Elige la nueva fecha y confirma abajo.', 'ok');
      await cargarCitas();
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : 'No se pudo cancelar la cita original.', 'error');
    }
  }

  const citasVisibles = citas.filter(
    (c) => (tab === 'todas' || c.estado === tab) && dentroDeDias(c.fechaHora, dias)
  );

  return (
    <section className="section active">
      <div className="section-header">
        <div>
          <div className="page-title">Mis citas</div>
          <div className="page-sub">Historial de consultas y citas agendadas.</div>
        </div>
      </div>

      {pendientes.length > 0 && (
        <div className="form-card" role="status" style={{ marginBottom: 16, borderLeft: '4px solid #f59e0b' }}>
          <strong>
            <i className="ti ti-clock-hour-4" /> Tienes {pendientes.length} cita{pendientes.length > 1 ? 's' : ''} pendiente
            {pendientes.length > 1 ? 's' : ''} de confirmación
          </strong>
          {pendientes.map((p) => (
            <p key={p.idCita} style={{ margin: '6px 0 0', fontSize: 14 }}>{p.mensaje}</p>
          ))}
        </div>
      )}

      <div className="form-card" style={{ marginBottom: 24 }}>
        <div className="page-title" style={{ fontSize: 16, marginBottom: 12 }}>
          <i className="ti ti-calendar-plus" /> Agendar nueva cita
        </div>

        {derivacion && (
          <div className="form-card" style={{ margin: '0 0 16px', borderLeft: '4px solid #f59e0b' }}>
            <strong>
              <i className="ti ti-arrow-right-circle" /> Tienes una derivación pendiente
            </strong>
            <div style={{ margin: '8px 0' }}>Tienes una derivación pendiente a {derivacion.especialidadDestino}.</div>
            <button type="button" className="btn-guardar" onClick={usarDerivacion}>
              <i className="ti ti-calendar-plus" /> Agendar con el especialista
            </button>
          </div>
        )}

        <div className="form-row-2">
          <div>
            <label className="form-label">Mascota *</label>
            <select className="form-input" value={idMascota} onChange={(e) => setIdMascota(e.target.value)}>
              <option value="">Seleccionar...</option>
              {mascotas.map((m) => (
                <option key={m.idMascota} value={m.idMascota}>
                  {m.nombre_mascota}
                  {m.especie ? ` · ${m.especie}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Veterinario (opcional)</label>
            <select className="form-input" value={idVeterinario} onChange={(e) => setIdVeterinario(e.target.value)}>
              <option value="">Sin preferencia: la clínica te asigna uno</option>
              {veterinarios.map((v) => (
                <option key={v.idVeterinario} value={v.idVeterinario}>
                  {`${v.nombre || ''} ${v.apellido || ''}`.trim() || `Veterinario #${v.idVeterinario}`} ·{' '}
                  {v.especialidad || 'General'}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-row-2">
          <div>
            <label className="form-label">Día de la cita *</label>
            <input
              type="date"
              className="form-input"
              min={hoyISO()}
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>
          <div>
            <label className="form-label">¿Cómo te contactamos? *</label>
            <select className="form-input" value={canal} onChange={(e) => setCanal(e.target.value as CanalContacto)}>
              {CANALES.map((c) => (
                <option key={c.valor} value={c.valor}>{c.etiqueta}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label className="form-label">Franja del día *</label>
          {!fecha && <p className="franja-ayuda">Elige primero el día para ver las franjas disponibles.</p>}
          {fecha && cargandoFranjas && <p className="franja-ayuda">Consultando disponibilidad...</p>}
          {fecha && !cargandoFranjas && (
            <div className="franja-opciones" role="radiogroup" aria-label="Franja del día">
              {franjas.map((f) => (
                <button
                  key={f.idFranja}
                  type="button"
                  role="radio"
                  aria-checked={idFranja === f.idFranja}
                  className={`franja-card${idFranja === f.idFranja ? ' sel' : ''}`}
                  disabled={!f.disponible}
                  onClick={() => setIdFranja(f.idFranja)}
                >
                  <strong>{f.nombre}</strong>
                  <span>{hhmm(f.hora_inicio)} – {hhmm(f.hora_fin)}</span>
                  <small>
                    {f.disponible
                      ? `Quedan ${f.cupos_disponibles} cupo${f.cupos_disponibles === 1 ? '' : 's'}`
                      : f.motivo_no_disponible || 'No disponible'}
                  </small>
                </button>
              ))}
            </div>
          )}
          <p className="franja-ayuda">
            No eliges una hora exacta: la clínica te confirma la hora dentro de la franja.
          </p>
        </div>

        <div>
          <label className="form-label">Motivo (opcional)</label>
          <textarea
            className="form-input"
            rows={3}
            maxLength={500}
            placeholder="Ej: Vacunación anual, revisión general..."
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
        </div>

        <button className="btn-guardar" onClick={handleAgendar} disabled={enviando}>
          <i className="ti ti-calendar-event" style={{ fontSize: 16 }} />{' '}
          {enviando ? 'Agendando...' : 'Agendar cita'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        {TABS.map((t) => (
          <button
            key={t.valor}
            type="button"
            className="btn-icono"
            aria-pressed={tab === t.valor}
            onClick={() => setTab(t.valor)}
            style={{ width: 'auto', padding: '6px 12px', fontWeight: tab === t.valor ? 700 : 400 }}
          >
            {t.etiqueta}
          </button>
        ))}
      </div>
      <FiltroDias dias={dias} onChange={setDias} />

      <div className="citas-list">
        {cargandoCitas && <p style={{ fontSize: 14, color: 'var(--color-texto-gris)' }}>Cargando citas...</p>}
        {!cargandoCitas && errorCitas && (
          <div className="vacio">
            <i className="ti ti-wifi-off" />
            Error al cargar citas.
          </div>
        )}
        {!cargandoCitas && !errorCitas && !citasVisibles.length && (
          <div className="vacio">
            <i className="ti ti-calendar-off" />
            {citas.length ? 'Ninguna cita coincide con el filtro.' : 'No tienes citas registradas.'}
          </div>
        )}
        {!cargandoCitas &&
          !errorCitas &&
          citasVisibles.map((c) => {
            const f = fechaValida(c.fechaHora);
            const dia = f ? f.getDate() : '--';
            const mes = f ? f.toLocaleDateString('es-CO', { month: 'short' }).toUpperCase() : 'S/F';
            const horaTexto = c.franja
              ? c.franja.nombre
              : f ? f.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '--:--';
            const mascota = mascotasMapa[c.idMascota];
            const nombreMascota = mascota
              ? `${mascota.nombre_mascota}${mascota.especie ? ' · ' + mascota.especie : ''}`
              : `Mascota #${c.idMascota}`;
            const puedeGestionar = c.estado === 'pendiente';

            return (
              <div className={`cita-row ${c.estado}`} key={c.idCita}>
                <div className="cita-fecha-block">
                  <div className="cita-dia">{dia}</div>
                  <div className="cita-mes">{mes}</div>
                  <div className="cita-hora">{horaTexto}</div>
                </div>
                <div className="cita-row-info">
                  <div className="cita-mascota-nombre">{nombreMascota}</div>
                  <div className="cita-motivo">
                    {c.motivo || 'Consulta veterinaria'}
                    {c.canal_contacto && c.canal_contacto !== 'app' && (
                      <> · Contacto: {ETIQUETA_CANAL[c.canal_contacto] || c.canal_contacto}</>
                    )}
                  </div>
                  <PreparacionCita fila={preparaciones[c.idCita]} />
                </div>
                <span className={`badge-estado ${c.estado}`}>
                  {c.estado === 'pendiente' ? 'Pendiente de confirmación' : c.estado}
                </span>
                {puedeGestionar && (
                  <div className="cita-acciones">
                    <button className="btn-icono" title="Reprogramar" onClick={() => handleReprogramar(c)}>
                      <i className="ti ti-calendar-repeat" />
                    </button>
                    <button
                      className="btn-icono btn-icono-danger"
                      title="Cancelar"
                      onClick={() => handleCancelar(c.idCita)}
                    >
                      <i className="ti ti-x" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </section>
  );
}