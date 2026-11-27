// =================================================================
// Archivo: src/components/LaboratorioPanel/LaboratorioPanel.tsx
// RESPONSABILIDAD: Exámenes de laboratorio de UNA consulta.
//   modo="veterinario": solicita, edita resultados, entrega y cancela.
//   modo="dueno":       solo lectura (el resultado aparece al entregarse).
// =================================================================
import { useCallback, useEffect, useState } from 'react';
import {
  CATEGORIAS_EXAMEN, ETIQUETA_ESTADO_EXAMEN, laboratorioService,
} from '../../services/laboratorioService';
import type {
  CategoriaExamen, EstadoExamen, ExamenLaboratorio, ValorExamen,
} from '../../services/laboratorioService';
import { useToast } from '../Toast/ToastContext';
import ResultadoLabImprimible from '../ResultadoLabImprimible/ResultadoLabImprimible';
import './LaboratorioPanel.css';

interface Props {
  idHistorial: number;
  modo: 'veterinario' | 'dueno';
}

const etiquetaCategoria = (c: string) => CATEGORIAS_EXAMEN.find((x) => x.valor === c)?.etiqueta ?? c;
const fecha = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

// A qué estados se puede pasar desde el actual (el flujo solo avanza).
const SIGUIENTES: Record<EstadoExamen, EstadoExamen[]> = {
  solicitado: ['solicitado', 'en_proceso', 'entregado'],
  en_proceso: ['en_proceso', 'entregado'],
  entregado: ['entregado'],
  cancelado: ['cancelado'],
};

interface FormEdicion {
  estado: EstadoExamen;
  resultado: string;
  archivo_url: string;
  observaciones: string;
  valores: ValorExamen[];
}

const valorVacio = (): ValorExamen => ({ parametro: '', valor: '', unidad: '', referencia: '' });

function ResultadoExamen({ e }: { e: ExamenLaboratorio }) {
  return (
    <div className="lab-resultado">
      {e.resultado && <p className="lab-texto">{e.resultado}</p>}
      {!!e.valores?.length && (
        <div className="lab-tabla-wrap">
          <table className="lab-tabla">
            <thead><tr><th>Parámetro</th><th>Valor</th><th>Unidad</th><th>Referencia</th></tr></thead>
            <tbody>
              {e.valores.map((v, i) => (
                <tr key={i}><td>{v.parametro}</td><td>{v.valor}</td><td>{v.unidad || '—'}</td><td>{v.referencia || '—'}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {e.archivo_url && /^https?:\/\//i.test(e.archivo_url) && (
        <a className="lab-enlace" href={e.archivo_url} target="_blank" rel="noopener noreferrer">
          <i className="ti ti-file-download" /> Ver archivo del resultado
        </a>
      )}
      {(e.resultado || !!e.valores?.length) && <ResultadoLabImprimible examen={e} />}
    </div>
  );
}

export default function LaboratorioPanel({ idHistorial, modo }: Props) {
  const { mostrarToast, confirmar } = useToast();
  const esVet = modo === 'veterinario';
  const [examenes, setExamenes] = useState<ExamenLaboratorio[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const [nuevo, setNuevo] = useState(false);
  const [categoria, setCategoria] = useState<CategoriaExamen>('hematologia');
  const [tipo, setTipo] = useState('');
  const [obs, setObs] = useState('');

  const [editando, setEditando] = useState<number | null>(null);
  const [form, setForm] = useState<FormEdicion | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      setExamenes(await laboratorioService.porHistorial(idHistorial));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los exámenes.');
    } finally {
      setCargando(false);
    }
  }, [idHistorial]);

  useEffect(() => { cargar(); }, [cargar]);

  async function solicitar() {
    if (tipo.trim().length < 2) return mostrarToast('Escribe qué examen se solicita.', 'error');
    setGuardando(true);
    try {
      await laboratorioService.solicitar({
        idHistorial, categoria, tipo_examen: tipo.trim(), observaciones: obs.trim() || null,
      });
      mostrarToast('Examen solicitado.', 'ok');
      setNuevo(false); setTipo(''); setObs('');
      await cargar();
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : 'No se pudo solicitar el examen.', 'error');
    } finally {
      setGuardando(false);
    }
  }

  function abrirEdicion(e: ExamenLaboratorio) {
    setEditando(e.idExamen);
    setForm({
      estado: e.estado,
      resultado: e.resultado ?? '',
      archivo_url: e.archivo_url ?? '',
      observaciones: e.observaciones ?? '',
      valores: e.valores?.length ? e.valores.map((v) => ({ ...v })) : [],
    });
  }

  async function guardarEdicion(e: ExamenLaboratorio) {
    if (!form) return;
    const valores = form.valores
      .filter((v) => v.parametro.trim() || v.valor.trim())
      .map((v) => ({
        parametro: v.parametro.trim(), valor: v.valor.trim(),
        unidad: v.unidad?.trim() || null, referencia: v.referencia?.trim() || null,
      }));
    if (valores.some((v) => !v.parametro || !v.valor)) {
      return mostrarToast('Cada fila de resultados necesita parámetro y valor.', 'error');
    }
    if (form.estado === 'entregado' && !form.resultado.trim() && !valores.length && !form.archivo_url.trim()) {
      return mostrarToast('Para entregar el examen registra el resultado o los valores medidos.', 'error');
    }
    setGuardando(true);
    try {
      await laboratorioService.actualizar(e.idExamen, {
        estado: form.estado,
        resultado: form.resultado.trim() || null,
        valores: valores.length ? valores : null,
        archivo_url: form.archivo_url.trim() || null,
        observaciones: form.observaciones.trim() || null,
      });
      mostrarToast(form.estado === 'entregado' ? 'Resultado entregado.' : 'Examen actualizado.', 'ok');
      setEditando(null); setForm(null);
      await cargar();
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : 'No se pudo guardar el examen.', 'error');
    } finally {
      setGuardando(false);
    }
  }

  async function cancelar(e: ExamenLaboratorio) {
    if (!(await confirmar(`¿Cancelar el examen "${e.tipo_examen}"?`))) return;
    try {
      await laboratorioService.cancelar(e.idExamen);
      mostrarToast('Examen cancelado.', 'ok');
      await cargar();
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : 'No se pudo cancelar el examen.', 'error');
    }
  }

  const cambiarValor = (i: number, campo: keyof ValorExamen, v: string) =>
    setForm((f) => f && { ...f, valores: f.valores.map((x, j) => (j === i ? { ...x, [campo]: v } : x)) });

  return (
    <div className="lab-panel">
      <div className="lab-cabecera">
        <strong><i className="ti ti-flask" /> Laboratorio clínico</strong>
        {esVet && !nuevo && (
          <button type="button" className="lab-btn" onClick={() => setNuevo(true)}>
            <i className="ti ti-plus" /> Solicitar examen
          </button>
        )}
      </div>

      {esVet && nuevo && (
        <div className="lab-form">
          <label>Categoría
            <select value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaExamen)}>
              {CATEGORIAS_EXAMEN.map((c) => <option key={c.valor} value={c.valor}>{c.etiqueta}</option>)}
            </select>
          </label>
          <label>Examen
            <input type="text" maxLength={150} placeholder="Ej. Hemograma completo" value={tipo} onChange={(e) => setTipo(e.target.value)} />
          </label>
          <label>Observaciones (opcional)
            <textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
          </label>
          <div className="lab-acciones">
            <button type="button" className="lab-btn sec" onClick={() => setNuevo(false)}>Cancelar</button>
            <button type="button" className="lab-btn" onClick={solicitar} disabled={guardando}>
              {guardando ? 'Guardando...' : 'Solicitar'}
            </button>
          </div>
        </div>
      )}

      {cargando && <p className="lab-vacio">Cargando exámenes...</p>}
      {!cargando && error && <p className="lab-vacio">{error} <button type="button" className="lab-btn sec" onClick={cargar}>Reintentar</button></p>}
      {!cargando && !error && !examenes.length && (
        <p className="lab-vacio">{esVet ? 'No hay exámenes solicitados en esta consulta.' : 'Esta consulta no tiene exámenes de laboratorio.'}</p>
      )}

      {!cargando && !error && examenes.map((e) => (
        <div key={e.idExamen} className={`lab-item ${e.estado}`}>
          <div className="lab-item-cab">
            <div>
              <div className="lab-nombre">{e.tipo_examen}</div>
              <div className="lab-meta">{etiquetaCategoria(e.categoria)} · Solicitado {fecha(e.fecha_solicitud)}
                {e.fecha_resultado ? ` · Entregado ${fecha(e.fecha_resultado)}` : ''}</div>
            </div>
            <span className={`lab-estado ${e.estado}`}>{ETIQUETA_ESTADO_EXAMEN[e.estado]}</span>
          </div>

          {e.observaciones && <p className="lab-obs">{e.observaciones}</p>}

          {(esVet || e.estado === 'entregado') && (e.resultado || e.valores?.length || e.archivo_url) && editando !== e.idExamen && (
            <ResultadoExamen e={e} />
          )}
          {!esVet && e.estado !== 'entregado' && (
            <p className="lab-pendiente"><i className="ti ti-clock" /> El resultado estará disponible cuando el laboratorio lo entregue.</p>
          )}

          {esVet && editando === e.idExamen && form && (
            <div className="lab-form">
              <label>Estado
                <select value={form.estado} onChange={(ev) => setForm({ ...form, estado: ev.target.value as EstadoExamen })}>
                  {SIGUIENTES[e.estado].map((s) => <option key={s} value={s}>{ETIQUETA_ESTADO_EXAMEN[s]}</option>)}
                </select>
              </label>
              <label>Resultado / interpretación
                <textarea rows={3} value={form.resultado} onChange={(ev) => setForm({ ...form, resultado: ev.target.value })} />
              </label>
              <div className="lab-valores">
                <div className="lab-valores-tit">Valores medidos</div>
                {form.valores.map((v, i) => (
                  <div className="lab-valor-fila" key={i}>
                    <input placeholder="Parámetro" value={v.parametro} onChange={(ev) => cambiarValor(i, 'parametro', ev.target.value)} />
                    <input placeholder="Valor" value={v.valor} onChange={(ev) => cambiarValor(i, 'valor', ev.target.value)} />
                    <input placeholder="Unidad" value={v.unidad ?? ''} onChange={(ev) => cambiarValor(i, 'unidad', ev.target.value)} />
                    <input placeholder="Referencia" value={v.referencia ?? ''} onChange={(ev) => cambiarValor(i, 'referencia', ev.target.value)} />
                    <button type="button" className="lab-btn sec" aria-label="Quitar fila"
                      onClick={() => setForm({ ...form, valores: form.valores.filter((_, j) => j !== i) })}>
                      <i className="ti ti-x" />
                    </button>
                  </div>
                ))}
                <button type="button" className="lab-btn sec" onClick={() => setForm({ ...form, valores: [...form.valores, valorVacio()] })}>
                  <i className="ti ti-plus" /> Agregar valor
                </button>
              </div>
              <label>Observaciones
                <textarea rows={2} value={form.observaciones} onChange={(ev) => setForm({ ...form, observaciones: ev.target.value })} />
              </label>
              <div className="lab-acciones">
                <button type="button" className="lab-btn sec" onClick={() => { setEditando(null); setForm(null); }}>Cancelar</button>
                <button type="button" className="lab-btn" onClick={() => guardarEdicion(e)} disabled={guardando}>
                  {guardando ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          )}

          {esVet && editando !== e.idExamen && e.estado !== 'cancelado' && (
            <div className="lab-acciones">
              <button type="button" className="lab-btn sec" onClick={() => abrirEdicion(e)}>
                <i className="ti ti-edit" /> {e.estado === 'entregado' ? 'Corregir resultado' : 'Registrar resultado'}
              </button>
              {e.estado !== 'entregado' && (
                <button type="button" className="lab-btn peligro" onClick={() => cancelar(e)}>
                  <i className="ti ti-ban" /> Cancelar examen
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/** Botón "Laboratorio" que despliega el panel solo cuando se pide (evita una petición por cada consulta de la lista). */
export function LaboratorioDesplegable({ idHistorial, modo }: Props) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <button type="button" className="lab-btn sec no-print" aria-expanded={abierto} onClick={() => setAbierto((a) => !a)}>
        <i className="ti ti-flask" /> {abierto ? 'Ocultar laboratorio' : 'Laboratorio'}
      </button>
      {abierto && <LaboratorioPanel idHistorial={idHistorial} modo={modo} />}
    </>
  );
}