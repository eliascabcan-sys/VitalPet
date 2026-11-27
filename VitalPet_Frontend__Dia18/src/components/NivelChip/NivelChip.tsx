// =================================================================
// Archivo: src/components/NivelChip/NivelChip.tsx
// RESPONSABILIDAD: Etiqueta de color para un nivel de triaje
// (rojo, naranja, amarillo, verde o azul).
// Uso: <NivelChip nivel="rojo" />  o  <NivelChip nivel="rojo" texto="Urgente" />
// =================================================================
import './NivelChip.css';

const ETIQUETAS: Record<string, string> = {
  rojo: 'Rojo',
  naranja: 'Naranja',
  amarillo: 'Amarillo',
  verde: 'Verde',
  azul: 'Azul',
};

interface NivelChipProps {
  nivel: string;   // código que viene del backend
  texto?: string;  // si no se pasa, se muestra el nombre del color
}

export default function NivelChip({ nivel, texto }: NivelChipProps) {
  const codigo = nivel.toLowerCase();
  const clase = codigo in ETIQUETAS ? codigo : 'desconocido';

  return (
    <span className={`nivel-chip nivel-chip-${clase}`}>
      {texto ?? ETIQUETAS[codigo] ?? nivel}
    </span>
  );
}