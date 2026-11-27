// =================================================================
// Archivo: src/hooks/useNivelesTriaje.ts
// RESPONSABILIDAD: Carga los niveles de triaje del backend una sola
// vez y devuelve { niveles, cargando, error } para las páginas.
// =================================================================
import { useEffect, useState } from 'react';
import { triajeService } from '../services/triajeService';
import type { InfoNivelTriaje } from '../services/triajeService';

export function useNivelesTriaje() {
  const [niveles, setNiveles] = useState<InfoNivelTriaje[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    triajeService
      .niveles()
      .then(setNiveles)
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'No se pudo cargar la información de triaje.')
      )
      .finally(() => setCargando(false));
  }, []);

  return { niveles, cargando, error };
}