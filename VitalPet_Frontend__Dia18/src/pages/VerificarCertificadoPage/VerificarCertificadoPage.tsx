// =================================================================
// Archivo: src/pages/VerificarCertificadoPage/VerificarCertificadoPage.tsx
// RESPONSABILIDAD: Verificación PÚBLICA de certificados (sin iniciar sesión).
// Rutas: /verificar  y  /verificar/:codigo (el QR del PDF abre esta última).
// Solo muestra datos mínimos: nunca el contenido ni el propietario.
// =================================================================
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CLINICA } from '../../constants/clinica';
import { certificadosService, etiquetaTipoCertificado } from '../../services/certificadosService';
import type { VerificacionCertificado } from '../../services/certificadosService';
import './VerificarCertificadoPage.css';

const fecha = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';

export default function VerificarCertificadoPage() {
  const { codigo: codigoURL } = useParams();
  const navigate = useNavigate();
  const [codigo, setCodigo] = useState(codigoURL ?? '');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState<VerificacionCertificado | null>(null);

  const verificar = useCallback(async (valor: string) => {
    const limpio = valor.trim();
    if (!limpio) { setError('Escribe el código de verificación.'); setResultado(null); return; }
    setCargando(true);
    setError('');
    setResultado(null);
    try {
      setResultado(await certificadosService.verificar(limpio));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo verificar el certificado.');
    } finally {
      setCargando(false);
    }
  }, []);

  // Si llega por el QR (/verificar/ABCDEFGHJK) se verifica solo.
  useEffect(() => {
    if (codigoURL) { setCodigo(codigoURL); verificar(codigoURL); }
  }, [codigoURL, verificar]);

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    const limpio = codigo.trim();
    if (limpio && limpio !== codigoURL) navigate(`/verificar/${encodeURIComponent(limpio)}`);
    else verificar(limpio);
  }

  const clase = resultado ? (resultado.valido ? 'ok' : resultado.integro ? 'aviso' : 'mal') : '';

  return (
    <main className="vc">
      <div className="vc-tarjeta">
        <h1 className="vc-titulo"><i className="ti ti-certificate" /> Verificar certificado</h1>
        <p className="vc-sub">{CLINICA.nombre}. Escribe el código de verificación que aparece al pie del certificado.</p>

        <form className="vc-form" onSubmit={enviar}>
          <input
            type="text" value={codigo} maxLength={30} autoComplete="off" spellCheck={false}
            placeholder="Ej. ABCDE-FGHJK"
            aria-label="Código de verificación"
            onChange={(e) => setCodigo(e.target.value)}
          />
          <button type="submit" disabled={cargando}>{cargando ? 'Verificando…' : 'Verificar'}</button>
        </form>

        {error && <p className="vc-resultado mal" role="alert"><i className="ti ti-circle-x" /> {error}</p>}

        {resultado && (
          <div className={`vc-resultado ${clase}`} role="status">
            <p className="vc-mensaje">
              <i className={`ti ${resultado.valido ? 'ti-circle-check' : 'ti-alert-triangle'}`} /> {resultado.mensaje}
            </p>
            <dl className="vc-datos">
              <dt>Número</dt><dd>{resultado.codigo}</dd>
              <dt>Tipo</dt><dd>{etiquetaTipoCertificado(resultado.tipo)}</dd>
              <dt>Paciente</dt><dd>{[resultado.mascota_nombre, resultado.mascota_especie].filter(Boolean).join(' · ') || '—'}</dd>
              <dt>Emitido el</dt><dd>{fecha(resultado.fechaEmision)}</dd>
              {resultado.vigenciaHasta && <><dt>Válido hasta</dt><dd>{fecha(resultado.vigenciaHasta)}</dd></>}
              {resultado.lote && <><dt>Lote</dt><dd>{resultado.lote}</dd></>}
              <dt>Veterinario</dt>
              <dd>{resultado.nombre_veterinario || '—'} (T.P. {resultado.tarjeta_profesional || '—'})</dd>
              {resultado.estado === 'anulado' && <><dt>Anulado el</dt><dd>{fecha(resultado.fechaAnulacion)}</dd></>}
            </dl>
          </div>
        )}

        <Link to="/" className="vc-volver">Ir al inicio</Link>
      </div>
    </main>
  );
}