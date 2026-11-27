// =================================================================
// Archivo: src/pages/AdministracionSeguimientoPage/AdministracionSeguimientoPage.tsx
// RESPONSABILIDAD: Seguimiento automático (RQF-25 a RQF-32):
//  - Plantillas: qué preguntas se le hacen al dueño y cuántos días
//    después de un diagnóstico, y con qué nivel de alerta si responde "mal".
//  - Iniciar seguimiento: activar manualmente una plantilla sobre un
//    historial clínico concreto (mascota + diagnóstico ya elegidos).
//  - Alertas: bandeja de casos donde el dueño reportó mala evolución.
// Endpoints: /seguimientos/plantillas, /seguimientos/preguntas,
//            /seguimientos/ (POST, iniciar), /seguimientos/alertas/pendientes
// =================================================================
import { useEffect, useMemo, useState } from 'react';
import { seguimientoAdminService } from '../../services/seguimientoAdminService';
import type { Alerta, NivelAlerta, Plantilla, Pregunta } from '../../services/seguimientoAdminService';
import { historialService } from '../../services/historialService';
import type { RegistroHistorial } from '../../services/historialService';
import { useToast } from '../../components/Toast/ToastContext';
import AdminModal from '../../components/AdminModal/AdminModal';
import NivelChip from '../../components/NivelChip/NivelChip';
import '../../assets/css/admin.css';
import '../../assets/css/administracion.css';


type Pestana = 'plantillas' | 'alertas';

const NIVELES: Record<NivelAlerta, string> = {
  rojo: 'Rojo (emergencia)',
  naranja: 'Naranja (muy urgente)',
  amarillo: 'Amarillo (urgente)',
  verde: 'Verde (estándar)',
};
const PESO_NIVEL: Record<NivelAlerta, number> = { rojo: 0, naranja: 1, amarillo: 2, verde: 3 };

const FORM_PLANTILLA_VACIO = { nombre: '', tipo_animal: '', diagnostico: '' };
type OpcionForm = { valor: string; etiqueta: string; puntos: string; nivel: NivelAlerta; bandera: boolean };
const OPCIONES_BRM: OpcionForm[] = [
  { valor: 'bien', etiqueta: 'Bien', puntos: '0', nivel: 'verde', bandera: false },
  { valor: 'regular', etiqueta: 'Regular', puntos: '2', nivel: 'amarillo', bandera: false },
  { valor: 'mal', etiqueta: 'Mal', puntos: '5', nivel: 'rojo', bandera: true },
];
const OPCIONES_SI_NO: OpcionForm[] = [
  { valor: 'si', etiqueta: 'Sí', puntos: '0', nivel: 'verde', bandera: false },
  { valor: 'no', etiqueta: 'No', puntos: '2', nivel: 'amarillo', bandera: false },
];
const OPCIONES_PERSONALIZADAS: OpcionForm[] = [
  { valor: 'opcion1', etiqueta: 'Opción 1', puntos: '0', nivel: 'verde', bandera: false },
  { valor: 'opcion2', etiqueta: 'Opción 2', puntos: '2', nivel: 'amarillo', bandera: false },
  { valor: 'opcion3', etiqueta: 'Opción 3', puntos: '5', nivel: 'rojo', bandera: true },
];
const FORM_PREGUNTA_VACIO = { texto: '', dias: '', orden: '1', nivel: 'naranja' as NivelAlerta, tipo: 'bien_regular_mal', opciones: [{ valor: 'bien', etiqueta: 'Bien', puntos: '0', nivel: 'verde' as NivelAlerta, bandera: false }, { valor: 'regular', etiqueta: 'Regular', puntos: '2', nivel: 'amarillo' as NivelAlerta, bandera: false }, { valor: 'mal', etiqueta: 'Mal', puntos: '5', nivel: 'rojo' as NivelAlerta, bandera: true }] };

export default function AdministracionSeguimientoPage() {
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [pestana, setPestana] = useState<Pestana>('plantillas');
  const [guardando, setGuardando] = useState(false);
  const { mostrarToast, confirmar } = useToast();

  // Modal de plantilla
  const [modalPlantilla, setModalPlantilla] = useState(false);
  const [editandoPlantilla, setEditandoPlantilla] = useState<Plantilla | null>(null);
  const [formPlantilla, setFormPlantilla] = useState(FORM_PLANTILLA_VACIO);

  // Modal de preguntas de una plantilla
  const [plantillaActiva, setPlantillaActiva] = useState<Plantilla | null>(null);
  const [preguntas, setPreguntas] = useState<Pregunta[]>([]);
  const [cargandoPreguntas, setCargandoPreguntas] = useState(false);
  const [editandoPregunta, setEditandoPregunta] = useState<Pregunta | null>(null);
  const [formPregunta, setFormPregunta] = useState(FORM_PREGUNTA_VACIO);

  // Modal de iniciar seguimiento: elegir a qué mascota/historial aplica
  const [plantillaParaIniciar, setPlantillaParaIniciar] = useState<Plantilla | null>(null);
  const [historiales, setHistoriales] = useState<RegistroHistorial[]>([]);
  const [cargandoHistoriales, setCargandoHistoriales] = useState(false);
  const [idHistorialElegido, setIdHistorialElegido] = useState('');
  const [iniciando, setIniciando] = useState(false);

  async function cargar() {
    setCargando(true);
    setError('');
    try {
      const resultados = await Promise.allSettled([
        seguimientoAdminService.plantillas(),
        seguimientoAdminService.alertasPendientes(),
      ]);
      const errores: string[] = [];
      if (resultados[0].status === 'fulfilled') setPlantillas(resultados[0].value);
      else errores.push('No se pudieron cargar las plantillas.');
      if (resultados[1].status === 'fulfilled') setAlertas(resultados[1].value);
      else errores.push('No se pudieron cargar las alertas.');
      if (errores.length) setError(errores.join(' '));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar el seguimiento.');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const alertasOrdenadas = useMemo(
    () =>
      [...alertas].sort(
        (a, b) =>
          PESO_NIVEL[a.nivel] - PESO_NIVEL[b.nivel] ||
          new Date(b.fecha_generada).getTime() - new Date(a.fecha_generada).getTime()
      ),
    [alertas]
  );
  const rojas = alertas.filter((a) => a.nivel === 'rojo').length;
  const plantillasActivas = plantillas.filter((p) => p.estado !== 'inactivo').length;

  // ---------- Plantillas ----------
  function abrirNuevaPlantilla() {
    setEditandoPlantilla(null);
    setFormPlantilla(FORM_PLANTILLA_VACIO);
    setModalPlantilla(true);
  }

  function abrirEditarPlantilla(p: Plantilla) {
    setEditandoPlantilla(p);
    setFormPlantilla({ nombre: p.nombre, tipo_animal: p.tipo_animal, diagnostico: p.diagnostico });
    setModalPlantilla(true);
  }

  async function guardarPlantilla() {
    const { nombre, tipo_animal, diagnostico } = formPlantilla;
    if (nombre.trim().length < 3) return mostrarToast('El nombre debe tener al menos 3 caracteres.', 'error');
    if (tipo_animal.trim().length < 2) return mostrarToast('Indica el tipo de animal (ej. Canino).', 'error');
    if (diagnostico.trim().length < 2) return mostrarToast('Indica el diagnóstico al que aplica.', 'error');

    const payload = { nombre: nombre.trim(), tipo_animal: tipo_animal.trim(), diagnostico: diagnostico.trim() };
    setGuardando(true);
    try {
      if (editandoPlantilla) {
        await seguimientoAdminService.actualizarPlantilla(editandoPlantilla.idPlantilla, payload);
        mostrarToast('Plantilla actualizada.', 'ok');
      } else {
        await seguimientoAdminService.crearPlantilla(payload);
        mostrarToast('Plantilla creada. Ahora agrégale preguntas.', 'ok');
      }
      setModalPlantilla(false);
      await cargar();
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : 'No se pudo guardar.', 'error');
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarEstadoPlantilla(p: Plantilla) {
    try {
      if (p.estado === 'inactivo') {
        await seguimientoAdminService.actualizarPlantilla(p.idPlantilla, { estado: 'activo' });
        mostrarToast('Plantilla reactivada.', 'ok');
      } else {
        if (!await confirmar(`¿Desactivar la plantilla "${p.nombre}"? No se podrá usar en nuevos seguimientos.`)) return;
        await seguimientoAdminService.desactivarPlantilla(p.idPlantilla);
        mostrarToast('Plantilla desactivada.', 'ok');
      }
      await cargar();
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : 'No se pudo cambiar el estado.', 'error');
    }
  }

  // ---------- Preguntas ----------
  async function cargarPreguntas(idPlantilla: number) {
    setCargandoPreguntas(true);
    try {
      const lista = await seguimientoAdminService.preguntas(idPlantilla);
      const ordenadas = [...lista].sort((a, b) => a.dias_desde_diagnostico - b.dias_desde_diagnostico || a.orden - b.orden);
      setPreguntas(ordenadas);
      return ordenadas;
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : 'No se pudieron cargar las preguntas.', 'error');
      return [];
    } finally {
      setCargandoPreguntas(false);
    }
  }

  async function abrirPreguntas(p: Plantilla) {
    setPlantillaActiva(p);
    setPreguntas([]);
    setEditandoPregunta(null);
    setFormPregunta(FORM_PREGUNTA_VACIO);
    const lista = await cargarPreguntas(p.idPlantilla);
    setFormPregunta({ ...FORM_PREGUNTA_VACIO, orden: String(lista.length + 1) });
  }

  function editarPregunta(q: Pregunta) {
    setEditandoPregunta(q);
    setFormPregunta({
      texto: q.texto_pregunta,
      dias: String(q.dias_desde_diagnostico),
      orden: String(q.orden),
      nivel: q.nivel_alerta_si_mal,
      tipo: q.tipo_respuesta || 'bien_regular_mal',
      opciones: (q.opciones || []).map((o) => ({ valor: o.valor, etiqueta: o.etiqueta, puntos: String(o.puntos ?? 0), nivel: (o.nivel || 'verde') as NivelAlerta, bandera: !!o.bandera_roja })),
    });
  }

  function cancelarEdicionPregunta() {
    setEditandoPregunta(null);
    setFormPregunta({ ...FORM_PREGUNTA_VACIO, orden: String(preguntas.length + 1) });
  }

  function cambiarTipo(tipo: string) {
    setFormPregunta((f) => ({
      ...f,
      tipo,
      opciones:
        tipo === 'bien_regular_mal' ? OPCIONES_BRM.map((o) => ({ ...o }))
        : tipo === 'si_no' ? OPCIONES_SI_NO.map((o) => ({ ...o }))
        : tipo === 'opciones' ? OPCIONES_PERSONALIZADAS.map((o) => ({ ...o }))
        : [],
    }));
  }

  async function guardarPregunta() {
    if (!plantillaActiva) return;
    const dias = Number(formPregunta.dias);
    const orden = Number(formPregunta.orden);
    if (formPregunta.texto.trim().length < 5) return mostrarToast('La pregunta debe tener al menos 5 caracteres.', 'error');
    if (formPregunta.dias === '' || !Number.isInteger(dias) || dias < 0 || dias > 365) {
      return mostrarToast('Los días desde el diagnóstico deben ser un entero entre 0 y 365.', 'error');
    }
    if (!Number.isInteger(orden) || orden < 1) return mostrarToast('El orden debe ser un entero desde 1.', 'error');

    const opciones = formPregunta.opciones.map((o) => ({
      valor: o.valor.trim(), etiqueta: o.etiqueta.trim(), puntos: Number(o.puntos) || 0, nivel: o.nivel, bandera_roja: o.bandera,
    })).filter((o) => o.valor && o.etiqueta);
    if ((formPregunta.tipo === 'opciones' || formPregunta.tipo === 'si_no') && opciones.length < 2) return mostrarToast('Agrega al menos 2 opciones.', 'error');
    const payload = {
      texto_pregunta: formPregunta.texto.trim(),
      dias_desde_diagnostico: dias,
      orden,
      nivel_alerta_si_mal: formPregunta.nivel,
      tipo_respuesta: formPregunta.tipo,
      // texto y número no llevan opciones
      opciones: formPregunta.tipo === 'texto' || formPregunta.tipo === 'numero' ? null : opciones,
    };
    setGuardando(true);
    try {
      if (editandoPregunta) {
        await seguimientoAdminService.actualizarPregunta(editandoPregunta.idPregunta, payload);
        mostrarToast('Pregunta actualizada.', 'ok');
      } else {
        await seguimientoAdminService.agregarPregunta(plantillaActiva.idPlantilla, payload);
        mostrarToast('Pregunta agregada.', 'ok');
      }
      const lista = await cargarPreguntas(plantillaActiva.idPlantilla);
      setEditandoPregunta(null);
      setFormPregunta({ ...FORM_PREGUNTA_VACIO, orden: String(lista.length + 1) });
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : 'No se pudo guardar la pregunta.', 'error');
    } finally {
      setGuardando(false);
    }
  }

  async function eliminarPregunta(q: Pregunta) {
    if (!plantillaActiva || !await confirmar('¿Eliminar esta pregunta de la plantilla?')) return;
    try {
      await seguimientoAdminService.eliminarPregunta(q.idPregunta);
      mostrarToast('Pregunta eliminada.', 'ok');
      const lista = await cargarPreguntas(plantillaActiva.idPlantilla);
      if (editandoPregunta?.idPregunta === q.idPregunta) {
        setEditandoPregunta(null);
        setFormPregunta({ ...FORM_PREGUNTA_VACIO, orden: String(lista.length + 1) });
      }
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : 'No se pudo eliminar.', 'error');
    }
  }

  // ---------- Iniciar seguimiento (manual, sobre un historial concreto) ----------
  async function abrirIniciarSeguimiento(p: Plantilla) {
    setPlantillaParaIniciar(p);
    setIdHistorialElegido('');
    setHistoriales([]);
    setCargandoHistoriales(true);
    try {
      const todos = await historialService.todos();
      // Se sugieren primero los historiales cuyo diagnóstico/especie
      // coincide con la plantilla, para que sea más fácil ubicar la
      // mascota correcta, pero se muestran todos por si aplica igual.
      const coincide = (h: RegistroHistorial) =>
        (h.especie || '').toLowerCase() === p.tipo_animal.toLowerCase() &&
        (h.diagnostico || '').toLowerCase().includes(p.diagnostico.toLowerCase());
      const ordenados = [...todos].sort((a, b) => {
        const pa = coincide(a) ? 0 : 1;
        const pb = coincide(b) ? 0 : 1;
        if (pa !== pb) return pa - pb;
        return new Date(b.fechaRegistro || 0).getTime() - new Date(a.fechaRegistro || 0).getTime();
      });
      setHistoriales(ordenados);
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : 'No se pudieron cargar los historiales.', 'error');
    } finally {
      setCargandoHistoriales(false);
    }
  }

  function cerrarIniciarSeguimiento() {
    setPlantillaParaIniciar(null);
    setHistoriales([]);
    setIdHistorialElegido('');
  }

  async function confirmarIniciarSeguimiento() {
    if (!plantillaParaIniciar) return;
    const idHistorial = Number(idHistorialElegido);
    if (!idHistorial) return mostrarToast('Selecciona la mascota (historial clínico) a la que aplica.', 'error');

    setIniciando(true);
    try {
      const res = await seguimientoAdminService.iniciar({
        idHistorial,
        idPlantilla: plantillaParaIniciar.idPlantilla,
      });
      mostrarToast(
        `Seguimiento #${res.idSeguimiento} iniciado para ${res.nombre_mascota || 'la mascota seleccionada'}.`,
        'ok'
      );
      cerrarIniciarSeguimiento();
      await cargar();
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : 'No se pudo iniciar el seguimiento.', 'error');
    } finally {
      setIniciando(false);
    }
  }

  // ---------- Alertas ----------
  async function marcarVista(a: Alerta) {
    try {
      await seguimientoAdminService.marcarAlertaVista(a.idAlerta);
      mostrarToast('Alerta marcada como revisada.', 'ok');
      setAlertas((prev) => prev.filter((x) => x.idAlerta !== a.idAlerta));
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : 'No se pudo marcar.', 'error');
    }
  }

  return (
    <section className="seccion activa">
      <div className="sec-header">
        <div>
          <div className="sec-titulo">Seguimiento</div>
          <div className="sec-subtitulo">Plantillas de preguntas post-diagnóstico y alertas de evolución</div>
        </div>
        {pestana === 'plantillas' && (
          <>
            <button className="btn-nuevo" onClick={abrirNuevaPlantilla}>
              <i className="ti ti-plus" /> Nueva plantilla
            </button>

            <button
              className="btn-nuevo"
              onClick={async () => {
                try {
                  await seguimientoAdminService.crearEjemplos();
                  mostrarToast('Plantillas de ejemplo listas.', 'ok');
                  await cargar();
                } catch (err) {
                  mostrarToast(
                    err instanceof Error
                      ? err.message
                      : 'No se pudieron crear los ejemplos.',
                    'error'
                  );
                }
              }}
            >
              <i className="ti ti-sparkles" /> Cargar ejemplos
            </button>
          </>
        )}
      </div>

      <div className="stats">
        <div className="stat">
          <div className="stat-icono">
            <i className="ti ti-clipboard-check" />
          </div>
          <div>
            <div className="stat-label">Plantillas activas</div>
            <div className="stat-valor">{plantillasActivas}</div>
          </div>
        </div>
        <div className="stat">
          <div className="stat-icono acento">
            <i className="ti ti-bell" />
          </div>
          <div>
            <div className="stat-label">Alertas por revisar</div>
            <div className="stat-valor acento">{alertas.length}</div>
          </div>
        </div>
        <div className="stat">
          <div className="stat-icono">
            <i className="ti ti-alert-triangle" />
          </div>
          <div>
            <div className="stat-label">Alertas rojas</div>
            <div className="stat-valor" style={{ color: '#A32D2D' }}>
              {rojas}
            </div>
          </div>
        </div>
      </div>

      <div className="adm-tabs">
        <button className={`adm-tab${pestana === 'plantillas' ? ' activa' : ''}`} onClick={() => setPestana('plantillas')}>
          Plantillas
        </button>
        <button className={`adm-tab${pestana === 'alertas' ? ' activa' : ''}`} onClick={() => setPestana('alertas')}>
          Alertas {alertas.length > 0 && <span className="chip rojo">{alertas.length}</span>}
        </button>
      </div>

      {cargando && <p className="conteo">Cargando...</p>}
      {!cargando && error && (
        <div className="vacio">
          <i className="ti ti-wifi-off" />
          {error}
        </div>
      )}

      {!cargando && !error && pestana === 'plantillas' && (
        <div className="hist-lista">
          {!plantillas.length && (
            <div className="vacio">
              <i className="ti ti-clipboard-off" />
              Aún no hay plantillas. Crea una para poder iniciar seguimientos.
            </div>
          )}
          {plantillas.map((p) => {
            const inactiva = p.estado === 'inactivo';
            return (
              <div className="hist-fila" key={p.idPlantilla} style={inactiva ? { opacity: 0.6 } : undefined}>
                <div className="hist-top">
                  <div>
                    <strong>{p.nombre}</strong>
                    <div className="adm-sub">
                      {p.tipo_animal} · Diagnóstico: {p.diagnostico}
                    </div>
                  </div>
                  <span className={`chip ${inactiva ? 'inactivo' : 'activo'}`}>{inactiva ? 'Desactivada' : 'Activa'}</span>
                </div>
                <div className="hist-acciones">
                  <button onClick={() => abrirPreguntas(p)}>
                    <i className="ti ti-list-details" /> Preguntas
                  </button>
                  {!inactiva && (
                    <button onClick={() => abrirIniciarSeguimiento(p)}>
                      <i className="ti ti-player-play" /> Iniciar seguimiento
                    </button>
                  )}
                  <button onClick={() => abrirEditarPlantilla(p)}>
                    <i className="ti ti-edit" /> Editar
                  </button>
                  <button className={inactiva ? '' : 'btn-del'} onClick={() => cambiarEstadoPlantilla(p)}>
                    <i className={`ti ${inactiva ? 'ti-refresh' : 'ti-trash'}`} /> {inactiva ? 'Reactivar' : 'Desactivar'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!cargando && !error && pestana === 'alertas' && (
        <div className="hist-lista">
          {!alertasOrdenadas.length && (
            <div className="vacio">
              <i className="ti ti-bell-check" />
              No hay alertas pendientes. 
            </div>
          )}
          {alertasOrdenadas.map((a) => (
            <div className="hist-fila" key={a.idAlerta}>
              <div className="hist-top">
                <div>
                  <strong>{a.nombre_mascota || `Mascota #${a.idMascota ?? '?'}`}</strong>
                  <div className="adm-sub">{new Date(a.fecha_generada).toLocaleString('es-CO')}</div>
                </div>
                <NivelChip nivel={a.nivel} texto={NIVELES[a.nivel]} />
              </div>
              <div className="hist-campo">
                <label>Pregunta respondida como "mal"</label>
                <p>{a.texto_pregunta || '—'}</p>
              </div>
              <div className="hist-acciones">
                <button onClick={() => marcarVista(a)}>
                  <i className="ti ti-check" /> Marcar como revisada
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---- Modal: crear/editar plantilla ---- */}
      <AdminModal
        abierto={modalPlantilla}
        titulo={editandoPlantilla ? 'Editar plantilla' : 'Nueva plantilla'}
        onClose={() => setModalPlantilla(false)}
        pie={
          <>
            <button className="btn-cancelar" onClick={() => setModalPlantilla(false)}>
              Cancelar
            </button>
            <button className="btn-guardar" onClick={guardarPlantilla} disabled={guardando}>
              <i className="ti ti-device-floppy" /> {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          </>
        }
      >
        <div className="campo">
          <label>Nombre de la plantilla</label>
          <input
            type="text"
            placeholder="Ej. Recuperación de gastroenteritis"
            value={formPlantilla.nombre}
            onChange={(e) => setFormPlantilla((f) => ({ ...f, nombre: e.target.value }))}
          />
        </div>
        <div className="campo-2">
          <div className="campo" style={{ margin: 0 }}>
            <label>Tipo de animal</label>
            <input
              type="text"
              placeholder="Canino"
              value={formPlantilla.tipo_animal}
              onChange={(e) => setFormPlantilla((f) => ({ ...f, tipo_animal: e.target.value }))}
            />
          </div>
          <div className="campo" style={{ margin: 0 }}>
            <label>Diagnóstico</label>
            <input
              type="text"
              placeholder="Gastroenteritis"
              value={formPlantilla.diagnostico}
              onChange={(e) => setFormPlantilla((f) => ({ ...f, diagnostico: e.target.value }))}
            />
          </div>
        </div>
      </AdminModal>

      {/* ---- Modal: preguntas de la plantilla ---- */}
      <AdminModal
        abierto={!!plantillaActiva}
        titulo={plantillaActiva ? `Preguntas: ${plantillaActiva.nombre}` : 'Preguntas'}
        ancho={520}
        onClose={() => setPlantillaActiva(null)}
      >
        {cargandoPreguntas && <p className="conteo">Cargando...</p>}
        {!cargandoPreguntas && !preguntas.length && (
          <p className="adm-ayuda" style={{ marginBottom: 12 }}>
            Esta plantilla aún no tiene preguntas.
          </p>
        )}
        {preguntas.map((q) => (
          <div className="adm-pregunta" key={q.idPregunta}>
            <div>
              <div className="adm-pregunta-meta">
                <span>Día {q.dias_desde_diagnostico}</span>
                <span>· Orden {q.orden}</span>
                <NivelChip nivel={q.nivel_alerta_si_mal} texto={`Nivel: ${q.nivel_alerta_si_mal}`} />
                <span>{q.tipo_respuesta}</span>
              </div>
              {q.texto_pregunta}
            </div>
            <div className="adm-acciones">
              <button className="btn-ico" title="Editar" onClick={() => editarPregunta(q)}>
                <i className="ti ti-edit" />
              </button>
              <button className="btn-ico rojo" title="Eliminar" onClick={() => eliminarPregunta(q)}>
                <i className="ti ti-trash" />
              </button>
            </div>
          </div>
        ))}

        <div style={{ borderTop: '1px solid rgba(0,0,0,0.08)', marginTop: 14, paddingTop: 14 }}>
          <div className="modal-titulo" style={{ fontSize: 14, marginBottom: 10 }}>
            {editandoPregunta ? 'Editar pregunta' : 'Agregar pregunta'}
          </div>
          <div className="campo">
            <label>Pregunta para el dueño</label>
            <input
              type="text"
              placeholder="¿Su mascota ha vuelto a comer con normalidad?"
              value={formPregunta.texto}
              onChange={(e) => setFormPregunta((f) => ({ ...f, texto: e.target.value }))}
            />
          </div>
          <div className="campo-2">
            <div className="campo" style={{ margin: 0 }}>
              <label>Días desde el diagnóstico</label>
              <input
                type="number"
                min="0"
                max="365"
                value={formPregunta.dias}
                onChange={(e) => setFormPregunta((f) => ({ ...f, dias: e.target.value }))}
              />
            </div>
            <div className="campo" style={{ margin: 0 }}>
              <label>Orden</label>
              <input
                type="number"
                min="1"
                value={formPregunta.orden}
                onChange={(e) => setFormPregunta((f) => ({ ...f, orden: e.target.value }))}
              />
            </div>
          </div>
          <div className="campo">
            <label>Nivel de alerta si el dueño responde "mal"</label>
            <select
              value={formPregunta.nivel}
              onChange={(e) => setFormPregunta((f) => ({ ...f, nivel: e.target.value as NivelAlerta }))}
            >
              {(Object.keys(NIVELES) as NivelAlerta[]).map((n) => (
                <option key={n} value={n}>
                  {NIVELES[n]}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label>Tipo de respuesta</label>
            <select value={formPregunta.tipo} onChange={(e) => cambiarTipo(e.target.value)}>
              <option value="bien_regular_mal">Bien / Regular / Mal (compatible)</option>
              <option value="opciones">Opciones personalizadas</option>
              <option value="si_no">Sí / No</option>
              <option value="texto">Texto libre</option>
              <option value="numero">Número</option>
            </select>
          </div>
          {(formPregunta.tipo === 'opciones' || formPregunta.tipo === 'bien_regular_mal' || formPregunta.tipo === 'si_no') && (
            <div className="campo">
              <label>Opciones, puntos y bandera roja</label>
              {formPregunta.opciones.map((op, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 70px 110px 36px', gap: 6, marginBottom: 7 }}>
                  <input value={op.valor} placeholder="valor" onChange={(e) => setFormPregunta((f) => ({ ...f, opciones: f.opciones.map((x, j) => j === i ? { ...x, valor: e.target.value } : x) }))} />
                  <input value={op.etiqueta} placeholder="texto" onChange={(e) => setFormPregunta((f) => ({ ...f, opciones: f.opciones.map((x, j) => j === i ? { ...x, etiqueta: e.target.value } : x) }))} />
                  <input type="number" min="0" value={op.puntos} title="Puntos" onChange={(e) => setFormPregunta((f) => ({ ...f, opciones: f.opciones.map((x, j) => j === i ? { ...x, puntos: e.target.value } : x) }))} />
                  <select value={op.nivel} title="Nivel" onChange={(e) => setFormPregunta((f) => ({ ...f, opciones: f.opciones.map((x, j) => j === i ? { ...x, nivel: e.target.value as NivelAlerta } : x) }))}>
                    {(Object.keys(NIVELES) as NivelAlerta[]).map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <input type="checkbox" checked={op.bandera} title="Bandera roja" onChange={(e) => setFormPregunta((f) => ({ ...f, opciones: f.opciones.map((x, j) => j === i ? { ...x, bandera: e.target.checked } : x) }))} />
                </div>
              ))}
              <button type="button" className="btn-ico" onClick={() => setFormPregunta((f) => ({ ...f, opciones: [...f.opciones, { valor: `opcion${f.opciones.length + 1}`, etiqueta: `Opción ${f.opciones.length + 1}`, puntos: '0', nivel: 'verde' as NivelAlerta, bandera: false }] }))}>
                + Agregar opción
              </button>
            </div>
          )}
          <div className="modal-pie">
            {editandoPregunta && (
              <button className="btn-cancelar" onClick={cancelarEdicionPregunta}>
                Cancelar edición
              </button>
            )}
            <button className="btn-guardar" onClick={guardarPregunta} disabled={guardando}>
              <i className="ti ti-device-floppy" /> {guardando ? 'Guardando...' : editandoPregunta ? 'Guardar cambios' : 'Agregar'}
            </button>
          </div>
        </div>
      </AdminModal>

      {/* ---- Modal: iniciar seguimiento sobre un historial concreto ---- */}
      <AdminModal
        abierto={!!plantillaParaIniciar}
        titulo={plantillaParaIniciar ? `Iniciar seguimiento: ${plantillaParaIniciar.nombre}` : 'Iniciar seguimiento'}
        onClose={cerrarIniciarSeguimiento}
        pie={
          <>
            <button className="btn-cancelar" onClick={cerrarIniciarSeguimiento}>
              Cancelar
            </button>
            <button
              className="btn-guardar"
              onClick={confirmarIniciarSeguimiento}
              disabled={iniciando || !idHistorialElegido}
            >
              <i className="ti ti-player-play" /> {iniciando ? 'Iniciando...' : 'Iniciar seguimiento'}
            </button>
          </>
        }
      >
        <p className="adm-ayuda" style={{ marginBottom: 12 }}>
          Elige a qué mascota (historial clínico) se le va a aplicar esta plantilla. Se muestran primero
          los historiales cuya especie y diagnóstico coinciden con la plantilla.
        </p>
        {cargandoHistoriales && <p className="conteo">Cargando historiales...</p>}
        {!cargandoHistoriales && !historiales.length && (
          <div className="vacio">
            <i className="ti ti-clipboard-off" />
            No hay historiales clínicos registrados todavía.
          </div>
        )}
        {!cargandoHistoriales && !!historiales.length && (
          <div className="campo">
            <label>Mascota / historial clínico</label>
            <select
              value={idHistorialElegido}
              onChange={(e) => setIdHistorialElegido(e.target.value)}
            >
              <option value="">Selecciona una mascota...</option>
              {historiales.map((h) => (
                <option key={h.idHistorial} value={h.idHistorial}>
                  {(h.nombre_mascota || `Mascota #${h.idMascota}`)}
                  {h.especie ? ` (${h.especie})` : ''}
                  {' — '}
                  {h.diagnostico || 'sin diagnóstico'}
                  {h.fechaRegistro ? ` · ${new Date(h.fechaRegistro).toLocaleDateString('es-CO')}` : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </AdminModal>
    </section>
  );
}