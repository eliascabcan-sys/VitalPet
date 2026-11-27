// =================================================================
// Archivo: src/components/ResultadoLabImprimible/ResultadoLabImprimible.tsx
// RESPONSABILIDAD: Botón "Descargar PDF" del resultado de un examen de
// laboratorio. El PDF se arma aquí mismo, en el navegador (no usa backend
// ni librerías externas) y se guarda como laboratorio-<id>.pdf.
// =================================================================
import { useState } from 'react';
import { CLINICA } from '../../constants/clinica';
import { CATEGORIAS_EXAMEN } from '../../services/laboratorioService';
import type { ExamenLaboratorio } from '../../services/laboratorioService';
import { useToast } from '../Toast/ToastContext';
import '../FormulaImprimible/FormulaImprimible.css'; // botón .fi-boton

// ---------------------------------------------------------------
// Mini generador de PDF (A4, texto Helvetica, líneas y rectángulos)
// ---------------------------------------------------------------
type Color = [number, number, number];
const NEGRO: Color = [0, 0, 0];
const AZUL: Color = [0.102, 0.435, 0.659];
const GRIS: Color = [0.333, 0.376, 0.42];
const BORDE: Color = [0.722, 0.761, 0.8];
const FONDO: Color = [0.945, 0.961, 0.973];
const FONDO_CAB: Color = [0.902, 0.933, 0.957];

const PAG = { w: 595.28, h: 841.89 };
const MARGEN = 56.7; // 2 cm
const UTIL = PAG.w - MARGEN * 2;

// Caracteres fuera de Latin-1 que sí existen en la codificación del PDF (WinAnsi).
const WIN: Record<string, number> = {
  '—': 0x97, '–': 0x96, '’': 0x92, '‘': 0x91, '“': 0x93, '”': 0x94, '•': 0x95, '…': 0x85, '€': 0x80,
};

/** Texto -> cadena ASCII segura para un string de PDF (tildes y ñ como código octal). */
function codificar(texto: string): string {
  let out = '';
  for (const ch of texto.replace(/[\r\n\t]+/g, ' ')) {
    const cp = ch.codePointAt(0)!;
    const b = WIN[ch] ?? (cp < 256 ? cp : 63); // lo que no existe sale como "?"
    if (b === 40 || b === 41 || b === 92) out += '\\' + String.fromCharCode(b);
    else if (b < 32 || b > 126) out += '\\' + b.toString(8).padStart(3, '0');
    else out += String.fromCharCode(b);
  }
  return out;
}

let ctxMedir: CanvasRenderingContext2D | null = null;
/** Ancho real del texto en puntos (Arial y Helvetica miden igual). */
function medir(texto: string, size: number, negrita: boolean): number {
  if (typeof document !== 'undefined') {
    ctxMedir ??= document.createElement('canvas').getContext('2d');
    if (ctxMedir) {
      ctxMedir.font = `${negrita ? 'bold ' : ''}${size}px Helvetica, Arial, sans-serif`;
      return ctxMedir.measureText(texto).width;
    }
  }
  return texto.length * size * 0.5;
}

/** Parte un texto en líneas que quepan en `maxW` (respeta los saltos de línea). */
function partir(texto: string, size: number, negrita: boolean, maxW: number): string[] {
  const lineas: string[] = [];
  for (const parrafo of String(texto ?? '').split(/\r?\n/)) {
    let actual = '';
    for (let palabra of parrafo.split(/\s+/).filter(Boolean)) {
      // Palabra más ancha que la línea: se corta por letras.
      while (medir(palabra, size, negrita) > maxW && palabra.length > 1) {
        let n = palabra.length - 1;
        while (n > 1 && medir(palabra.slice(0, n), size, negrita) > maxW) n--;
        if (actual) { lineas.push(actual); actual = ''; }
        lineas.push(palabra.slice(0, n));
        palabra = palabra.slice(n);
      }
      const prueba = actual ? `${actual} ${palabra}` : palabra;
      if (!actual || medir(prueba, size, negrita) <= maxW) actual = prueba;
      else { lineas.push(actual); actual = palabra; }
    }
    lineas.push(actual);
  }
  return lineas;
}

const num = (n: number) => n.toFixed(2);
const rgb = (c: Color) => c.map((v) => v.toFixed(3)).join(' ');

interface Celda { t: string; negrita?: boolean; fondo?: Color; span?: number }

class Documento {
  paginas: string[][] = [[]];
  y = PAG.h - MARGEN; // cursor vertical (se baja al escribir)

  private get ops() { return this.paginas[this.paginas.length - 1]; }
  nueva() { this.paginas.push([]); this.y = PAG.h - MARGEN; }
  asegurar(alto: number) { if (this.y - alto < MARGEN) this.nueva(); }

  texto(t: string, x: number, y: number, size: number, negrita = false, color: Color = NEGRO, alinear: 'i' | 'd' | 'c' = 'i') {
    const w = medir(t, size, negrita);
    const xx = alinear === 'd' ? x - w : alinear === 'c' ? x - w / 2 : x;
    this.ops.push(`BT /${negrita ? 'F2' : 'F1'} ${size} Tf ${rgb(color)} rg ${num(xx)} ${num(y)} Td (${codificar(t)}) Tj ET`);
  }
  linea(x1: number, y1: number, x2: number, y2: number, grosor: number, color: Color) {
    this.ops.push(`${grosor} w ${rgb(color)} RG ${num(x1)} ${num(y1)} m ${num(x2)} ${num(y2)} l S`);
  }
  rect(x: number, y: number, w: number, h: number, fondo?: Color) {
    if (fondo) this.ops.push(`${rgb(fondo)} rg ${num(x)} ${num(y)} ${num(w)} ${num(h)} re f`);
    this.ops.push(`0.5 w ${rgb(BORDE)} RG ${num(x)} ${num(y)} ${num(w)} ${num(h)} re S`);
  }

  altoFila(celdas: Celda[], anchos: number[]): number {
    let col = 0, alto = 22;
    for (const c of celdas) {
      const span = c.span ?? 1;
      const w = anchos.slice(col, col + span).reduce((a, b) => a + b, 0);
      alto = Math.max(alto, partir(c.t, 9.5, !!c.negrita, w - 12).length * 13 + 10);
      col += span;
    }
    return alto;
  }

  fila(celdas: Celda[], anchos: number[]) {
    const alto = this.altoFila(celdas, anchos);
    this.asegurar(alto);
    let x = MARGEN, col = 0;
    for (const c of celdas) {
      const span = c.span ?? 1;
      const w = anchos.slice(col, col + span).reduce((a, b) => a + b, 0);
      this.rect(x, this.y - alto, w, alto, c.fondo);
      partir(c.t, 9.5, !!c.negrita, w - 12).forEach((l, i) =>
        this.texto(l, x + 6, this.y - 15 - i * 13, 9.5, !!c.negrita));
      x += w; col += span;
    }
    this.y -= alto;
  }

  subtitulo(t: string) {
    this.asegurar(40);
    this.y -= 22;
    this.texto(t, MARGEN, this.y, 11, true, AZUL);
    this.y -= 6;
  }

  parrafo(t: string, size = 10, color: Color = NEGRO) {
    for (const l of partir(t, size, false, UTIL)) {
      this.asegurar(size + 5);
      this.y -= size + 4;
      this.texto(l, MARGEN, this.y, size, false, color);
    }
  }
}

/** Arma el archivo PDF (texto) a partir de las páginas dibujadas. */
function construirPdf(paginas: string[][], titulo: string): Blob {
  const objs: string[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${paginas.map((_, i) => `${6 + i * 2} 0 R`).join(' ')}] /Count ${paginas.length} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    `<< /Title (${codificar(titulo)}) /Producer (VitalPet) >>`,
  ];
  paginas.forEach((ops, i) => {
    const contenido = ops.join('\n');
    objs.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAG.w} ${PAG.h}] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${7 + i * 2} 0 R >>`,
    );
    objs.push(`<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream`);
  });

  let pdf = '%PDF-1.4\n';
  const posiciones: number[] = [];
  objs.forEach((o, i) => { posiciones.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  pdf += posiciones.map((p) => `${String(p).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([pdf], { type: 'application/pdf' }); // todo es ASCII
}

const fechaLarga = (v?: string | null) => {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
};

export function generarPdfExamen(e: ExamenLaboratorio): Blob {
  const d = new Documento();
  const categoria = CATEGORIAS_EXAMEN.find((c) => c.valor === e.categoria)?.etiqueta ?? e.categoria;
  const xDer = PAG.w - MARGEN;

  // Encabezado
  d.texto(CLINICA.nombre, MARGEN, d.y - 14, 16, true, AZUL);
  d.texto(`N.º ${String(e.idExamen).padStart(5, '0')}`, xDer, d.y - 12, 10, true, NEGRO, 'd');
  d.texto(`${CLINICA.direccion} · Tel. ${CLINICA.telefonoTexto}`, MARGEN, d.y - 28, 9, false, GRIS);
  d.texto(fechaLarga(e.fecha_resultado ?? e.fecha_solicitud), xDer, d.y - 28, 9, false, GRIS, 'd');
  d.y -= 40;
  d.linea(MARGEN, d.y, xDer, d.y, 1.5, AZUL);

  // Título
  d.y -= 34;
  d.texto('RESULTADO DE LABORATORIO', PAG.w / 2, d.y, 17, true, NEGRO, 'c');
  d.y -= 20;

  // Paciente y examen
  const A = [UTIL * 0.17, UTIL * 0.33, UTIL * 0.17, UTIL * 0.33];
  d.fila([{ t: 'Paciente', negrita: true, fondo: FONDO }, { t: e.nombre_mascota || '—' },
          { t: 'Categoría', negrita: true, fondo: FONDO }, { t: categoria }], A);
  d.fila([{ t: 'Examen', negrita: true, fondo: FONDO }, { t: e.tipo_examen, span: 3 }], A);
  d.fila([{ t: 'Solicitado', negrita: true, fondo: FONDO }, { t: fechaLarga(e.fecha_solicitud) },
          { t: 'Resultado', negrita: true, fondo: FONDO }, { t: fechaLarga(e.fecha_resultado) }], A);

  // Valores medidos
  if (e.valores?.length) {
    d.subtitulo('Valores medidos');
    const V = [UTIL * 0.34, UTIL * 0.2, UTIL * 0.2, UTIL * 0.26];
    const cab: Celda[] = ['Parámetro', 'Valor', 'Unidad', 'Referencia'].map((t) => ({ t, negrita: true, fondo: FONDO_CAB }));
    d.fila(cab, V);
    for (const v of e.valores) {
      const celdas: Celda[] = [{ t: v.parametro }, { t: v.valor }, { t: v.unidad || '—' }, { t: v.referencia || '—' }];
      if (d.y - d.altoFila(celdas, V) < MARGEN) { d.nueva(); d.fila(cab, V); } // repite el encabezado
      d.fila(celdas, V);
    }
  }

  if (e.resultado) { d.subtitulo('Resultado / interpretación'); d.parrafo(e.resultado); }
  if (e.observaciones) { d.subtitulo('Observaciones'); d.parrafo(e.observaciones); }

  // Firma y pie
  d.asegurar(120);
  d.y -= 56;
  d.linea(MARGEN, d.y, MARGEN + UTIL * 0.5, d.y, 0.8, NEGRO);
  d.texto('Firma y sello del médico veterinario', MARGEN + UTIL * 0.25, d.y - 12, 8.5, false, GRIS, 'c');
  d.y -= 20;
  d.parrafo('Documento generado por VitalPet. Válido únicamente con la firma del veterinario tratante.', 8.5, GRIS);

  return construirPdf(d.paginas, `Resultado de laboratorio ${e.idExamen}`);
}

// ---------------------------------------------------------------
// Botón
// ---------------------------------------------------------------
export default function ResultadoLabImprimible({ examen }: { examen: ExamenLaboratorio }) {
  const { mostrarToast } = useToast();
  const [cargando, setCargando] = useState(false);

  function descargar() {
    setCargando(true);
    try {
      const url = URL.createObjectURL(generarPdfExamen(examen));
      const a = document.createElement('a');
      a.href = url;
      a.download = `laboratorio-${examen.idExamen}.pdf`;
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