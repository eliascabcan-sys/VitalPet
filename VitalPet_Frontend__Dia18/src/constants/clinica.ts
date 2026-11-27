// =================================================================
// Archivo: src/constants/clinica.ts
// RESPONSABILIDAD: Datos de contacto de la clínica en un solo lugar
// (los usa el botón "Es una emergencia" del reporte diario).
// Si el teléfono cambia, se cambia aquí.
// =================================================================
export const CLINICA = {
  nombre: 'Clínica Veterinaria VitalPet',
  direccion: 'Cra. 15 #45-20 — Bogotá, Colombia',
  telefonoTexto: '(601) 234-5678',
  // Formato internacional para que el celular marque con un toque.
  telefonoLink: 'tel:+576012345678',
} as const;
