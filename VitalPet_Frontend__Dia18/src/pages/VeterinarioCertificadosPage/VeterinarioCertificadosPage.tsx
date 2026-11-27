// =================================================================
// Archivo: src/pages/VeterinarioCertificadosPage/VeterinarioCertificadosPage.tsx
// RESPONSABILIDAD: Pantalla de certificados del veterinario.
//   VER (detalle), IMPRIMIR / PDF y VERIFICAR. Emitir y anular se siguen
//   haciendo desde la ficha del paciente.
// =================================================================
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { mascotasService } from '../../services/mascotasService';
import type { Mascota } from '../../services/mascotasService';
import { certificadosService, etiquetaTipoCertificado } from '../../services/certificadosService';
import type { Certificado, VerificacionCertificado } from '../../services/certificadosService';
import { useToast } from '../../components/Toast/ToastContext';
import AdminModal from '../../components/AdminModal/AdminModal';
import CertificadoImprimible from '../../components/CertificadoImprimible/CertificadoImprimible';
import CertificadoPdfBoton from '../../components/CertificadoPdfBoton/CertificadoPdfBoton';
import '../../assets/css/admin.css';
import './VeterinarioCertificadosPage.css';

const fecha = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

export default function VeterinarioCertificadosPage() {
  const { mostrarToast } = useToast();
  const [params, setParams] = useSearchParams();
  const idMascota = Number(params.get('mascota')) || 0;

  const [mascotas, setMascotas] = useState<Mascota[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [certificados, setCertificados] = useState<Certificado[]>([]);
  const [cargando, setCargando] = useState(false);
  const [viendo, setViendo] = useState<Certificado | null>(null);

  const [codigo, setCodigo] = useState('');
  const [verificando, setVerificando] = useState(false);
  const [errorVerif, setErrorVerif] = useState('');
  const [resultado, setResultado] = useState<VerificacionCertificado | null>(null);

  // Lista de pacientes para el selector
  useEffect(() => {
    mascotasService.todas()
      .then(setMascotas)
      .catch((e) => mostrarToast(e instanceof Error ? e.message : 'No se pudieron cargar los pacientes.', 'error'));
  }, [mostrarToast]);

  // Certificados del paciente elegido
  useEffect(() => {
    if (!idMascota) { setCertificados([]); return; }
    let vigente = true;
    setCargando(true);
    certificadosService.deMascota(idMascota)
      .then((data) => vigente && setCertificados(data))
      .catch((e) => vigente && mostrarToast(e instanceof Error ? e.message : 'No se pudieron cargar los certificados.', 'error'))
      .finally(() => vigente && setCargando(false));
    return () => { vigente = false; };
  }, [idMascota, mostrarToast]);

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return q ? mascotas.filter((m) => m.nombre_mascota.toLowerCase().includes(q)) : mascotas;
  }, [mascotas, busqueda]);

  async function verificar(valor: string) {
    const limpio = valor.trim();
    if (!limpio) { setErrorVerif('Escribe el código de verificación.'); setResultado(null); return; }
    setVerificando(true);
    setErrorVerif('');
    setResultado(null);
    try {
      setResultado(await certificadosService.verificar(limpio));
    } catch (e) {
      setErrorVerif(e instanceof Error ? e.message : 'No se pudo verificar el certificado.');
    } finally {
      setVerificando(false);
    }
  }

  // El botón "Verificar" de cada tarjeta usa el código del propio certificado.
  function verificarDe(c: Certificado) {
    const valor = c.codigo_verificacion || c.codigo;
    setCodigo(valor);
    verificar(valor);
    document.getElementById('vcp-verificar')?.scrollIntoView({ behavior: 'smooth' });
  }

  const clase = resultado ? (resultado.valido ? 'ok' : resultado.integro ? 'aviso' : 'mal') : '';

  return (
    <div className="vcp">
      <h1 className="vcp-titulo"><i className="ti ti-certificate" /> Certificados</h1>

      {/* ---------- Verificar ---------- */}
      <section className="vcp-bloque" id="vcp-verificar">
        <h2>Verificar un certificado</h2>
        <form className="vcp-verif-form" onSubmit={(e) => { e.preventDefault(); verificar(codigo); }}>
          <input
            type="text" value={codigo} maxLength={30} autoComplete="off" spellCheck={false}
            placeholder="Código de verificación o N.º CERT-…" aria-label="Código de verificación"
            onChange={(e) => setCodigo(e.target.value)}
          />
          <button type="submit" className="btn-guardar" disabled={verificando}>
            {verificando ? 'Verificando…' : 'Verificar'}
          </button>
        </form>
        {errorVerif && <p className="vcp-resultado mal" role="alert"><i className="ti ti-circle-x" /> {errorVerif}</p>}
        {resultado && (
          <div className={`vcp-resultado ${clase}`} role="status">
            <p><strong><i className={`ti ${resultado.valido ? 'ti-circle-check' : 'ti-alert-triangle'}`} /> {resultado.mensaje}</strong></p>
            <p>
              {resultado.codigo} · {etiquetaTipoCertificado(resultado.tipo)} ·{' '}
              {[resultado.mascota_nombre, resultado.mascota_especie].filter(Boolean).join(' · ') || '—'} ·
              Emitido el {fecha(resultado.fechaEmision)}
              {resultado.vigenciaHasta ? ` · Válido hasta ${fecha(resultado.vigenciaHasta)}` : ''}
              {resultado.estado === 'anulado' ? ` · Anulado el ${fecha(resultado.fechaAnulacion)}` : ''}
            </p>
          </div>
        )}
      </section>

      {/* ---------- Certificados por paciente ---------- */}
      <section className="vcp-bloque">
        <h2>Certificados por paciente</h2>
        <div className="vcp-selector">
          <input
            type="search" value={busqueda} placeholder="Buscar paciente…" aria-label="Buscar paciente"
            onChange={(e) => setBusqueda(e.target.value)}
          />
          <select
            value={idMascota || ''} aria-label="Paciente"
            onChange={(e) => setParams(e.target.value ? { mascota: e.target.value } : {})}
          >
            <option value="">— Elige un paciente —</option>
            {filtradas.map((m) => (
              <option key={m.idMascota} value={m.idMascota}>{m.nombre_mascota} ({m.especie})</option>
            ))}
          </select>
          {idMascota > 0 && (
            <Link to={`/admin/ficha/${idMascota}`} className="vcp-enlace">
              <i className="ti ti-file-plus" /> Emitir uno nuevo en la ficha
            </Link>
          )}
        </div>

        {!idMascota && <p className="vcp-vacio">Elige un paciente para ver sus certificados.</p>}
        {idMascota > 0 && cargando && <p className="vcp-vacio">Cargando…</p>}
        {idMascota > 0 && !cargando && !certificados.length && <p className="vcp-vacio">Este paciente no tiene certificados.</p>}

        <div className="vcp-lista">
          {certificados.map((c) => (
            <article key={c.idCertificado} className="vcp-tarjeta">
              <div className="vcp-tarjeta-top">
                <strong>{etiquetaTipoCertificado(c.tipo)} · {c.codigo}</strong>
                <span className={`chip ${c.estado === 'anulado' ? 'cancelada' : 'confirmada'}`}>{c.estado}</span>
              </div>
              <p className="vcp-nota">
                Emitido el {fecha(c.fechaEmision)} por {c.nombre_veterinario || '—'}
                {c.vigenciaHasta ? ` · Vigente hasta ${fecha(c.vigenciaHasta)}` : ''}
                {c.lote ? ` · Lote ${c.lote}` : ''}
              </p>
              {!c.integro && (
                <p className="vcp-alerta"><i className="ti ti-alert-triangle" /> Fue alterado después de emitirse. No es válido.</p>
              )}
              <div className="vcp-acciones">
                <button type="button" className="fi-boton" onClick={() => setViendo(c)}>
                  <i className="ti ti-eye" /> Ver
                </button>
                <CertificadoImprimible certificado={c} />
                {c.integro && <CertificadoPdfBoton certificado={c} />}
                <button type="button" className="fi-boton" onClick={() => verificarDe(c)}>
                  <i className="ti ti-shield-check" /> Verificar
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ---------- Detalle ---------- */}
      <AdminModal
        abierto={!!viendo} titulo={viendo ? `Certificado ${viendo.codigo}` : ''} onClose={() => setViendo(null)}
        pie={viendo && (
          <>
            <CertificadoImprimible certificado={viendo} />
            {viendo.integro && <CertificadoPdfBoton certificado={viendo} />}
            <button className="btn-cancelar" onClick={() => setViendo(null)}>Cerrar</button>
          </>
        )}
      >
        {viendo && (
          <div className="vcp-detalle">
            <dl>
              <dt>Tipo</dt><dd>{etiquetaTipoCertificado(viendo.tipo)}</dd>
              <dt>Paciente</dt><dd>{[viendo.mascota_nombre, viendo.mascota_especie, viendo.mascota_raza].filter(Boolean).join(' · ') || '—'}</dd>
              <dt>Propietario</dt><dd>{viendo.dueno_nombre || '—'}</dd>
              <dt>Emitido el</dt><dd>{fecha(viendo.fechaEmision)}</dd>
              {viendo.vigenciaHasta && <><dt>Válido hasta</dt><dd>{fecha(viendo.vigenciaHasta)}</dd></>}
              {viendo.lote && <><dt>Lote</dt><dd>{viendo.lote}</dd></>}
              <dt>Veterinario</dt><dd>{viendo.nombre_veterinario || '—'} (T.P. {viendo.tarjeta_profesional || '—'})</dd>
              <dt>Verificación</dt><dd>{viendo.codigo_verificacion || '—'}</dd>
              {viendo.estado === 'anulado' && <><dt>Anulado</dt><dd>{fecha(viendo.fechaAnulacion)} — {viendo.motivo_anulacion}</dd></>}
            </dl>
            <p className="vcp-contenido">{viendo.contenido}</p>
          </div>
        )}
      </AdminModal>
    </div>
  );
}