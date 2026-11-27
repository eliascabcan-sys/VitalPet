// =================================================================
// Archivo: src/hooks/useAlertasPendientes.ts
// RESPONSABILIDAD: Cuántas alertas de seguimiento siguen sin atender, y
// cuántas de ellas son graves (rojas). Alimenta el globito del menú.
// Se vuelve a consultar cada minuto. Solo para veterinario y administrador.
// =================================================================
import { useEffect, useState } from 'react';
import { seguimientoAdminService, EVENTO_ALERTAS_CAMBIARON } from '../services/seguimientoAdminService';

export function useAlertasPendientes(activo: boolean) {
  const [info, setInfo] = useState({ total: 0, graves: 0 });

  useEffect(() => {
    if (!activo) return;
    let vivo = true;
    const cargar = () =>
      seguimientoAdminService
        .alertasPendientes()
        .then((alertas) => {
          if (vivo) setInfo({ total: alertas.length, graves: alertas.filter((a) => a.nivel === 'rojo').length });
        })
        .catch(() => { /* si falla, el menú sigue funcionando sin el globito */ });
    cargar();
    const timer = setInterval(cargar, 60_000);
    // Al marcar una alerta como vista, se vuelve a consultar de inmediato
    window.addEventListener(EVENTO_ALERTAS_CAMBIARON, cargar);
    return () => {
      vivo = false;
      clearInterval(timer);
      window.removeEventListener(EVENTO_ALERTAS_CAMBIARON, cargar);
    };
  }, [activo]);

  return info;
}