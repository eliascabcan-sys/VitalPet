// =================================================================
// Archivo: src/components/FormulaImprimible/FormulaImprimible.tsx
// RESPONSABILIDAD: Botón "Imprimir fórmula" + hoja carta/A4 de la fórmula
// médica. La hoja se dibuja fuera de la app (portal en <body>) y solo se
// ve al imprimir: mientras se imprime, el CSS oculta todo lo demás.
// Se usa tanto en la hoja del dueño como en el historial del veterinario.
// =================================================================
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CLINICA } from '../../constants/clinica';
import type { FormulaHistorial, RegistroHistorial } from '../../services/historialService';
import { textoCitaControl } from '../../utils/citaControl';
import './FormulaImprimible.css';

interface Props {
  registro: RegistroHistorial;
  formula: FormulaHistorial;
  /** Texto del botón (por defecto "Imprimir fórmula"). */
  etiqueta?: string;
}

const fechaLarga = (v?: string | null) => {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
};

export function HojaFormula({ registro, formula }: Omit<Props, 'etiqueta'>) {
  const numero = String(formula.idFormula).padStart(5, '0');
  return (
    <div className="fi-hoja" aria-hidden="true">
      <header className="fi-cabecera">
        <div>
          <div className="fi-clinica">{CLINICA.nombre}</div>
          <div className="fi-contacto">{CLINICA.direccion} · Tel. {CLINICA.telefonoTexto}</div>
        </div>
        <div className="fi-numero">
          <strong>Fórmula médica</strong>
          <span>N.º {numero}</span>
          <span>{fechaLarga(formula.fecha ?? registro.fechaRegistro)}</span>
        </div>
      </header>

      <table className="fi-tabla fi-paciente">
        <tbody>
          <tr>
            <th>Paciente</th><td>{registro.nombre_mascota || '—'}</td>
            <th>Especie</th><td>{registro.especie || '—'}</td>
          </tr>
          <tr>
            <th>Raza</th><td>{registro.raza || '—'}</td>
            <th>Peso</th><td>{registro.peso_consulta != null ? `${registro.peso_consulta} kg` : '—'}</td>
          </tr>
          {registro.diagnostico && (
            <tr><th>Diagnóstico</th><td colSpan={3}>{registro.diagnostico}</td></tr>
          )}
        </tbody>
      </table>

      <h2 className="fi-subtitulo">Medicamentos</h2>
      <table className="fi-tabla fi-meds">
        <thead>
          <tr>
            <th>#</th><th>Medicamento</th><th>Dosis y vía</th><th>Frecuencia</th><th>Duración</th><th>Cant.</th>
          </tr>
        </thead>
        <tbody>
          {formula.medicamentos.map((m, i) => (
            <tr key={m.idFormulaMedicamento ?? i}>
              <td>{i + 1}</td>
              <td>
                <strong>{m.nombre_medicamento}</strong>
                {m.presentacion && <div className="fi-sub">{m.presentacion}</div>}
                {m.indicaciones && <div className="fi-sub">{m.indicaciones}</div>}
              </td>
              <td>{m.dosis}{m.via_administracion ? ` · vía ${m.via_administracion}` : ''}</td>
              <td>{m.frecuencia}</td>
              <td>{m.duracion_dias != null ? `${m.duracion_dias} día${m.duracion_dias === 1 ? '' : 's'}` : '—'}</td>
              <td>{m.cantidad ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {formula.recomendaciones && (
        <>
          <h2 className="fi-subtitulo">Recomendaciones</h2>
          <p className="fi-texto">{formula.recomendaciones}</p>
        </>
      )}

      {registro.cita_control && (
        <>
          <h2 className="fi-subtitulo">Cita de control</h2>
          <p className="fi-texto">{textoCitaControl(registro.cita_control)}</p>
        </>
      )}

      <div className="fi-firma">
        <div className="fi-linea" />
        <span>Firma y sello del médico veterinario</span>
      </div>
      <footer className="fi-pie">
        Documento generado por VitalPet. Válido únicamente con la firma del veterinario tratante.
        Siga las dosis indicadas y consulte ante cualquier reacción.
      </footer>
    </div>
  );
}

export default function FormulaImprimible({ registro, formula, etiqueta = 'Imprimir fórmula' }: Props) {
  // La hoja solo existe en el DOM mientras se imprime: así, si la pantalla
  // lista varias consultas, nunca se mezclan las fórmulas en una misma impresión.
  const [imprimiendo, setImprimiendo] = useState(false);

  useEffect(() => {
    if (!imprimiendo) return;
    const { body } = document;
    const terminar = () => setImprimiendo(false);
    body.classList.add('imprimiendo-formula');
    window.addEventListener('afterprint', terminar);
    const t = window.setTimeout(() => window.print(), 50); // deja que React pinte la hoja
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('afterprint', terminar);
      body.classList.remove('imprimiendo-formula');
    };
  }, [imprimiendo]);

  if (!formula?.medicamentos?.length) return null;
  return (
    <>
      <button type="button" className="fi-boton no-print" onClick={() => setImprimiendo(true)} disabled={imprimiendo}>
        <i className="ti ti-printer" /> {etiqueta}
      </button>
      {imprimiendo && createPortal(<HojaFormula registro={registro} formula={formula} />, document.body)}
    </>
  );
}
