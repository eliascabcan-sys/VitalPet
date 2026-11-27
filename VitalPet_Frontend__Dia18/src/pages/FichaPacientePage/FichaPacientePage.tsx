// =================================================================
// Archivo: src/pages/FichaPacientePage/FichaPacientePage.tsx
// RESPONSABILIDAD: Ficha del paciente, organizada como una "carpeta": arriba
// quién es y sus datos clave; abajo pestañas (Resumen, Consultas, Fórmulas,
// Laboratorio, Esquema sanitario, Citas y compras, Certificados). Solo se
// muestra una pestaña a la vez, que se guarda en la URL (?tab=laboratorio).
// Los filtros por días y la búsqueda siguen funcionando en las pestañas con listas.
// Solo personal de la clínica. Se abre desde Pacientes, Agenda o Citas.
// =================================================================
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { fichaService } from '../../services/fichaService';
import type { FichaAplicacion, FichaPaciente } from '../../services/fichaService';
import type { RegistroHistorial } from '../../services/historialService';
import { certificadosService, etiquetaTipoCertificado, TIPOS_CERTIFICADO } from '../../services/certificadosService';
import type { Certificado, TipoCertificado } from '../../services/certificadosService';
import { ETIQUETA_ESTADO_EXAMEN } from '../../services/laboratorioService';
import type { EstadoExamen } from '../../services/laboratorioService';
import { esquemaSanitarioService } from '../../services/esquemaSanitarioService';
import type { EsquemaSanitario as Esquema } from '../../services/esquemaSanitarioService';
import { autorizacionesService } from '../../services/autorizacionesService';
import type { EstadoAutorizacion } from '../../services/autorizacionesService';
import { useToast } from '../../components/Toast/ToastContext';
import EmptyState from '../../components/EmptyState/EmptyState';
import Skeleton from '../../components/Skeleton/Skeleton';
import AdminModal from '../../components/AdminModal/AdminModal';
import FormulaImprimible from '../../components/FormulaImprimible/FormulaImprimible';
import CertificadoImprimible from '../../components/CertificadoImprimible/CertificadoImprimible';
import EsquemaSanitario from '../../components/EsquemaSanitario/EsquemaSanitario';
import FiltroDias from '../../components/FiltroDias/FiltroDias';
import FichaCabecera from '../../components/FichaCarpeta/FichaCabecera';
import FichaTabs from '../../components/FichaCarpeta/FichaTabs';
import FichaResumen from '../../components/FichaCarpeta/FichaResumen';
import { dentroDeDias } from '../../utils/fechas';
import '../../assets/css/admin.css';
import '../../components/AgendaVet/AgendaVet.css'; // botones .av-btn
import '../../components/FichaCarpeta/FichaCarpeta.css';
import './FichaPacientePage.css';
import CertificadoPdfBoton from '../../components/CertificadoPdfBoton/CertificadoPdfBoton';

const fecha = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const fechaHora = (v?: string | null) =>
  v ? new Date(v).toLocaleString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const dinero = (v: number | string) => `$${Number(v).toLocaleString('es-CO')}`;

type TabId = 'resumen' | 'consultas' | 'formulas' | 'laboratorio' | 'sanitario' | 'citas' | 'certificados';
const TABS: TabId[] = ['resumen', 'consultas', 'formulas', 'laboratorio', 'sanitario', 'citas', 'certificados'];
// Pestañas con listas largas: ahí se muestran los filtros por días y la búsqueda.
const TABS_CON_FILTRO: TabId[] = ['consultas', 'formulas', 'laboratorio', 'sanitario', 'citas'];

// dias '' = "Ver todo" (valor por defecto, no se escribe en la URL)
const FILTROS = { dias: '', q: '' };

// Bloque dentro de una pestaña. Si no lleva título (pestañas de un solo tema),
// solo avisa cuando el filtro está ocultando registros.
function Bloque({ titulo, cantidad, total, children }: {
  titulo?: string; cantidad?: number; total?: number; children: React.ReactNode;
}) {
  const hayRecorte = cantidad !== undefined && total !== undefined && total !== cantidad;
  return (
    <section className="fp-bloque">
      {titulo ? (
        <h2 className="fc-subtitulo">
          {titulo}
          {cantidad !== undefined && <small> ({cantidad}{hayRecorte ? ` de ${total}` : ''})</small>}
        </h2>
      ) : (
        hayRecorte && <p className="fp-vacio">Mostrando {cantidad} de {total}.</p>
      )}
      {children}
    </section>
  );
}

function TablaAplicaciones({ filas, vacio }: { filas: FichaAplicacion[]; vacio: string }) {
  if (!filas.length) return <p className="fp-vacio">{vacio}</p>;
  return (
    <div className="fp-scroll">
      <table className="fp-tabla">
        <thead><tr><th>Aplicación</th><th>Fecha</th><th>Próxima</th><th>Lote</th></tr></thead>
        <tbody>
          {filas.map((a) => (
            <tr key={a.idVacuna}>
              <td>{a.nombre}</td><td>{fecha(a.fecha_aplicacion)}</td>
              <td>{fecha(a.proxima_dosis)}</td><td>{a.lote || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const FORM_CERT = { tipo: 'salud' as TipoCertificado, contenido: '', lote: '', vigenciaHasta: '' };

export default function FichaPacientePage() {
  const { idMascota } = useParams();
  const { mostrarToast, confirmar } = useToast();
  const [filtros, setFiltros] = useState(FILTROS);
  const setFiltro = (clave: 'dias' | 'q', valor: string) =>
    setFiltros((f) => ({ ...f, [clave]: valor }));
  const limpiar = () => setFiltros(FILTROS);
  const hayFiltros = filtros.dias !== '' || filtros.q !== '';
  const [params, setParams] = useSearchParams();

  // La pestaña activa vive en la URL: sobrevive a recargar y se puede compartir el enlace.
  const pedida = params.get('tab') as TabId | null;
  const tab: TabId = pedida && TABS.includes(pedida) ? pedida : 'resumen';
  const irATab = (id: string) =>
    setParams((previos) => {
      const siguientes = new URLSearchParams(previos);
      if (id === 'resumen') siguientes.delete('tab'); else siguientes.set('tab', id);
      return siguientes;
    }, { replace: true });

  const [ficha, setFicha] = useState<FichaPaciente | null>(null);
  const [certificados, setCertificados] = useState<Certificado[]>([]);
  const [esquema, setEsquema] = useState<Esquema | null>(null);
  const [autorizacion, setAutorizacion] = useState<EstadoAutorizacion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  // Emitir certificado
  const [modalCert, setModalCert] = useState(false);
  const [formCert, setFormCert] = useState(FORM_CERT);
  const [firmaRegistrada, setFirmaRegistrada] = useState(true);
  const [emitiendo, setEmitiendo] = useState(false);
  // Anular certificado
  const [anulando, setAnulando] = useState<Certificado | null>(null);
  const [motivo, setMotivo] = useState('');

  const cargar = useCallback(async () => {
    if (!idMascota) return;
    setCargando(true);
    setError('');
    try {
      const [f, certs, esq] = await Promise.all([
        fichaService.deMascota(Number(idMascota)),
        certificadosService.deMascota(Number(idMascota)),
        // El esquema y la autorización son un extra del resumen: si fallan, la ficha se ve igual.
        esquemaSanitarioService.porMascota(Number(idMascota)).catch(() => null),
      ]);
      setFicha(f);
      setCertificados(certs);
      setEsquema(esq);
      setAutorizacion(null);
      if (f.dueno) {
        autorizacionesService.deDueno(f.dueno.idUsuario).then(setAutorizacion).catch(() => setAutorizacion(null));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo cargar la ficha.';
      setError(msg);
      mostrarToast(msg, 'error');
    } finally {
      setCargando(false);
    }
  }, [idMascota]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { cargar(); }, [cargar]);

  // Listas ya filtradas por días y texto. Peso y certificados no se filtran
  // (el certificado es un documento legal: siempre se ve completo).
  const vista = useMemo(() => {
    const q = filtros.q.trim().toLowerCase();
    const pasa = (iso: string | null | undefined, item: object) =>
      dentroDeDias(iso, filtros.dias) && (!q || JSON.stringify(item).toLowerCase().includes(q));
    const f = ficha;
    return {
      controles: (f?.controles ?? []).filter((x) => pasa(x.fecha, x)),
      formulas: (f?.formulas ?? []).filter((x) => pasa(x.fecha, x)),
      laboratorio: (f?.laboratorio ?? []).filter((x) => pasa(x.fecha_solicitud, x)),
      vacunas: (f?.vacunas ?? []).filter((x) => pasa(x.fecha_aplicacion, x)),
      desparasitaciones: (f?.desparasitaciones ?? []).filter((x) => pasa(x.fecha_aplicacion, x)),
      antipulgas: (f?.antipulgas ?? []).filter((x) => pasa(x.fecha_aplicacion, x)),
      inyecciones: (f?.inyecciones ?? []).filter((x) => pasa(x.fecha, x)),
      compras: (f?.compras ?? []).filter((x) => pasa(x.fecha, x)),
      citas: (f?.citas ?? []).filter((x) => pasa(x.fechaHora, x)),
    };
  }, [ficha, filtros.dias, filtros.q]);

  async function abrirEmitir() {
    setFormCert(FORM_CERT);
    setModalCert(true);
    try {
      setFirmaRegistrada((await certificadosService.miFirma()).registrada);
    } catch {
      setFirmaRegistrada(true); // si no se pudo consultar, no se bloquea la emisión
    }
  }

  // La firma es una imagen PNG/JPG pequeña: se guarda en el perfil del veterinario.
  function subirFirma(archivo?: File) {
    if (!archivo) return;
    if (!/^image\/(png|jpeg)$/.test(archivo.type)) return mostrarToast('La firma debe ser una imagen PNG o JPG.', 'error');
    if (archivo.size > 200 * 1024) return mostrarToast('La imagen de la firma pesa más de 200 KB.', 'error');
    const lector = new FileReader();
    lector.onload = async () => {
      try {
        await certificadosService.guardarFirma(String(lector.result));
        setFirmaRegistrada(true);
        mostrarToast('Firma guardada. Saldrá en los certificados nuevos.', 'ok');
      } catch (err) {
        mostrarToast(err instanceof Error ? err.message : 'No se pudo guardar la firma.', 'error');
      }
    };
    lector.readAsDataURL(archivo);
  }

  async function emitir() {
    if (!ficha) return;
    if (!formCert.contenido.trim()) return mostrarToast('Escribe el contenido del certificado.', 'error');
    if (formCert.tipo === 'vacunacion' && !formCert.lote.trim()) {
      return mostrarToast('Un certificado de vacunación necesita el lote de la vacuna.', 'error');
    }
    setEmitiendo(true);
    try {
      await certificadosService.emitir({
        idMascota: ficha.mascota.idMascota,
        tipo: formCert.tipo,
        contenido: formCert.contenido.trim(),
        lote: formCert.lote.trim() || null,
        vigenciaHasta: formCert.vigenciaHasta || null,
      });
      mostrarToast('Certificado emitido. Ya no se puede modificar.', 'ok');
      setModalCert(false);
      await cargar();
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : 'No se pudo emitir el certificado.', 'error');
    } finally {
      setEmitiendo(false);
    }
  }

  async function anular() {
    if (!anulando) return;
    if (motivo.trim().length < 5) return mostrarToast('Escribe el motivo de la anulación (mínimo 5 caracteres).', 'error');
    if (!(await confirmar(`¿Anular el certificado ${anulando.codigo}? Esta acción no se puede deshacer.`))) return;
    try {
      await certificadosService.anular(anulando.idCertificado, motivo.trim());
      mostrarToast('Certificado anulado.', 'ok');
      setAnulando(null);
      setMotivo('');
      await cargar();
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : 'No se pudo anular el certificado.', 'error');
    }
  }

  if (cargando) return <section className="seccion activa"><Skeleton variante="fila" cantidad={5} /></section>;
  if (error || !ficha) {
    return (
      <section className="seccion activa">
        <EmptyState icono="ti-wifi-off" mensaje={error || 'No se encontró la ficha.'}
          accion={<Link to="/admin/pacientes">Volver a Pacientes</Link>} />
      </section>
    );
  }

  const { mascota: m } = ficha;
  const vacio = (texto: string) => (hayFiltros ? 'Nada coincide con el filtro. Prueba con "Ver todo".' : texto);

  // Datos clave del encabezado
  const inicioHoy = new Date(); inicioHoy.setHours(0, 0, 0, 0);
  const proximaCita = ficha.citas
    .filter((c) => (c.estado === 'pendiente' || c.estado === 'confirmada') && new Date(c.fechaHora) >= inicioHoy)
    .sort((a, b) => a.fechaHora.localeCompare(b.fechaHora))[0] ?? null;
  const examenesPendientes = ficha.laboratorio.filter((e) => e.estado === 'solicitado' || e.estado === 'en_proceso').length;
  const vacunasAtrasadas = (esquema?.items ?? []).filter((i) => i.estado === 'vencida' && !i.opcional).length;
  const autorizacionIncompleta = !!autorizacion?.requiere_autorizacion && !autorizacion.completa;

  const registroPara = (idHistorial: number, diagnostico?: string | null, fechaF?: string | null): RegistroHistorial => {
    const c = ficha.controles.find((x) => x.idHistorial === idHistorial);
    return {
      idHistorial, idMascota: m.idMascota, nombre_mascota: m.nombre_mascota, especie: m.especie, raza: m.raza,
      fechaRegistro: c?.fecha ?? fechaF ?? new Date().toISOString(),
      diagnostico: diagnostico ?? undefined,
      peso_consulta: c?.peso_consulta != null ? Number(c.peso_consulta) : undefined,
      cita_control: ficha.cita_control ?? null,
      estado: 'activo',
    };
  };

  const pestanas = [
    { id: 'resumen', etiqueta: 'Resumen', alerta: examenesPendientes + vacunasAtrasadas > 0 || autorizacionIncompleta },
    { id: 'consultas', etiqueta: 'Consultas', cantidad: ficha.controles.length },
    { id: 'formulas', etiqueta: 'Fórmulas', cantidad: ficha.formulas.length },
    { id: 'laboratorio', etiqueta: 'Laboratorio', cantidad: ficha.laboratorio.length, alerta: examenesPendientes > 0 },
    { id: 'sanitario', etiqueta: 'Esquema sanitario', alerta: vacunasAtrasadas > 0 },
    { id: 'citas', etiqueta: 'Citas y compras', cantidad: ficha.citas.length },
    { id: 'certificados', etiqueta: 'Certificados', cantidad: certificados.length },
  ];

  return (
    <section className="seccion activa fp">
      <FichaCabecera
        ficha={ficha}
        proximaCita={proximaCita ? { fechaHora: proximaCita.fechaHora, franja: proximaCita.franja, nombre_veterinario: proximaCita.nombre_veterinario } : null}
        vacunasAtrasadas={vacunasAtrasadas}
        examenesPendientes={examenesPendientes}
        autorizacionIncompleta={autorizacionIncompleta}
        onEmitirCertificado={abrirEmitir}
      />

      <FichaTabs pestanas={pestanas} activa={tab} onCambiar={irATab} />

      {TABS_CON_FILTRO.includes(tab) && (
        <div className="fp-filtros">
          <FiltroDias dias={filtros.dias} onChange={(v) => setFiltro('dias', v)} />
          <input
            type="search"
            className="fp-buscar"
            placeholder="Buscar en la ficha (diagnóstico, medicamento, lote…)"
            aria-label="Buscar en la ficha"
            value={filtros.q}
            onChange={(e) => setFiltro('q', e.target.value)}
          />
          {hayFiltros && (
            <button type="button" className="fi-boton" onClick={limpiar}>
              <i className="ti ti-filter-off" /> Ver todo
            </button>
          )}
        </div>
      )}

      {tab === 'resumen' && <FichaResumen ficha={ficha} esquema={esquema} autorizacion={autorizacion} onIr={irATab} />}

      {tab === 'consultas' && (
        <>
          <Bloque titulo="Consultas" cantidad={vista.controles.length} total={ficha.controles.length}>
            {!vista.controles.length && <p className="fp-vacio">{vacio('Aún no hay consultas registradas.')}</p>}
            {vista.controles.map((c, i) => (
              <details key={c.idHistorial} className="fp-control" open={i === 0}>
                <summary>
                  <strong>{fechaHora(c.fecha)}</strong>
                  <span>{c.motivo_consulta || 'Consulta'}</span>
                  <small>{c.peso_consulta != null ? `${c.peso_consulta} kg` : ''}</small>
                </summary>
                <dl className="fp-campos">
                  {c.nombre_veterinario && <><dt>Veterinario</dt><dd>{c.nombre_veterinario}</dd></>}
                  {c.anamnesis && <><dt>Anamnesis</dt><dd>{c.anamnesis}</dd></>}
                  {(c.temperatura != null || c.frecuencia_cardiaca != null || c.frecuencia_respiratoria != null || c.mucosas || c.hidratacion) && (
                    <><dt>Signos vitales</dt><dd>
                      {[c.temperatura != null && `T ${c.temperatura} °C`,
                        c.frecuencia_cardiaca != null && `FC ${c.frecuencia_cardiaca}`,
                        c.frecuencia_respiratoria != null && `FR ${c.frecuencia_respiratoria}`,
                        c.mucosas && `Mucosas ${c.mucosas}`, c.hidratacion && `Hidratación ${c.hidratacion}`]
                        .filter(Boolean).join(' · ')}
                    </dd></>
                  )}
                  {c.examen_fisico && <><dt>Examen físico</dt><dd>{c.examen_fisico}</dd></>}
                  {c.diagnostico && <><dt>Diagnóstico</dt><dd>{c.diagnostico}</dd></>}
                  {c.tratamiento && <><dt>Tratamiento</dt><dd>{c.tratamiento}</dd></>}
                  {c.procedimientos && <><dt>Procedimientos</dt><dd>{c.procedimientos}</dd></>}
                  {c.inyectologia && <><dt>Inyectología</dt><dd>{c.inyectologia}</dd></>}
                  {c.observaciones && <><dt>Observaciones</dt><dd>{c.observaciones}</dd></>}
                  {c.proxima_cita && <><dt>Próxima cita</dt><dd>{fecha(c.proxima_cita)}</dd></>}
                </dl>
              </details>
            ))}
          </Bloque>

          <Bloque titulo="Inyecciones" cantidad={vista.inyecciones.length} total={ficha.inyecciones.length}>
            {!vista.inyecciones.length && <p className="fp-vacio">{vacio('Sin inyecciones anotadas en las consultas.')}</p>}
            {vista.inyecciones.map((i) => (
              <div key={i.idHistorial} className="fp-tarjeta">
                <div className="fp-tarjeta-top"><strong>{fecha(i.fecha)}</strong></div>
                <p className="fp-nota">{i.contenido}</p>
              </div>
            ))}
          </Bloque>
        </>
      )}

      {tab === 'formulas' && (
        <Bloque cantidad={vista.formulas.length} total={ficha.formulas.length}>
          {!vista.formulas.length && <p className="fp-vacio">{vacio('Sin fórmulas.')}</p>}
          {ficha.cita_control && ficha.formulas.length > 0 && (
            <p className="fp-cita-control">
              <i className="ti ti-calendar-event" /> Cita de control: <strong>{fecha(ficha.cita_control.fechaHora)}</strong>
              {ficha.cita_control.franja_nombre ? ` · ${ficha.cita_control.franja_nombre}` : ''}
              {ficha.cita_control.nombre_veterinario ? ` · con ${ficha.cita_control.nombre_veterinario}` : ' · veterinario por asignar'}
            </p>
          )}
          {vista.formulas.map((f) => (
            <div key={f.idFormula} className="fp-tarjeta">
              <div className="fp-tarjeta-top">
                <strong>Fórmula N.º {String(f.idFormula).padStart(5, '0')} · {fecha(f.fecha)}</strong>
                {f.diagnostico && <span>{f.diagnostico}</span>}
              </div>
              <ul className="fp-lista">
                {f.medicamentos.map((md, i) => (
                  <li key={md.idFormulaMedicamento ?? i}>
                    <strong>{md.nombre_medicamento}</strong> — {md.dosis}, {md.frecuencia}
                    {md.duracion_dias ? `, ${md.duracion_dias} día(s)` : ''}
                  </li>
                ))}
              </ul>
              {f.recomendaciones && <p className="fp-nota">{f.recomendaciones}</p>}
              <FormulaImprimible registro={registroPara(f.idHistorial, f.diagnostico, f.fecha)} formula={f} />
            </div>
          ))}
        </Bloque>
      )}

      {tab === 'laboratorio' && (
        <Bloque cantidad={vista.laboratorio.length} total={ficha.laboratorio.length}>
          {!vista.laboratorio.length && <p className="fp-vacio">{vacio('Sin exámenes de laboratorio.')}</p>}
          {vista.laboratorio.map((e) => (
            <div key={e.idExamen} className="fp-tarjeta">
              <div className="fp-tarjeta-top">
                <strong>{e.tipo_examen}</strong>
                <span>{ETIQUETA_ESTADO_EXAMEN[e.estado as EstadoExamen] || e.estado} · {fecha(e.fecha_solicitud)}</span>
              </div>
              {e.resultado && <p className="fp-nota">{e.resultado}</p>}
            </div>
          ))}
        </Bloque>
      )}

      {tab === 'sanitario' && (
        <>
          {esquema && <EsquemaSanitario esquema={esquema} />}
          <Bloque titulo="Historial de aplicaciones">
            <h3 className="fp-sub-titulo">Vacunas ({vista.vacunas.length}{vista.vacunas.length !== ficha.vacunas.length ? ` de ${ficha.vacunas.length}` : ''})</h3>
            <TablaAplicaciones filas={vista.vacunas} vacio={vacio('Sin vacunas registradas.')} />
            <h3 className="fp-sub-titulo">Desparasitación ({vista.desparasitaciones.length}{vista.desparasitaciones.length !== ficha.desparasitaciones.length ? ` de ${ficha.desparasitaciones.length}` : ''})</h3>
            <TablaAplicaciones filas={vista.desparasitaciones} vacio={vacio('Sin desparasitaciones registradas.')} />
            <h3 className="fp-sub-titulo">Antipulgas ({vista.antipulgas.length}{vista.antipulgas.length !== ficha.antipulgas.length ? ` de ${ficha.antipulgas.length}` : ''})</h3>
            <TablaAplicaciones filas={vista.antipulgas} vacio={vacio('Sin antipulgas registrados.')} />
          </Bloque>
        </>
      )}

      {tab === 'citas' && (
        <>
          <Bloque titulo="Citas" cantidad={vista.citas.length} total={ficha.citas.length}>
            {!vista.citas.length && <p className="fp-vacio">{vacio('Sin citas.')}</p>}
            {vista.citas.map((c) => (
              <div key={c.idCita} className="fp-fila">
                <span><strong>{c.franja ? `${fecha(c.fechaHora)} · ${c.franja}` : fechaHora(c.fechaHora)}</strong>
                  {c.motivo ? ` — ${c.motivo}` : ''}{c.nombre_veterinario ? ` · ${c.nombre_veterinario}` : ''}</span>
                <span className={`chip ${c.estado}`}>{c.estado}</span>
              </div>
            ))}
          </Bloque>

          <Bloque titulo="Compras" cantidad={vista.compras.length} total={ficha.compras.length}>
            {!vista.compras.length && <p className="fp-vacio">{vacio('Sin compras ligadas a las consultas de esta mascota.')}</p>}
            {vista.compras.map((v) => (
              <div key={v.idVenta} className="fp-tarjeta">
                <div className="fp-tarjeta-top">
                  <strong>Venta #{v.idVenta} · {fecha(v.fecha)}</strong>
                  <span>{dinero(v.total)} · {v.estado}</span>
                </div>
                <ul className="fp-lista">
                  {v.items.map((it, i) => <li key={i}>{it.cantidad} × {it.nombre_producto} — {dinero(it.subtotal)}</li>)}
                </ul>
              </div>
            ))}
          </Bloque>
        </>
      )}

      {tab === 'certificados' && (
        <Bloque>
          <button type="button" className="btn-nuevo" onClick={abrirEmitir}><i className="ti ti-certificate" /> Emitir certificado</button>
          {!certificados.length && <p className="fp-vacio">Sin certificados emitidos.</p>}
          {certificados.map((c) => (
            <div key={c.idCertificado} className="fp-tarjeta">
              <div className="fp-tarjeta-top">
                <strong>{etiquetaTipoCertificado(c.tipo)} · {c.codigo}</strong>
                <span className={`chip ${c.estado === 'anulado' ? 'cancelada' : 'confirmada'}`}>{c.estado}</span>
              </div>
              <p className="fp-nota">
                Emitido el {fecha(c.fechaEmision)} por {c.nombre_veterinario || '—'} (T.P. {c.tarjeta_profesional || '—'})
                {c.lote ? ` · Lote ${c.lote}` : ''}{c.vigenciaHasta ? ` · Vigente hasta ${fecha(c.vigenciaHasta)}` : ''}
              </p>
              {!c.integro && <p className="fp-alerta"><i className="ti ti-alert-triangle" /> Este certificado fue alterado después de emitirse. No es válido.</p>}
              {c.estado === 'anulado' && <p className="fp-nota">Anulado: {c.motivo_anulacion}</p>}
              <div className="fp-acciones">
                <CertificadoImprimible certificado={c} />
                {c.integro && <CertificadoPdfBoton certificado={c} />}
                {c.estado !== 'anulado' && (
                  <button type="button" className="fi-boton" onClick={() => { setAnulando(c); setMotivo(''); }}>
                    <i className="ti ti-ban" /> Anular
                  </button>
                )}
              </div>
            </div>
          ))}
        </Bloque>
      )}

      <AdminModal abierto={modalCert} titulo="Emitir certificado" onClose={() => setModalCert(false)}
        pie={<>
          <button className="btn-cancelar" onClick={() => setModalCert(false)}>Cancelar</button>
          <button className="btn-guardar" onClick={emitir} disabled={emitiendo}>{emitiendo ? 'Emitiendo…' : 'Emitir'}</button>
        </>}>
        <p className="fp-aviso">Una vez emitido, el certificado <strong>no se puede editar</strong>: solo anular y emitir otro.</p>
        <div className="campo">
          <label>Tipo *</label>
          <select value={formCert.tipo} onChange={(e) => setFormCert((f) => ({ ...f, tipo: e.target.value as TipoCertificado }))}>
            {TIPOS_CERTIFICADO.map((t) => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}
          </select>
        </div>
        <div className="campo">
          <label>Contenido *</label>
          <textarea rows={5} maxLength={3000} value={formCert.contenido}
            onChange={(e) => setFormCert((f) => ({ ...f, contenido: e.target.value }))} />
        </div>
        <div className="form-row-2">
          <div className="campo">
            <label>Lote{formCert.tipo === 'vacunacion' ? ' *' : ''}</label>
            <input type="text" maxLength={50} value={formCert.lote}
              onChange={(e) => setFormCert((f) => ({ ...f, lote: e.target.value }))} />
          </div>
          <div className="campo">
            <label>Válido hasta</label>
            <input type="date" value={formCert.vigenciaHasta}
              onChange={(e) => setFormCert((f) => ({ ...f, vigenciaHasta: e.target.value }))} />
          </div>
        </div>
        <div className="campo">
          <label>Firma del veterinario</label>
          {firmaRegistrada
            ? <p className="fp-nota">Ya tienes una firma registrada. Se estampará en este certificado. Puedes reemplazarla subiendo otra imagen:</p>
            : <p className="fp-nota">Aún no tienes firma registrada: sin ella, el certificado sale con la línea en blanco para firmar a mano.</p>}
          <input type="file" accept="image/png,image/jpeg" onChange={(e) => subirFirma(e.target.files?.[0])} />
        </div>
      </AdminModal>

      <AdminModal abierto={!!anulando} titulo="Anular certificado" onClose={() => setAnulando(null)}
        pie={<>
          <button className="btn-cancelar" onClick={() => setAnulando(null)}>Cancelar</button>
          <button className="btn-guardar" onClick={anular}>Anular certificado</button>
        </>}>
        <p className="fp-aviso">Se anulará <strong>{anulando?.codigo}</strong>. El documento queda guardado como ANULADO.</p>
        <div className="campo">
          <label>Motivo *</label>
          <textarea rows={3} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </div>
      </AdminModal>
    </section>
  );
}