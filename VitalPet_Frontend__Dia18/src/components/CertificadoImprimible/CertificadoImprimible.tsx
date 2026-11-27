// =================================================================
// Archivo: src/components/CertificadoImprimible/CertificadoImprimible.tsx
// RESPONSABILIDAD: Botón "Imprimir certificado" + hoja A4 del certificado
// (se guarda como PDF desde el diálogo de impresión: "Guardar como PDF").
//
// Diseño: encabezado de la clínica, datos del paciente, texto del certificado,
// RECUADRO PARA EL STICKER del biológico, casilla de LOTE, firma del veterinario
// con su tarjeta profesional y el código para verificar que no es falso.
// La hoja solo existe en el DOM mientras se imprime (mismo patrón que la fórmula).
// =================================================================
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CLINICA } from '../../constants/clinica';
import { etiquetaTipoCertificado } from '../../services/certificadosService';
import type { Certificado } from '../../services/certificadosService';
import '../FormulaImprimible/FormulaImprimible.css'; // botón .fi-boton y .no-print
import './CertificadoImprimible.css';

const fechaLarga = (v?: string | null) => {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
};

// 10 caracteres -> "ABCDE-FGHJK" para que se lea y se dicte mejor.
const codigoLegible = (c?: string | null) => (c && c.length === 10 ? `${c.slice(0, 5)}-${c.slice(5)}` : c || '—');

export function HojaCertificado({ certificado: c }: { certificado: Certificado }) {
  const anulado = c.estado === 'anulado';
  return (
    <div className="ci-hoja" aria-hidden="true">
      {anulado && <div className="ci-marca-agua">ANULADO</div>}

      <header className="ci-cabecera">
        <div>
          <div className="ci-clinica">{CLINICA.nombre}</div>
          <div className="ci-contacto">{CLINICA.direccion} · Tel. {CLINICA.telefonoTexto}</div>
        </div>
        <div className="ci-numero">
          <span>N.º {c.codigo}</span>
          <span>Emitido el {fechaLarga(c.fechaEmision)}</span>
        </div>
      </header>

      <h1 className="ci-titulo">Certificado de {etiquetaTipoCertificado(c.tipo).toLowerCase()}</h1>

      <table className="ci-tabla">
        <tbody>
          <tr>
            <th>Paciente</th><td>{c.mascota_nombre || '—'}</td>
            <th>Especie</th><td>{c.mascota_especie || '—'}</td>
          </tr>
          <tr>
            <th>Raza</th><td>{c.mascota_raza || '—'}</td>
            <th>Propietario</th><td>{c.dueno_nombre || '—'}</td>
          </tr>
        </tbody>
      </table>

      <p className="ci-cuerpo">{c.contenido}</p>

      {c.vigenciaHasta && <p className="ci-vigencia">Válido hasta el {fechaLarga(c.vigenciaHasta)}.</p>}

      {/* Lote y recuadro para pegar el sticker del biológico / medicamento */}
      <div className="ci-fila-sticker">
        <div className="ci-lote">
          <span className="ci-etiqueta">Lote</span>
          <span className="ci-lote-valor">{c.lote || ''}</span>
        </div>
        <div className="ci-sticker">
          <span>Espacio para sticker</span>
        </div>
      </div>

      <div className="ci-firma">
        {c.firma_veterinario
          ? <img className="ci-firma-img" src={c.firma_veterinario} alt="" />
          : <div className="ci-firma-vacia" />}
        <div className="ci-linea" />
        <strong>{c.nombre_veterinario || 'Médico veterinario'}</strong>
        <span>Médico veterinario · T.P. {c.tarjeta_profesional || '—'}</span>
      </div>

      <footer className="ci-pie">
        <div>
          <strong>Código de verificación: {codigoLegible(c.codigo_verificacion)}</strong>
          <div>Para comprobar que este documento es auténtico, presente este código en la clínica.</div>
        </div>
        <div>Documento generado por VitalPet. Un certificado emitido no se puede modificar; si tiene un error se anula y se emite uno nuevo.</div>
      </footer>
    </div>
  );
}

interface Props {
  certificado: Certificado;
  etiqueta?: string;
}

export default function CertificadoImprimible({ certificado, etiqueta = 'Imprimir / PDF' }: Props) {
  const [imprimiendo, setImprimiendo] = useState(false);

  useEffect(() => {
    if (!imprimiendo) return;
    const { body } = document;
    const terminar = () => setImprimiendo(false);
    body.classList.add('imprimiendo-certificado');
    window.addEventListener('afterprint', terminar);
    const t = window.setTimeout(() => window.print(), 50); // deja que React pinte la hoja
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('afterprint', terminar);
      body.classList.remove('imprimiendo-certificado');
    };
  }, [imprimiendo]);

  return (
    <>
      <button type="button" className="fi-boton no-print" onClick={() => setImprimiendo(true)} disabled={imprimiendo}>
        <i className="ti ti-printer" /> {etiqueta}
      </button>
      {imprimiendo && createPortal(<HojaCertificado certificado={certificado} />, document.body)}
    </>
  );
}
