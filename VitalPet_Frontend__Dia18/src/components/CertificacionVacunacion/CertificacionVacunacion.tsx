// =================================================================
// Archivo: src/components/CertificacionVacunacion/CertificacionVacunacion.tsx
// RESPONSABILIDAD: Certificación de vacunación de UNA mascota para el dueño:
// el esquema sanitario (qué le toca y qué está atrasado) y la lista de
// aplicaciones. Lo usan la pantalla "Certificación de vacunación" y la
// carpeta de la mascota.
// =================================================================
import { useEffect, useState } from 'react';
import { vacunasService, ETIQUETA_TIPO_APLICACION } from '../../services/vacunasService';
import type { Vacuna } from '../../services/vacunasService';
import { esquemaSanitarioService } from '../../services/esquemaSanitarioService';
import type { EsquemaSanitario as Esquema } from '../../services/esquemaSanitarioService';
import EsquemaSanitario from '../EsquemaSanitario/EsquemaSanitario';
import { useToast } from '../Toast/ToastContext';
import '../../assets/css/dueno.css';

export default function CertificacionVacunacion({ idMascota }: { idMascota: number }) {
  const [vacunas, setVacunas] = useState<Vacuna[]>([]);
  const [estado, setEstado] = useState<'cargando' | 'ok' | 'vacio' | 'error'>('cargando');
  const [errorMsg, setErrorMsg] = useState('');
  const [esquema, setEsquema] = useState<Esquema | null>(null);
  const { mostrarToast } = useToast();

  useEffect(() => {
    setEstado('cargando');
    vacunasService
      .porMascota(idMascota)
      .then((data) => {
        const activas = (data || [])
          .filter((v) => v.estado !== 'inactivo')
          .sort((a, b) => new Date(b.fecha_aplicacion).getTime() - new Date(a.fecha_aplicacion).getTime());
        setVacunas(activas);
        setEstado(activas.length ? 'ok' : 'vacio');
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : 'Error al cargar la certificación de vacunación.';
        setErrorMsg(msg);
        setEstado('error');
        mostrarToast(msg, 'error');
      });
  }, [idMascota]); // eslint-disable-line react-hooks/exhaustive-deps

  // El esquema (qué le toca y qué está atrasado) se pide aparte: si falla, la lista sigue funcionando.
  useEffect(() => {
    setEsquema(null);
    esquemaSanitarioService.porMascota(idMascota).then(setEsquema).catch(() => setEsquema(null));
  }, [idMascota]);

  const hoy = new Date();

  return (
    <>
      {esquema && <EsquemaSanitario esquema={esquema} />}

      <div>
        {estado === 'cargando' && (
          <p style={{ fontSize: 14, color: 'var(--color-texto-gris)' }}>Cargando certificación...</p>
        )}
        {estado === 'vacio' && (
          <div className="vacio">
            <i className="ti ti-vaccine" />
            Esta mascota aún no tiene aplicaciones registradas.
          </div>
        )}
        {estado === 'error' && (
          <div className="vacio">
            <i className="ti ti-wifi-off" />
            {errorMsg}
          </div>
        )}
        {estado === 'ok' &&
          vacunas.map((v) => {
            const fechaAplicacion = new Date(`${v.fecha_aplicacion}T00:00:00`).toLocaleDateString('es-CO', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            });

            let fechaProxima: Date | null = null;
            let vencida = false;
            let fechaProximaTexto = '';
            if (v.proxima_dosis) {
              fechaProxima = new Date(`${v.proxima_dosis}T00:00:00`);
              vencida = fechaProxima < hoy;
              fechaProximaTexto = fechaProxima.toLocaleDateString('es-CO', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              });
            }

            return (
              <div className="hist-modal-item" key={v.idVacuna} style={{ marginBottom: 10 }}>
                <div className="hist-modal-fecha">
                  <i className="ti ti-vaccine" style={{ fontSize: 14 }} /> {v.nombre_vacuna}
                  {v.tipo && v.tipo !== 'vacuna' ? ` · ${ETIQUETA_TIPO_APLICACION[v.tipo]}` : ''}
                </div>
                <div className="hist-modal-campo">
                  <label>Fecha de aplicación</label>
                  <p>{fechaAplicacion}</p>
                </div>
                {v.veterinario && (
                  <div className="hist-modal-campo">
                    <label>Veterinario</label>
                    <p>{v.veterinario}</p>
                  </div>
                )}
                {v.lote && (
                  <div className="hist-modal-campo">
                    <label>Lote</label>
                    <p>{v.lote}</p>
                  </div>
                )}
                {fechaProxima && (
                  <div className="hist-modal-campo">
                    <label>Próxima dosis</label>
                    <p>
                      {fechaProximaTexto}{' '}
                      <span className={`badge-estado ${vencida ? 'cancelada' : 'pendiente'}`}>
                        {vencida ? 'Vencida' : 'Programada'}
                      </span>
                    </p>
                  </div>
                )}
                {v.observaciones && (
                  <div className="hist-modal-campo">
                    <label>Observaciones</label>
                    <p>{v.observaciones}</p>
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </>
  );
}