// =================================================================
// Archivo: src/pages/AutomatizacionQAPage/AutomatizacionQAPage.tsx
// RESPONSABILIDAD (P4): panel TEMPORAL de pruebas para disparar el ciclo
// de automatización (envíos, reintentos/vencimiento, reescalado) desde el
// navegador y ver el resultado, sin tener que usar Swagger ni pgAdmin.
//
// @P5: esto es solo una herramienta de QA, no un diseño final. Cuando
// construyas VeterinarioAlertasPage probablemente quieras mover o borrar
// esto — lo dejo en su propia carpeta para que sea fácil de quitar.
// =================================================================
import { useState } from 'react';
import { apiFetch } from '../../services/api';
import { useToast } from '../../components/Toast/ToastContext';

interface ResultadoCiclo {
  envios: { revisadas: number; notificadas: number };
  reintentos: { reintentadas: number; vencidas: number };
  reescalado: { reescaladas: number; rojas_notificadas: number };
  ejecutado_en: string;
}

export default function AutomatizacionQAPage() {
  const [resultado, setResultado] = useState<ResultadoCiclo | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const { mostrarToast } = useToast();

  const ejecutar = async () => {
    setCargando(true);
    setError('');
    try {
      const data = await apiFetch<ResultadoCiclo>('/automatizacion/ejecutar', { method: 'POST' });
      setResultado(data);
      mostrarToast('Ciclo de automatización ejecutado.', 'ok');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido.');
      mostrarToast('No se pudo ejecutar la automatización.', 'error');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}>
      <h2>🤖 Panel de pruebas — Automatización (P4)</h2>
      <p style={{ color: '#666' }}>
        Dispara manualmente el mismo ciclo que corre solo cada 15 minutos: envía preguntas
        pendientes, procesa reintentos/vencimientos y reescala alertas. Útil para probar sin
        esperar el intervalo real.
      </p>

      <button
        onClick={ejecutar}
        disabled={cargando}
        style={{
          padding: '10px 20px', borderRadius: 8, border: 'none',
          background: cargando ? '#999' : '#2D6A4F', color: '#fff',
          fontWeight: 600, cursor: cargando ? 'not-allowed' : 'pointer',
        }}
      >
        {cargando ? 'Ejecutando…' : '▶ Ejecutar ciclo ahora'}
      </button>

      {error && <p style={{ color: '#B42318', marginTop: 16 }}>{error}</p>}

      {resultado && (
        <div style={{ marginTop: 24, background: '#f5f5f5', borderRadius: 12, padding: 20 }}>
          <p style={{ color: '#666', fontSize: 14 }}>Ejecutado: {new Date(resultado.ejecutado_en).toLocaleString('es-CO')}</p>

          <h4>1) Envío de preguntas programadas</h4>
          <ul>
            <li>Preguntas revisadas: <strong>{resultado.envios.revisadas}</strong></li>
            <li>Notificadas por correo: <strong>{resultado.envios.notificadas}</strong></li>
          </ul>

          <h4>2) Reintentos y vencimiento</h4>
          <ul>
            <li>Reintentadas (6h / 12h): <strong>{resultado.reintentos.reintentadas}</strong></li>
            <li>Vencidas (alerta sin_respuesta creada): <strong>{resultado.reintentos.vencidas}</strong></li>
          </ul>

          <h4>3) Reescalado de alertas</h4>
          <ul>
            <li>Alertas reescaladas: <strong>{resultado.reescalado.reescaladas}</strong></li>
            <li>Alertas rojas notificadas al veterinario: <strong>{resultado.reescalado.rojas_notificadas}</strong></li>
          </ul>
        </div>
      )}
    </div>
  );
}