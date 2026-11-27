// =================================================================
// Archivo: src/components/HistoriaForm/HistoriaForm.tsx
// RESPONSABILIDAD: Campos del formulario de historia clínica
// (anamnesis, examen clínico, diagnóstico, tratamiento,
// procedimientos, inyectología, observaciones) + funciones para
// convertir el formulario a lo que espera el backend.
// =================================================================
import type {
  EditarHistorialPayload,
  RegistroHistorial,
  SeccionHistorial,
} from '../../services/historialService';

export interface FormHistoria {
  idMascota: string;
  motivo_consulta: string;
  anamnesis: string;
  peso_consulta: string;
  temperatura: string;
  frecuencia_cardiaca: string;
  frecuencia_respiratoria: string;
  mucosas: string;
  tllc_seg: string;
  hidratacion: string;
  condicion_corporal: string;
  examen_fisico: string;
  diagnostico: string;
  tratamiento: string;
  procedimientos: string;
  inyectologia: string;
  observaciones: string;
}

export const FORM_VACIO: FormHistoria = {
  idMascota: '',
  motivo_consulta: '',
  anamnesis: '',
  peso_consulta: '',
  temperatura: '',
  frecuencia_cardiaca: '',
  frecuencia_respiratoria: '',
  mucosas: '',
  tllc_seg: '',
  hidratacion: '',
  condicion_corporal: '',
  examen_fisico: '',
  diagnostico: '',
  tratamiento: '',
  procedimientos: '',
  inyectologia: '',
  observaciones: '',
};

const MUCOSAS = ['Rosadas', 'Pálidas', 'Cianóticas', 'Ictéricas', 'Hiperémicas'];
const HIDRATACION = ['Normal', 'Leve (5%)', 'Moderada (8%)', 'Severa (10% o más)'];

const txt = (v: string) => v.trim() || null;
const num = (v: string) => {
  if (!v.trim()) return null;
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const aTexto = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const seccion = (r: RegistroHistorial, tipo: string) =>
  r.secciones?.find((s) => s.tipo === tipo)?.contenido ?? '';

// Registro del backend -> formulario (para editar).
export function desdeRegistro(r: RegistroHistorial): FormHistoria {
  return {
    idMascota: String(r.idMascota),
    motivo_consulta: aTexto(r.motivo_consulta),
    anamnesis: seccion(r, 'anamnesis'),
    peso_consulta: aTexto(r.peso_consulta),
    temperatura: aTexto(r.temperatura),
    frecuencia_cardiaca: aTexto(r.frecuencia_cardiaca),
    frecuencia_respiratoria: aTexto(r.frecuencia_respiratoria),
    mucosas: aTexto(r.mucosas),
    tllc_seg: aTexto(r.tllc_seg),
    hidratacion: aTexto(r.hidratacion),
    condicion_corporal: aTexto(r.condicion_corporal),
    examen_fisico: seccion(r, 'examen_fisico'),
    diagnostico: aTexto(r.diagnostico),
    tratamiento: aTexto(r.tratamiento),
    procedimientos: seccion(r, 'procedimientos'),
    inyectologia: seccion(r, 'inyectologia'),
    observaciones: aTexto(r.observaciones),
  };
}

// Formulario -> columnas de historial_clinico.
export function aPayload(f: FormHistoria): EditarHistorialPayload {
  return {
    motivo_consulta: txt(f.motivo_consulta),
    diagnostico: txt(f.diagnostico),
    tratamiento: txt(f.tratamiento),
    observaciones: txt(f.observaciones),
    peso_consulta: num(f.peso_consulta),
    temperatura: num(f.temperatura),
    frecuencia_cardiaca: num(f.frecuencia_cardiaca),
    frecuencia_respiratoria: num(f.frecuencia_respiratoria),
    mucosas: txt(f.mucosas),
    tllc_seg: num(f.tllc_seg),
    hidratacion: txt(f.hidratacion),
    condicion_corporal: num(f.condicion_corporal),
    secciones: aSecciones(f),
  };
}

// Formulario -> secciones de texto (tabla historial_secciones).
export function aSecciones(f: FormHistoria): SeccionHistorial[] {
  return [
    { tipo: 'anamnesis', contenido: f.anamnesis },
    { tipo: 'examen_fisico', contenido: f.examen_fisico },
    { tipo: 'procedimientos', contenido: f.procedimientos },
    { tipo: 'inyectologia', contenido: f.inyectologia },
  ];
}

// Devuelve un mensaje de error o null si todo está bien.
export function validar(f: FormHistoria): string | null {
  if (!f.peso_consulta.trim()) return 'Registra el peso de la mascota (kg) en cada control.';
  const positivos: [string, string][] = [
    [f.peso_consulta, 'El peso'],
    [f.temperatura, 'La temperatura'],
    [f.frecuencia_cardiaca, 'La frecuencia cardiaca'],
    [f.frecuencia_respiratoria, 'La frecuencia respiratoria'],
  ];
  for (const [valor, nombre] of positivos) {
    if (valor.trim() && (num(valor) === null || (num(valor) as number) <= 0)) {
      return `${nombre} debe ser un número mayor a 0.`;
    }
  }
  const cc = num(f.condicion_corporal);
  if (f.condicion_corporal.trim() && (cc === null || cc < 1 || cc > 9)) {
    return 'La condición corporal va de 1 a 9.';
  }
  return null;
}

interface Props {
  form: FormHistoria;
  onChange: (campo: keyof FormHistoria, valor: string) => void;
  // true cuando la mascota es nueva: solo anamnesis y examen, sin diagnóstico.
  diagnosticoBloqueado?: boolean;
}

export default function HistoriaForm({ form, onChange, diagnosticoBloqueado = false }: Props) {
  const campo = (c: keyof FormHistoria) => ({
    value: form[c],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      onChange(c, e.target.value),
  });

  return (
    <>
      {diagnosticoBloqueado && (
        <div className="hf-aviso" role="note">
          <i className="ti ti-info-circle" /> <strong>Mascota nueva.</strong> En la primera consulta solo se registra la
          anamnesis y el examen clínico. El diagnóstico se habilita desde el siguiente control.
        </div>
      )}

      <div className="campo">
        <label>Motivo de consulta</label>
        <input type="text" maxLength={255} {...campo('motivo_consulta')} />
      </div>

      <div className="campo">
        <label>Anamnesis</label>
        <textarea rows={3} placeholder="Lo que cuenta el dueño: síntomas, desde cuándo, alimentación, vacunas..." {...campo('anamnesis')} />
      </div>

      <div className="hf-titulo">Examen clínico</div>
      <div className="campo-2">
        <div className="campo">
          <label>Peso (kg) *</label>
          <input type="number" step="0.01" min="0" {...campo('peso_consulta')} />
        </div>
        <div className="campo">
          <label>Temperatura (°C)</label>
          <input type="number" step="0.1" min="0" {...campo('temperatura')} />
        </div>
      </div>
      <div className="campo-2">
        <div className="campo">
          <label>Frec. cardiaca (lpm)</label>
          <input type="number" min="0" {...campo('frecuencia_cardiaca')} />
        </div>
        <div className="campo">
          <label>Frec. respiratoria (rpm)</label>
          <input type="number" min="0" {...campo('frecuencia_respiratoria')} />
        </div>
      </div>
      <div className="campo-2">
        <div className="campo">
          <label>Mucosas</label>
          <select {...campo('mucosas')}>
            <option value="">Seleccionar...</option>
            {MUCOSAS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="campo">
          <label>TLLC (segundos)</label>
          <input type="number" step="0.1" min="0" {...campo('tllc_seg')} />
        </div>
      </div>
      <div className="campo-2">
        <div className="campo">
          <label>Hidratación</label>
          <select {...campo('hidratacion')}>
            <option value="">Seleccionar...</option>
            {HIDRATACION.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
        </div>
        <div className="campo">
          <label>Condición corporal (1-9)</label>
          <input type="number" min="1" max="9" {...campo('condicion_corporal')} />
        </div>
      </div>
      <div className="campo">
        <label>Hallazgos del examen físico</label>
        <textarea rows={3} {...campo('examen_fisico')} />
      </div>

      <div className="hf-titulo">Diagnóstico y manejo</div>
      <div className="campo">
        <label>Diagnóstico</label>
        <input
          type="text"
          {...campo('diagnostico')}
          disabled={diagnosticoBloqueado}
          placeholder={diagnosticoBloqueado ? 'Se habilita en el siguiente control' : undefined}
        />
      </div>
      <div className="campo">
        <label>Tratamiento</label>
        <input type="text" {...campo('tratamiento')} />
      </div>
      <div className="campo">
        <label>Procedimientos</label>
        <textarea rows={2} placeholder="Curaciones, suturas, limpieza dental, etc." {...campo('procedimientos')} />
      </div>
      <div className="campo">
        <label>Inyectología</label>
        <textarea rows={2} placeholder="Medicamento, dosis, vía y hora de aplicación." {...campo('inyectologia')} />
      </div>
      <div className="campo">
        <label>Observaciones</label>
        <textarea rows={3} {...campo('observaciones')} />
      </div>
    </>
  );
}