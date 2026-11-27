// =================================================================
// Archivo: src/components/FotoMascota/FotoMascota.tsx
// RESPONSABILIDAD: muestra la foto de la mascota (o el emoji de su especie si
// no tiene) y, si `editable`, deja subir/cambiar/quitar la foto.
//
// Uso:
//   <FotoMascota mascota={m} tamano="md" />                      // solo mostrar
//   <FotoMascota mascota={m} tamano="xl" editable onCambio={recargar} />
//
// `forma` es configurable por lugar ('circulo' por defecto, 'redondeado', 'cuadrado').
// =================================================================
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ChangeEvent, MouseEvent } from 'react';
import { emojiEspecie } from '../../constants/mascotas';
import { quitarFoto, subirFoto, urlFoto } from '../../services/fotoMascotaService';
import { useToast } from '../Toast/ToastContext';
import RecortadorFoto from './RecortadorFoto';
import { FORMA_FOTO_POR_DEFECTO } from './tipos';
import type { FormaFoto } from './tipos';
import './FotoMascota.css';

type Tamano = 'sm' | 'md' | 'lg' | 'xl' | number;
const PX: Record<'sm' | 'md' | 'lg' | 'xl', number> = { sm: 40, md: 64, lg: 96, xl: 140 };
const MAX_ARCHIVO_MB = 15; // foto original del celular; luego se reduce a ~50 KB

interface MascotaFoto {
  idMascota?: number;
  nombre_mascota?: string;
  especie?: string;
  foto_url?: string | null;
}

interface Props {
  mascota: MascotaFoto;
  tamano?: Tamano;
  forma?: FormaFoto;
  editable?: boolean;
  /** Se llama tras subir o quitar la foto (recibe la nueva ruta o null). */
  onCambio?: (foto_url: string | null) => void;
}

export default function FotoMascota({
  mascota,
  tamano = 'md',
  forma = FORMA_FOTO_POR_DEFECTO,
  editable = false,
  onCambio,
}: Props) {
  const { mostrarToast, confirmar } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [guardando, setGuardando] = useState(false);
  // Foto recién subida; solo vale mientras el padre no traiga una foto distinta.
  const [cambio, setCambio] = useState<{ base: string | null | undefined; src: string | null } | null>(null);
  const [falloSrc, setFalloSrc] = useState<string | null>(null);

  const px = typeof tamano === 'number' ? tamano : PX[tamano];
  const nombre = mascota.nombre_mascota || 'la mascota';
  const vigente = cambio && cambio.base === mascota.foto_url ? cambio.src : undefined;
  const src = vigente !== undefined ? vigente : urlFoto(mascota);
  const mostrarImagen = src !== null && src !== falloSrc;

  function alElegirArchivo(e: ChangeEvent<HTMLInputElement>) {
    const elegido = e.target.files?.[0];
    e.target.value = ''; // permite volver a elegir el mismo archivo
    if (!elegido) return;
    if (!elegido.type.startsWith('image/')) {
      mostrarToast('Elige un archivo de imagen (JPG, PNG o WebP).', 'error');
      return;
    }
    if (elegido.size > MAX_ARCHIVO_MB * 1024 * 1024) {
      mostrarToast(`La foto pesa más de ${MAX_ARCHIVO_MB} MB. Elige una más liviana.`, 'error');
      return;
    }
    setArchivo(elegido);
  }

  // Si la foto está dentro de una tarjeta-enlace (<Link>), un clic aquí (cámara, ventana
  // de recorte, etc.) NO debe abrir ese enlace. Los botones/inputs conservan su
  // comportamiento normal (por eso el selector de archivos sigue abriéndose).
  function evitarEnlace(e: MouseEvent<HTMLDivElement>) {
    e.stopPropagation();
    const objetivo = e.target as HTMLElement;
    if (!objetivo.closest('button, input, label, select, textarea, a')) e.preventDefault();
  }

  async function guardar(dataUrl: string) {
    if (mascota.idMascota == null) return;
    setGuardando(true);
    try {
      const res = await subirFoto(mascota.idMascota, dataUrl);
      setCambio({ base: mascota.foto_url, src: urlFoto({ idMascota: mascota.idMascota, foto_url: res.foto_url }) });
      setFalloSrc(null);
      setArchivo(null);
      mostrarToast('Foto actualizada.', 'ok');
      onCambio?.(res.foto_url);
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : 'No se pudo guardar la foto.', 'error');
    } finally {
      setGuardando(false);
    }
  }

  async function quitar() {
    if (mascota.idMascota == null) return;
    const ok = await confirmar(`¿Quitar la foto de ${nombre}?`, { textoOk: 'Quitar', peligro: true });
    if (!ok) return;
    try {
      const res = await quitarFoto(mascota.idMascota);
      setCambio({ base: mascota.foto_url, src: null });
      mostrarToast('Foto eliminada.', 'ok');
      onCambio?.(res.foto_url);
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : 'No se pudo quitar la foto.', 'error');
    }
  }

  return (
    <div className="foto-mascota-envoltorio" onClick={editable ? evitarEnlace : undefined}>
      <div className={`foto-mascota foto-${forma}`} style={{ width: px, height: px, fontSize: Math.round(px * 0.5) }}>
        {mostrarImagen ? (
          <img
            src={src}
            alt={`Foto de ${nombre}`}
            className="foto-mascota-img"
            loading="lazy"
            onError={() => setFalloSrc(src)}
          />
        ) : (
          <span className="foto-mascota-emoji" role="img" aria-label={`Sin foto de ${nombre}`}>
            {emojiEspecie(mascota.especie)}
          </span>
        )}

        {editable && (
          <button
            type="button"
            className="foto-mascota-editar"
            onClick={() => inputRef.current?.click()}
            aria-label={mostrarImagen ? `Cambiar la foto de ${nombre}` : `Agregar una foto de ${nombre}`}
            title={mostrarImagen ? 'Cambiar foto' : 'Agregar foto'}
          >
            <span className="foto-mascota-camara" aria-hidden="true">
              <i className="ti ti-camera" />
            </span>
          </button>
        )}
      </div>

      {editable && mostrarImagen && (
        <button type="button" className="foto-mascota-quitar" onClick={quitar}>
          Quitar foto
        </button>
      )}

      {editable && (
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="foto-mascota-input"
          onChange={alElegirArchivo}
          tabIndex={-1}
          aria-hidden="true"
        />
      )}

      {archivo &&
        createPortal(
          <RecortadorFoto
            archivo={archivo}
            forma={forma}
            guardando={guardando}
            onCancelar={() => setArchivo(null)}
            onGuardar={guardar}
          />,
          document.body,
        )}
    </div>
  );
}
