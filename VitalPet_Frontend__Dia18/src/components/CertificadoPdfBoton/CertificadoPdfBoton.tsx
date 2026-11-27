// =================================================================
// Archivo: src/components/CertificadoPdfBoton/CertificadoPdfBoton.tsx
// RESPONSABILIDAD: Botón "Descargar PDF" de un certificado. Pide el PDF
// al backend (con QR de verificación) y lo guarda como CERT-XXXX.pdf.
// =================================================================
import { useState } from 'react';
import { certificadosService } from '../../services/certificadosService';
import type { Certificado } from '../../services/certificadosService';
import { useToast } from '../Toast/ToastContext';
import '../FormulaImprimible/FormulaImprimible.css'; // botón .fi-boton

export default function CertificadoPdfBoton({ certificado }: { certificado: Certificado }) {
  const { mostrarToast } = useToast();
  const [cargando, setCargando] = useState(false);

  async function descargar() {
    setCargando(true);
    try {
      const blob = await certificadosService.descargarPdf(certificado.idCertificado);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${certificado.codigo}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : 'No se pudo generar el PDF.', 'error');
    } finally {
      setCargando(false);
    }
  }

  return (
    <button type="button" className="fi-boton no-print" onClick={descargar} disabled={cargando}>
      <i className="ti ti-file-type-pdf" /> {cargando ? 'Generando…' : 'Descargar PDF'}
    </button>
  );
}