// =================================================================
// Archivo: src/pages/DuenoReportePage/DuenoReportePage.tsx
// RESPONSABILIDAD: Reporte diario de salud, una pregunta por pantalla:
//   (mascota) -> ¿comió? -> ¿activa? -> ¿síntoma? -> observaciones + enviar
// con barra de progreso, botón Atrás, pantalla de resultado y un botón
// fijo "Es una emergencia" visible en todos los pasos.
//
// Conexión con el backend (sin cambios en el contrato):
//   GET  /mascotas/mias       -> mascotasService.mias()
//   POST /reportes-salud/     -> reportesSaludService.crear(...)
//   GET  /triaje/niveles      -> useNivelesTriaje()  (texto del resultado)
// =================================================================
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { mascotasService } from '../../services/mascotasService';
import type { Mascota } from '../../services/mascotasService';
import { reportesSaludService } from '../../services/reportesSaludService';
import type { ReporteSalud } from '../../services/reportesSaludService';
import { useNivelesTriaje } from '../../hooks/useNivelesTriaje';
import { useToast } from '../../components/Toast/ToastContext';
import NivelChip from '../../components/NivelChip/NivelChip';
import { CLINICA } from '../../constants/clinica';
import '../../assets/css/dueno.css';
import './DuenoReportePage.css';

const OPCIONES_COMIO = ['Sí, normal', 'Poco', 'No comió'];
const OPCIONES_ACTIVA = ['Muy activa', 'Normal', 'Decaída', 'Sin energía'];
const OPCIONES_SINTOMA = ['Ninguno', 'Vómito', 'Diarrea', 'Tos', 'Otro'];

type Paso = 'mascota' | 'comio' | 'activa' | 'sintoma' | 'final';

const PREGUNTAS: Record<Paso, string> = {
  mascota: '¿Sobre cuál mascota es el reporte?',
  comio: '¿Tu mascota comió bien hoy?',
  activa: '¿Estuvo activa y con energía?',
  sintoma: '¿Presenta algún síntoma hoy?',
  final: '¿Algo más que quieras contarnos?',
};

// Pausa corta tras elegir una opción, para que se alcance a ver la selección.
const PAUSA_AVANCE_MS = 220;

function OpcionesPantalla({
  opciones,
  valor,
  onSelect,
}: {
  opciones: string[];
  valor: string | null;
  onSelect: (op: string) => void;
}) {
  return (
    <div className="reporte-opciones" role="group">
      {opciones.map((op) => (
        <button
          key={op}
          type="button"
          className={`reporte-opcion${valor === op ? ' activo' : ''}`}
          aria-pressed={valor === op}
          onClick={() => onSelect(op)}
        >
          <span>{op}</span>
          {valor === op && <i className="ti ti-check" aria-hidden="true" />}
        </button>
      ))}
    </div>
  );
}

export default function DuenoReportePage() {
  const [mascotas, setMascotas] = useState<Mascota[]>([]);
  const [cargandoMascotas, setCargandoMascotas] = useState(true);
  const [errorMascotas, setErrorMascotas] = useState(false);

  const [idMascota, setIdMascota] = useState('');
  const [comio, setComio] = useState<string | null>(null);
  const [activa, setActiva] = useState<string | null>(null);
  const [sintoma, setSintoma] = useState<string | null>(null);
  const [observaciones, setObservaciones] = useState('');

  const [paso, setPaso] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<ReporteSalud | null>(null);
  const [emergenciaAbierta, setEmergenciaAbierta] = useState(false);

  const { mostrarToast } = useToast();
  const { niveles } = useNivelesTriaje();

  const titulo = useRef<HTMLHeadingElement>(null);
  const temporizador = useRef<number | undefined>(undefined);
  const botonEmergencia = useRef<HTMLButtonElement>(null);

  function cargarMascotas() {
    setCargandoMascotas(true);
    setErrorMascotas(false);
    mascotasService
      .mias()
      .then((data) => {
        const activas = data.filter((m) => m.estado === 'activo');
        setMascotas(activas);
        // Con una sola mascota no hay nada que elegir: se salta ese paso.
        if (activas.length === 1) setIdMascota(String(activas[0].idMascota));
      })
      .catch(() => setErrorMascotas(true))
      .finally(() => setCargandoMascotas(false));
  }

  useEffect(() => {
    cargarMascotas();
    return () => window.clearTimeout(temporizador.current);
  }, []);

  // Pasos del flujo: el de mascota solo aparece si hay más de una.
  const pasos = useMemo<Paso[]>(
    () => [...(mascotas.length > 1 ? (['mascota'] as Paso[]) : []), 'comio', 'activa', 'sintoma', 'final'],
    [mascotas.length]
  );
  const pasoActual = pasos[Math.min(paso, pasos.length - 1)];
  const porcentaje = Math.round(((paso + 1) / pasos.length) * 100);

  // Al cambiar de pregunta, el foco va al título (lectores de pantalla y teclado).
  useEffect(() => {
    titulo.current?.focus({ preventScroll: true });
  }, [paso, resultado]);

  const mascotaElegida = mascotas.find((m) => String(m.idMascota) === idMascota);

  function avanzarTras(guardar: () => void) {
    guardar();
    window.clearTimeout(temporizador.current);
    temporizador.current = window.setTimeout(() => setPaso((p) => Math.min(p + 1, pasos.length - 1)), PAUSA_AVANCE_MS);
  }

  function atras() {
    window.clearTimeout(temporizador.current);
    setPaso((p) => Math.max(p - 1, 0));
  }

  function reiniciar() {
    window.clearTimeout(temporizador.current);
    setComio(null);
    setActiva(null);
    setSintoma(null);
    setObservaciones('');
    setResultado(null);
    setPaso(0);
    if (mascotas.length !== 1) setIdMascota('');
  }

  async function handleEnviar() {
    if (!idMascota) return mostrarToast('Selecciona una mascota.', 'error');
    if (!comio || !activa || !sintoma) return mostrarToast('Responde las tres preguntas antes de enviar.', 'error');

    setEnviando(true);
    try {
      const reporte = await reportesSaludService.crear({
        idMascota: Number(idMascota),
        alimentacion: comio,
        actividad: activa,
        sintomas: sintoma,
        observaciones: observaciones.trim() || null,
      });
      // Azul = todo normal: no se genera alerta para el veterinario
      mostrarToast(
        reporte.nivel === 'azul'
          ? 'Reporte enviado. Tu mascota está bien, no se generó alerta.'
          : 'Reporte enviado. El veterinario será notificado.',
        'ok'
      );
      setResultado(reporte);
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : 'No se pudo enviar el reporte.', 'error');
    } finally {
      setEnviando(false);
    }
  }

  const cerrarEmergencia = useCallback(() => {
    setEmergenciaAbierta(false);
    botonEmergencia.current?.focus();
  }, []);

  // ---------- Contenido según el estado ----------
  let contenido;

  if (cargandoMascotas) {
    contenido = <p className="reporte-estado">Cargando tus mascotas...</p>;
  } else if (errorMascotas) {
    contenido = (
      <div className="reporte-estado">
        <p>No se pudieron cargar tus mascotas.</p>
        <button type="button" className="reporte-btn-sec" onClick={cargarMascotas}>
          Reintentar
        </button>
      </div>
    );
  } else if (mascotas.length === 0) {
    contenido = (
      <div className="reporte-estado">
        <p>Para enviar un reporte primero necesitas registrar una mascota.</p>
        <Link className="reporte-btn-sec" to="/dueno/agregar-mascota">
          Agregar mascota
        </Link>
      </div>
    );
  } else if (resultado) {
    const info = niveles.find((n) => n.codigo === resultado.nivel);
    contenido = (
      <div className="reporte-resultado">
        <i className={`ti ${resultado.nivel === 'azul' ? 'ti-circle-check' : 'ti-bell-ringing'} reporte-resultado-icono`} aria-hidden="true" />
        <h2 className="reporte-pregunta" ref={titulo} tabIndex={-1}>
          Reporte enviado
        </h2>
        <p className="reporte-resultado-texto">
          {mascotaElegida?.nombre_mascota ? `Gracias por contarnos cómo está ${mascotaElegida.nombre_mascota}. ` : ''}
          Nivel de urgencia: <NivelChip nivel={resultado.nivel} texto={info ? `${info.etiqueta} · ${info.nombre}` : undefined} />
        </p>
        <p className="reporte-resultado-texto">
          {info?.desc_dueno ??
            (resultado.nivel === 'azul'
              ? 'No se generó alerta.'
              : 'El veterinario fue notificado y revisará tu reporte.')}
        </p>
        <div className="reporte-acciones">
          <button type="button" className="reporte-btn-prim" onClick={reiniciar}>
            Hacer otro reporte
          </button>
          <Link className="reporte-btn-sec" to="/dueno/inicio">
            Volver al inicio
          </Link>
        </div>
      </div>
    );
  } else {
    contenido = (
      <div key={pasoActual} className="reporte-paso">
        <h2 className="reporte-pregunta" ref={titulo} tabIndex={-1}>
          {PREGUNTAS[pasoActual]}
        </h2>

        {pasoActual === 'mascota' && (
          <div className="reporte-opciones" role="group">
            {mascotas.map((m) => (
              <button
                key={m.idMascota}
                type="button"
                className={`reporte-opcion${idMascota === String(m.idMascota) ? ' activo' : ''}`}
                aria-pressed={idMascota === String(m.idMascota)}
                onClick={() => avanzarTras(() => setIdMascota(String(m.idMascota)))}
              >
                <span>
                  <i className="ti ti-paw" aria-hidden="true" /> {m.nombre_mascota}
                  <small>{m.especie}</small>
                </span>
                {idMascota === String(m.idMascota) && <i className="ti ti-check" aria-hidden="true" />}
              </button>
            ))}
          </div>
        )}

        {pasoActual === 'comio' && (
          <OpcionesPantalla opciones={OPCIONES_COMIO} valor={comio} onSelect={(op) => avanzarTras(() => setComio(op))} />
        )}
        {pasoActual === 'activa' && (
          <OpcionesPantalla opciones={OPCIONES_ACTIVA} valor={activa} onSelect={(op) => avanzarTras(() => setActiva(op))} />
        )}
        {pasoActual === 'sintoma' && (
          <OpcionesPantalla opciones={OPCIONES_SINTOMA} valor={sintoma} onSelect={(op) => avanzarTras(() => setSintoma(op))} />
        )}

        {pasoActual === 'final' && (
          <>
            <label className="form-label" htmlFor="reporte-observaciones">
              Observaciones adicionales (opcional)
            </label>
            <textarea
              id="reporte-observaciones"
              className="form-input form-textarea"
              placeholder="Describe cualquier cambio en el comportamiento..."
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
            />

            <dl className="reporte-resumen">
              <div><dt>Mascota</dt><dd>{mascotaElegida?.nombre_mascota ?? '—'}</dd></div>
              <div><dt>Comió</dt><dd>{comio ?? '—'}</dd></div>
              <div><dt>Energía</dt><dd>{activa ?? '—'}</dd></div>
              <div><dt>Síntoma</dt><dd>{sintoma ?? '—'}</dd></div>
            </dl>

            <button type="button" className="reporte-btn-prim" onClick={handleEnviar} disabled={enviando}>
              <i className="ti ti-send" aria-hidden="true" /> {enviando ? 'Enviando...' : 'Enviar reporte de hoy'}
            </button>
          </>
        )}
      </div>
    );
  }

  const mostrandoPasos = !cargandoMascotas && !errorMascotas && mascotas.length > 0 && !resultado;

  return (
    <section className="section active reporte-diario">
      <div className="section-header">
        <div>
          <div className="page-title">Reporte diario de salud</div>
          <div className="page-sub">Cuéntanos cómo estuvo tu mascota hoy. El veterinario será notificado.</div>
        </div>
      </div>

      <div className="formulario-card reporte-card">
        {mostrandoPasos && (
          <div className="reporte-progreso">
            <div className="reporte-progreso-texto">
              <span>
                Pregunta {paso + 1} de {pasos.length}
              </span>
              {paso > 0 && (
                <button type="button" className="reporte-atras" onClick={atras}>
                  <i className="ti ti-arrow-left" aria-hidden="true" /> Atrás
                </button>
              )}
            </div>
            <div
              className="reporte-barra"
              role="progressbar"
              aria-label="Progreso del reporte"
              aria-valuemin={1}
              aria-valuemax={pasos.length}
              aria-valuenow={paso + 1}
            >
              <div className="reporte-barra-relleno" style={{ width: `${porcentaje}%` }} />
            </div>
          </div>
        )}
        {contenido}
      </div>

      {/* Siempre visible, en todos los pasos y también tras enviar */}
      <button
        type="button"
        ref={botonEmergencia}
        className="btn-emergencia"
        onClick={() => setEmergenciaAbierta(true)}
      >
        <i className="ti ti-alert-triangle" aria-hidden="true" /> Es una emergencia
      </button>

      {emergenciaAbierta && <PanelEmergencia onCerrar={cerrarEmergencia} />}
    </section>
  );
}

// ---------------------------------------------------------------
// Panel que se abre con "Es una emergencia": lo primero es poder
// llamar a la clínica con un toque. No depende del backend.
// ---------------------------------------------------------------
function PanelEmergencia({ onCerrar }: { onCerrar: () => void }) {
  const llamar = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    llamar.current?.focus();
    const alTeclear = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [onCerrar]);

  return (
    <div className="emerg-fondo" onClick={onCerrar}>
      <div
        className="emerg-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="emerg-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="emerg-titulo" className="emerg-titulo">
          <i className="ti ti-alert-triangle" aria-hidden="true" /> Si tu mascota está en peligro, no esperes
        </h2>
        <p className="emerg-texto">
          Llama ahora a la clínica o ve directamente. Este reporte no reemplaza la atención inmediata.
        </p>
        <ul className="emerg-lista">
          <li>Dificultad para respirar o encías pálidas o azuladas</li>
          <li>Convulsiones o pérdida del conocimiento</li>
          <li>Sangrado que no para, golpe fuerte o posible envenenamiento</li>
        </ul>

        <a ref={llamar} className="emerg-llamar" href={CLINICA.telefonoLink}>
          <i className="ti ti-phone-call" aria-hidden="true" /> Llamar a la clínica · {CLINICA.telefonoTexto}
        </a>
        <p className="emerg-direccion">
          <i className="ti ti-map-pin" aria-hidden="true" /> {CLINICA.nombre} — {CLINICA.direccion}
        </p>

        <button type="button" className="reporte-btn-sec emerg-cerrar" onClick={onCerrar}>
          Volver al reporte
        </button>
      </div>
    </div>
  );
}
