// =================================================================
// Archivo: src/constants/landing.ts
// RESPONSABILIDAD: Datos de la landing pública en un solo lugar.
// Para agregar una veterinaria nueva basta con añadir un objeto al
// arreglo VETERINARIAS_DISPONIBLES.
// =================================================================

export interface VeterinariaLanding {
  id: string;
  nombre: string;
  direccion: string;
  instagram?: string;
}

export const VETERINARIAS_DISPONIBLES: VeterinariaLanding[] = [
  {
    id: 'loquivet',
    nombre: 'Loquivet',
    direccion: 'Cra. 90 #69A-10 — Bogotá, Colombia',
    // TODO: confirmar la URL real del Instagram de Loquivet.
    instagram: 'https://www.instagram.com/loquivet',
  },
];

// TODO: reemplazar por el número real (formato internacional, sin "+" ni espacios).
export const WHATSAPP = {
  numero: '573000000000',
  mensaje: 'Hola, quiero más información sobre VitalPet.',
} as const;
