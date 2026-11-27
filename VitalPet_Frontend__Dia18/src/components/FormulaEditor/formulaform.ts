// =================================================================
// Archivo: src/components/FormulaEditor/formulaForm.ts
// RESPONSABILIDAD: Tipos y funciones del formulario de la fórmula
// (registro del backend <-> formulario <-> payload). Sin React.
// =================================================================
import type { FormulaPayload, MedicamentoFormula, RegistroHistorial } from '../../services/historialService';
import type { ProductoStock } from '../../services/formulaStockService';

export interface MedicamentoForm {
  clave: string;                 // id local para React (no se envía)
  idProducto: number | null;     // enlace con el inventario (opcional)
  producto: ProductoStock | null; // datos de stock mostrados al veterinario (no se envía)
  nombre_medicamento: string;
  presentacion: string;
  dosis: string;
  via_administracion: string;
  frecuencia: string;
  duracion_dias: string;
  cantidad: string;
  indicaciones: string;
}

export interface FormulaForm {
  recomendaciones: string;
  medicamentos: MedicamentoForm[];
}

let secuencia = 0;

export function medicamentoVacio(): MedicamentoForm {
  secuencia += 1;
  return {
    clave: `med-${secuencia}`, idProducto: null, producto: null,
    nombre_medicamento: '', presentacion: '', dosis: '', via_administracion: '',
    frecuencia: '', duracion_dias: '', cantidad: '', indicaciones: '',
  };
}

export function formulaVacia(): FormulaForm {
  return { recomendaciones: '', medicamentos: [medicamentoVacio()] };
}

const aTexto = (v: unknown) => (v === null || v === undefined ? '' : String(v));

// Registro del backend -> formulario (para editar).
export function formulaDesdeRegistro(r: RegistroHistorial): FormulaForm {
  const f = r.formulas?.[0];
  if (!f?.medicamentos?.length) return formulaVacia();
  return {
    recomendaciones: aTexto(f.recomendaciones),
    medicamentos: f.medicamentos.map((m) => ({
      ...medicamentoVacio(),
      idProducto: m.idProducto ?? null,
      nombre_medicamento: aTexto(m.nombre_medicamento),
      presentacion: aTexto(m.presentacion),
      dosis: aTexto(m.dosis),
      via_administracion: aTexto(m.via_administracion),
      frecuencia: aTexto(m.frecuencia),
      duracion_dias: aTexto(m.duracion_dias),
      cantidad: aTexto(m.cantidad),
      indicaciones: aTexto(m.indicaciones),
    })),
  };
}

// Una fila "cuenta" si el veterinario escribió algo en ella; las vacías se ignoran.
export function filaConContenido(m: MedicamentoForm): boolean {
  return [m.nombre_medicamento, m.presentacion, m.dosis, m.via_administracion, m.frecuencia,
    m.duracion_dias, m.cantidad, m.indicaciones].some((v) => v.trim() !== '');
}

const entero = (v: string): number | null => {
  const n = Number(v.trim());
  return v.trim() !== '' && Number.isInteger(n) ? n : null;
};

// Devuelve un mensaje de error o null si todo está bien.
export function validarFormula(f: FormulaForm): string | null {
  const filas = f.medicamentos.filter(filaConContenido);
  if (!filas.length) {
    return f.recomendaciones.trim()
      ? 'Agrega al menos un medicamento a la fórmula o borra las recomendaciones.'
      : null;
  }
  for (const [i, m] of filas.entries()) {
    const n = `Medicamento ${i + 1}`;
    if (!m.nombre_medicamento.trim()) return `${n}: escribe el nombre del medicamento.`;
    if (!m.dosis.trim()) return `${n}: la dosis es obligatoria.`;
    if (!m.frecuencia.trim()) return `${n}: la frecuencia es obligatoria.`;
    const dias = entero(m.duracion_dias);
    if (dias === null || dias < 1 || dias > 365) return `${n}: la duración debe ser de 1 a 365 días.`;
    if (m.cantidad.trim() && (entero(m.cantidad) === null || (entero(m.cantidad) as number) < 1)) {
      return `${n}: la cantidad debe ser un número entero mayor a 0.`;
    }
  }
  return null;
}

const txt = (v: string) => v.trim() || null;

// Formulario -> lo que espera el backend. null = no enviar fórmula.
export function formulaAPayload(f: FormulaForm): FormulaPayload | null {
  const filas = f.medicamentos.filter(filaConContenido);
  if (!filas.length) return null;
  const medicamentos: MedicamentoFormula[] = filas.map((m) => ({
    idProducto: m.idProducto,
    nombre_medicamento: m.nombre_medicamento.trim(),
    presentacion: txt(m.presentacion),
    dosis: m.dosis.trim(),
    via_administracion: txt(m.via_administracion),
    frecuencia: m.frecuencia.trim(),
    duracion_dias: entero(m.duracion_dias),
    cantidad: entero(m.cantidad),
    indicaciones: txt(m.indicaciones),
  }));
  return { recomendaciones: txt(f.recomendaciones), medicamentos };
}