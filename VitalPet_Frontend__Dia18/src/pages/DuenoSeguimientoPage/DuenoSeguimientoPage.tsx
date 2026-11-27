// =================================================================
// Archivo: src/pages/DuenoSeguimientoPage/DuenoSeguimientoPage.tsx
// RESPONSABILIDAD: Lista de preguntas de seguimiento pendientes y
// envío de respuesta (bien/regular/mal). Migrado de dueno-seguimiento.html
// + renderSeguimientos()/guardarRespuestaSeguimiento() de dueno.js.
// =================================================================
import { useEffect, useRef, useState } from 'react';
import { seguimientoService } from '../../services/seguimientoService';
import type { SeguimientoPendiente, RespuestaSeguimiento, OpcionSeguimiento } from '../../services/seguimientoService';
import { useToast } from '../../components/Toast/ToastContext';
import '../../assets/css/dueno.css';
import '../../assets/css/admin.css';

function idDe(s: SeguimientoPendiente): number | null {
  return s.idRespuesta || s.id_respuesta || s.id || s.idPregunta || s.id_pregunta || s.pregunta?.idPregunta || null;
}

function textoPreguntaDe(s: SeguimientoPendiente, index: number): string {
  return s.texto_pregunta || s.pregunta?.texto_pregunta || `Pregunta ${index + 1}`;
}

function fechaDe(s: SeguimientoPendiente): string {
  const raw = s.fecha_programada || s.fechaProgramada || s.fecha;
  if (!raw) return '';
  const d = new Date(raw);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-CO');
}

// Opciones a mostrar: las de la plantilla; si no hay, las de respaldo según el tipo.
function opcionesDe(s: SeguimientoPendiente): OpcionSeguimiento[] {
  if (s.opciones && s.opciones.length) return s.opciones;
  if (s.tipo_respuesta === 'si_no') {
    return [{ valor: 'si', etiqueta: 'Sí' }, { valor: 'no', etiqueta: 'No' }];
  }
  return [
    { valor: 'bien', etiqueta: 'Bien' },
    { valor: 'regular', etiqueta: 'Regular' },
    { valor: 'mal', etiqueta: 'Mal' },
  ];
}

export default function DuenoSeguimientoPage() {
  const [items, setItems] = useState<SeguimientoPendiente[]>([]);
  const [respuestas, setRespuestas] = useState<Record<number, RespuestaSeguimiento | ''>>({});
  const [estado, setEstado] = useState<'cargando' | 'ok' | 'vacio' | 'error'>('cargando');
  const [errorMsg, setErrorMsg] = useState('');
  const [enviando, setEnviando] = useState<number[]>([]);
  const enviandoRef = useRef(false);
  const { mostrarToast } = useToast();

  async function cargar() {
    setEstado('cargando');
    try {
      const data = await seguimientoService.pendientesMios();
      setItems(data || []);
      setEstado(data && data.length ? 'ok' : 'vacio');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al cargar seguimientos.');
      setEstado('error');
    }
  }

  useEffect(() => {
    cargar();

    // Las preguntas nuevas del veterinario aparecen solas, sin recargar la página.
    const refrescar = () => {
      if (enviandoRef.current) return; // no pisar una respuesta que se está enviando
      seguimientoService
        .pendientesMios()
        .then((lista) => {
          if (enviandoRef.current) return;
          setItems(lista || []);
          setEstado(lista && lista.length ? 'ok' : 'vacio');
        })
        .catch(() => { /* se reintenta en el siguiente ciclo */ });
    };
    const alVolver = () => { if (document.visibilityState === 'visible') refrescar(); };
    const timer = setInterval(refrescar, 30_000);
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, []);

  async function handleEnviar(s: SeguimientoPendiente) {
    const id = idDe(s);
    if (!id) return mostrarToast('No se encontró el identificador de la pregunta.', 'error');
    if (enviando.includes(id)) return;

    const respuesta = respuestas[id];
    if (!respuesta) return mostrarToast('Selecciona una respuesta.', 'error');

    enviandoRef.current = true;
    setEnviando((e) => [...e, id]);

    // La encuesta desaparece al instante; si el envío falla, se devuelve.
    const previos = items;
    const restantes = items.filter((it) => idDe(it) !== id);
    setItems(restantes);
    setEstado(restantes.length ? 'ok' : 'vacio');

    try {
      await seguimientoService.responder(id, respuesta);
      mostrarToast('Respuesta enviada correctamente.', 'ok');
      setRespuestas((r) => {
        const { [id]: _quitada, ...resto } = r;
        return resto;
      });
    } catch (err) {
      setItems(previos);
      setEstado('ok');
      mostrarToast(err instanceof Error ? err.message : 'Error al enviar la respuesta.', 'error');
    } finally {
      enviandoRef.current = false;
      setEnviando((e) => e.filter((x) => x !== id));
    }
  }

  return (
    <section className="section active">
      <div className="section-header">
        <div>
          <div className="page-title">Seguimiento</div>
          <div className="page-sub">Responde el estado de tu mascota tras la consulta.</div>
        </div>
      </div>

      <div id="seguimientoLista">
        {estado === 'cargando' && (
          <div className="vacio">
            <i className="ti ti-loader" />
            Cargando seguimientos...
          </div>
        )}
        {estado === 'error' && (
          <div className="vacio">
            <i className="ti ti-wifi-off" />
            <p>{errorMsg}</p>
          </div>
        )}
        {estado === 'vacio' && (
          <div className="vacio">
            <i className="ti ti-clipboard-check" />
            No tienes seguimientos pendientes.
          </div>
        )}
        {estado === 'ok' &&
          items.map((s, index) => {
            const id = idDe(s);
            const nombreMascota = s.nombre_mascota || s.mascota?.nombre || 'Mascota';
            const fecha = fechaDe(s);
            const tipo = s.tipo_respuesta || 'bien_regular_mal';

            return (
              <div className="hist-card" key={id ?? index}>
                <div className="hist-header">
                  <span className="hist-mascota">
                    <i className="ti ti-paw" /> {nombreMascota}
                  </span>
                  {fecha && (
                    <span className="hist-fecha">
                      <i className="ti ti-calendar" /> {fecha}
                    </span>
                  )}
                </div>

                <div className="hist-campo">
                  <label>Pregunta de seguimiento</label>
                  <p>{textoPreguntaDe(s, index)}</p>
                </div>

                <div className="hist-campo">
                  <label>{tipo === 'texto' ? 'Tu respuesta' : tipo === 'numero' ? 'Elige un número del 1 al 10' : '¿Cómo se encuentra?'}</label>
                  {tipo === 'texto' ? (
                    <textarea
                      className="respuesta-seguimiento"
                      rows={3}
                      maxLength={255}
                      placeholder="Escribe tu respuesta"
                      value={id ? respuestas[id] || '' : ''}
                      onChange={(e) => id && setRespuestas((r) => ({ ...r, [id]: e.target.value }))}
                    />
                  ) : tipo === 'numero' ? (
                    <select
                      className="respuesta-seguimiento"
                      value={id ? respuestas[id] || '' : ''}
                      onChange={(e) => id && setRespuestas((r) => ({ ...r, [id]: e.target.value }))}
                    >
                      <option value="">Selecciona un número del 1 al 10</option>
                      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={String(n)}>{n}</option>
                      ))}
                    </select>
                  ) : (
                    <select
                      className="respuesta-seguimiento"
                      value={id ? respuestas[id] || '' : ''}
                      onChange={(e) => id && setRespuestas((r) => ({ ...r, [id]: e.target.value }))}
                    >
                      <option value="">Selecciona una respuesta</option>
                      {opcionesDe(s).map((op) => (
                        <option key={op.valor} value={op.valor}>{op.etiqueta}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="hist-acciones">
                  <button className="btn-nuevo" disabled={!!id && enviando.includes(id)} onClick={() => handleEnviar(s)}>
                    <i className="ti ti-send" /> {id && enviando.includes(id) ? 'Enviando...' : 'Enviar respuesta'}
                  </button>
                </div>
              </div>
            );
          })}
      </div>
    </section>
  );
}