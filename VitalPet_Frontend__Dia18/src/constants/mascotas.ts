// Catálogos de mascota compartidos por formularios, tarjetas y listados.
export const ESPECIES = ['Canino', 'Felino', 'Roedor', 'Aves', 'No convencional'] as const;
export type Especie = (typeof ESPECIES)[number];

export const SEXOS = [
  { valor: 'macho', etiqueta: 'Macho' },
  { valor: 'hembra', etiqueta: 'Hembra' },
] as const;

// Acepta tanto las especies nuevas como los valores antiguos ya guardados.
const EMOJIS: Record<string, string> = {
  canino: '🐶', perro: '🐶',
  felino: '🐱', gato: '🐱',
  roedor: '🐹', conejo: '🐹', hamster: '🐹',
  aves: '🐦', pajaro: '🐦',
  'no convencional': '🦎', reptil: '🦎',
};

export function emojiEspecie(especie?: string): string {
  return EMOJIS[(especie || '').toLowerCase()] || '🐾';
}
