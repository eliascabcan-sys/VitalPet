// =================================================================
// Archivo: src/components/FotoMascota/RecortadorFoto.tsx
// RESPONSABILIDAD: ventana para encuadrar la foto de la mascota.
//   - Arrastrar para mover, barra o rueda para zoom, botón para girar.
//   - Teclado: flechas mueven, + y - hacen zoom (el recuadro tiene foco).
//   - Lo que se ve en el recuadro es exactamente lo que se guarda (400x400 JPEG).
// Sin librerías externas: usa <canvas>.
// =================================================================
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { FORMA_FOTO_POR_DEFECTO } from './tipos';
import type { FormaFoto } from './tipos';
import './RecortadorFoto.css';

interface Props {
  archivo: File;
  forma?: FormaFoto;
  /** Lado del recuadro en pantalla (px). */
  tamano?: number;
  /** Lado de la imagen final (px). */
  salida?: number;
  guardando?: boolean;
  onCancelar: () => void;
  onGuardar: (dataUrl: string) => void;
}

interface Posicion {
  x: number; // desplazamiento como fracción del lado del recuadro
  y: number;
}

const ZOOM_MAX = 4;
const limitar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

// Cuánto se puede mover la imagen sin dejar bordes vacíos (fracción del recuadro).
function limites(img: HTMLImageElement, zoom: number, giro: number) {
  const girada = giro % 2 === 1;
  const w = girada ? img.naturalHeight : img.naturalWidth;
  const h = girada ? img.naturalWidth : img.naturalHeight;
  const k = Math.max(1 / w, 1 / h) * zoom; // escala / lado
  return { maxX: Math.max(0, (w * k - 1) / 2), maxY: Math.max(0, (h * k - 1) / 2), k };
}

function acotar(img: HTMLImageElement, zoom: number, giro: number, p: Posicion): Posicion {
  const { maxX, maxY } = limites(img, zoom, giro);
  return { x: limitar(p.x, -maxX, maxX), y: limitar(p.y, -maxY, maxY) };
}

function trazarRedondeado(ctx: CanvasRenderingContext2D, lado: number, radio: number) {
  ctx.moveTo(radio, 0);
  ctx.arcTo(lado, 0, lado, lado, radio);
  ctx.arcTo(lado, lado, 0, lado, radio);
  ctx.arcTo(0, lado, 0, 0, radio);
  ctx.arcTo(0, 0, lado, 0, radio);
  ctx.closePath();
}

function dibujar(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  lado: number,
  zoom: number,
  giro: number,
  pos: Posicion,
  forma: FormaFoto | null, // null = imagen final, sin guías
) {
  const { k } = limites(img, zoom, giro);
  const escala = lado * k;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, lado, lado);
  ctx.save();
  ctx.translate(lado / 2 + pos.x * lado, lado / 2 + pos.y * lado);
  ctx.rotate((giro * Math.PI) / 2);
  ctx.scale(escala, escala);
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
  ctx.restore();

  if (forma && forma !== 'cuadrado') {
    // Oscurece lo que quedará fuera de la forma elegida.
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.rect(0, 0, lado, lado);
    if (forma === 'circulo') ctx.arc(lado / 2, lado / 2, lado / 2 - 1, 0, Math.PI * 2);
    else trazarRedondeado(ctx, lado, lado * 0.22);
    ctx.fill('evenodd');
    ctx.restore();
  }
}

export default function RecortadorFoto({
  archivo,
  forma = FORMA_FOTO_POR_DEFECTO,
  tamano = 260,
  salida = 400,
  guardando = false,
  onCancelar,
  onGuardar,
}: Props) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [error, setError] = useState('');
  const [zoom, setZoom] = useState(1);
  const [giro, setGiro] = useState(0); // cuartos de vuelta
  const [pos, setPos] = useState<Posicion>({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const arrastre = useRef<{ x: number; y: number; px: number; py: number; lado: number } | null>(null);

  // Posición realmente usada (siempre dentro de los límites).
  const efectiva = img ? acotar(img, zoom, giro, pos) : pos;

  // Cargar el archivo elegido.
  // En desarrollo React ejecuta este efecto dos veces (StrictMode): la primera carga se
  // cancela y NO debe marcar error ni reemplazar a la segunda. Por eso la bandera "cancelado".
  useEffect(() => {
    let cancelado = false;
    const url = URL.createObjectURL(archivo);
    const imagen = new Image();
    imagen.onload = () => {
      if (!cancelado) setImg(imagen);
    };
    imagen.onerror = () => {
      if (!cancelado) setError('No se pudo leer esa imagen. Prueba con otra foto (JPG, PNG o WebP).');
    };
    imagen.src = url;
    return () => {
      cancelado = true;
      URL.revokeObjectURL(url);
    };
  }, [archivo]);

  // Redibujar la vista previa.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    dibujar(ctx, img, canvas.width, zoom, giro, acotar(img, zoom, giro, pos), forma);
  }, [img, zoom, giro, pos, forma]);

  // Zoom con la rueda del ratón (listener nativo para poder evitar el scroll de la página).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const alRodar = (e: WheelEvent) => {
      e.preventDefault();
      setZoom((z) => limitar(z - e.deltaY * 0.002, 1, ZOOM_MAX));
    };
    canvas.addEventListener('wheel', alRodar, { passive: false });
    return () => canvas.removeEventListener('wheel', alRodar);
  }, []);

  // Esc cierra (salvo mientras se guarda).
  useEffect(() => {
    const alTeclear = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && !guardando) onCancelar();
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [guardando, onCancelar]);

  function alPresionar(e: PointerEvent<HTMLCanvasElement>) {
    if (!img) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    arrastre.current = {
      x: e.clientX,
      y: e.clientY,
      px: efectiva.x,
      py: efectiva.y,
      lado: e.currentTarget.getBoundingClientRect().width,
    };
  }

  function alMover(e: PointerEvent<HTMLCanvasElement>) {
    const a = arrastre.current;
    if (!a || !img) return;
    setPos(acotar(img, zoom, giro, { x: a.px + (e.clientX - a.x) / a.lado, y: a.py + (e.clientY - a.y) / a.lado }));
  }

  function alSoltar() {
    arrastre.current = null;
  }

  function alTeclearRecuadro(e: KeyboardEvent<HTMLCanvasElement>) {
    if (!img) return;
    const paso = 0.03;
    const mover = (dx: number, dy: number) => {
      e.preventDefault();
      setPos(acotar(img, zoom, giro, { x: efectiva.x + dx, y: efectiva.y + dy }));
    };
    if (e.key === 'ArrowLeft') mover(-paso, 0);
    else if (e.key === 'ArrowRight') mover(paso, 0);
    else if (e.key === 'ArrowUp') mover(0, -paso);
    else if (e.key === 'ArrowDown') mover(0, paso);
    else if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      setZoom((z) => limitar(z + 0.1, 1, ZOOM_MAX));
    } else if (e.key === '-') {
      e.preventDefault();
      setZoom((z) => limitar(z - 0.1, 1, ZOOM_MAX));
    }
  }

  function restablecer() {
    setZoom(1);
    setGiro(0);
    setPos({ x: 0, y: 0 });
  }

  function guardar() {
    if (!img) return;
    const final = document.createElement('canvas');
    final.width = final.height = salida;
    const ctx = final.getContext('2d');
    if (!ctx) {
      setError('Tu navegador no pudo preparar la foto. Prueba con otro navegador.');
      return;
    }
    dibujar(ctx, img, salida, zoom, giro, efectiva, null);
    onGuardar(final.toDataURL('image/jpeg', 0.85));
  }

  const pequena = img !== null && Math.min(img.naturalWidth, img.naturalHeight) < 300;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  return (
    <div className="recortador-fondo">
      <div className="recortador" role="dialog" aria-modal="true" aria-labelledby="recortador-titulo">
        <h2 id="recortador-titulo" className="recortador-titulo">Ajusta la foto</h2>
        <p className="recortador-ayuda">Arrastra para centrar la cara y usa el zoom para acercar.</p>

        {error ? (
          <p className="recortador-error" role="alert">{error}</p>
        ) : (
          <canvas
            ref={canvasRef}
            className="recortador-lienzo"
            width={Math.round(tamano * dpr)}
            height={Math.round(tamano * dpr)}
            style={{ width: tamano, maxWidth: '100%', aspectRatio: '1 / 1' }}
            tabIndex={0}
            aria-label="Recuadro de la foto. Usa las flechas para mover y más o menos para el zoom."
            onPointerDown={alPresionar}
            onPointerMove={alMover}
            onPointerUp={alSoltar}
            onPointerCancel={alSoltar}
            onKeyDown={alTeclearRecuadro}
          />
        )}

        {!img && !error && <p className="recortador-ayuda">Cargando foto…</p>}

        {pequena && (
          <p className="recortador-aviso">Esta foto es pequeña y puede verse borrosa. Si puedes, elige una más grande.</p>
        )}

        <div className="recortador-controles">
          <label className="recortador-zoom">
            <span>Zoom</span>
            <input
              type="range"
              min={1}
              max={ZOOM_MAX}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              disabled={!img}
              aria-label="Zoom"
            />
          </label>
          <button type="button" className="recortador-btn recortador-btn-suave" onClick={() => setGiro((g) => (g + 1) % 4)} disabled={!img}>
            <i className="ti ti-rotate-clockwise-2" aria-hidden="true" /> Girar
          </button>
          <button type="button" className="recortador-btn recortador-btn-suave" onClick={restablecer} disabled={!img}>
            Restablecer
          </button>
        </div>

        <div className="recortador-acciones">
          <button type="button" className="recortador-btn recortador-btn-suave" onClick={onCancelar} disabled={guardando}>
            Cancelar
          </button>
          <button type="button" className="recortador-btn recortador-btn-primario" onClick={guardar} disabled={!img || guardando}>
            {guardando ? 'Guardando…' : 'Guardar foto'}
          </button>
        </div>
      </div>
    </div>
  );
}