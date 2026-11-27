import { useEffect, useState } from 'react';
import { seguimientoService, EVENTO_PREGUNTAS_CAMBIARON } from '../services/seguimientoService';

export function usePreguntasPendientes(activo: boolean) {
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!activo) return;
    let vivo = true;
    const cargar = () =>
      seguimientoService
        .pendientesMios()
        .then((lista) => { if (vivo) setTotal((lista || []).length); })
        .catch(() => { /* si falla, el menú sigue funcionando sin el globito */ });
    const alVolver = () => { if (document.visibilityState === 'visible') cargar(); };

    cargar();
    const timer = setInterval(cargar, 30_000);
    window.addEventListener(EVENTO_PREGUNTAS_CAMBIARON, cargar);
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      vivo = false;
      clearInterval(timer);
      window.removeEventListener(EVENTO_PREGUNTAS_CAMBIARON, cargar);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [activo]);

  return total;
}