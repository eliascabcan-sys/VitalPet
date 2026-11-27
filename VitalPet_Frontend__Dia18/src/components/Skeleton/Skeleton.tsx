// =================================================================
// Archivo: src/components/Skeleton/Skeleton.tsx
// RESPONSABILIDAD: Marcadores grises animados mientras carga una lista
// (reemplaza el texto "Cargando..."). Devuelve varios bloques sueltos
// para que encajen dentro del grid o la lista de la página.
//   variante="tarjeta"  -> dentro de .grid (Pacientes)
//   variante="fila"     -> dentro de listas verticales (Citas, Ventas...)
//   variante="linea"    -> una línea de texto
// =================================================================
import './Skeleton.css';

interface SkeletonProps {
  variante?: 'tarjeta' | 'fila' | 'linea';
  cantidad?: number;
}

export default function Skeleton({ variante = 'fila', cantidad = 3 }: SkeletonProps) {
  return (
    <>
      {Array.from({ length: cantidad }, (_, i) => (
        <div key={i} className={`skeleton skeleton-${variante}`} aria-hidden="true" />
      ))}
    </>
  );
}