// =================================================================
// Archivo: src/components/HistorialMascota/HistorialMascota.tsx
// RESPONSABILIDAD: Historial clínico de UNA mascota para el dueño: peso en
// cada control, filtro por días y los registros con su fórmula y exámenes.
// Lo usan la pantalla "Historial clínico" y la carpeta de la mascota.
// =================================================================
import { useEffect, useState } from 'react';
import { historialService } from '../../services/historialService';
import type { RegistroHistorial } from '../../services/historialService';
import FiltroDias from '../FiltroDias/FiltroDias';
import FormulaImprimible from '../FormulaImprimible/FormulaImprimible';
import { LaboratorioDesplegable } from '../LaboratorioPanel/LaboratorioPanel';
import PesoControles from '../PesoControles/PesoControles';
import { useToast } from '../Toast/ToastContext';
import { dentroDeDias } from '../../utils/fechas';
import '../../assets/css/dueno.css';

function fechaValida(fechaStr?: string): Date | null {
  if (!fechaStr) return null;
  const f = new Date(fechaStr);
  return isNaN(f.getTime()) ? null : f;
}

interface Props {
  idMascota: number;
  ocultarMascota?: boolean; // dentro de la carpeta ya se sabe de quién es: no se repite el nombre
}

export default function HistorialMascota({ idMascota, ocultarMascota }: Props) {
  const [registros, setRegistros] = useState<RegistroHistorial[]>([]);
  const [estado, setEstado] = useState<'cargando' | 'ok' | 'vacio' | 'error'>('cargando');
  const [dias, setDias] = useState(''); // '' = Ver todo
  const { mostrarToast } = useToast();

  useEffect(() => {
    setEstado('cargando');
    historialService
      .porMascota(idMascota)
      .then((data) => {
        const activos = (data || [])
          .filter((h) => h.estado === 'activo')
          .sort((a, b) => {
            const fa = fechaValida(a.fechaRegistro);
            const fb = fechaValida(b.fechaRegistro);
            if (!fa && !fb) return 0;
            if (!fa) return 1;
            if (!fb) return -1;
            return fb.getTime() - fa.getTime();
          });
        setRegistros(activos);
        setEstado(activos.length ? 'ok' : 'vacio');
      })
      .catch(() => {
        setEstado('error');
        mostrarToast('No se pudo cargar el historial.', 'error');
      });
  }, [idMascota]); // eslint-disable-line react-hooks/exhaustive-deps

  const visibles = registros.filter((h) => dentroDeDias(h.fechaRegistro, dias));

  return (
    <>
      <PesoControles idMascota={idMascota} />
      <FiltroDias dias={dias} onChange={setDias} />

      <div>
        {estado === 'cargando' && <p style={{ fontSize: 14, color: 'var(--color-texto-gris)' }}>Cargando...</p>}
        {estado === 'vacio' && (
          <div className="vacio">
            <i className="ti ti-clipboard-list" />
            Esta mascota aún no tiene historial clínico registrado.
          </div>
        )}
        {estado === 'error' && (
          <div className="vacio">
            <i className="ti ti-wifi-off" />
            Error al cargar historial.
          </div>
        )}
        {estado === 'ok' && !visibles.length && (
          <div className="vacio">
            <i className="ti ti-calendar-off" />
            No hay registros en los últimos {dias} días. Usa "Ver todo" para ver el historial completo.
          </div>
        )}
        {estado === 'ok' &&
          visibles.map((h) => {
            const f = fechaValida(h.fechaRegistro);
            const fecha = f
              ? f.toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })
              : 'Fecha no disponible';
            const formula = h.formulas?.[0];
            return (
              <div className="hist-modal-item" key={h.idHistorial} style={{ marginBottom: 10 }}>
                <div className="hist-modal-fecha">
                  <i className="ti ti-calendar" style={{ fontSize: 14 }} /> {fecha}
                </div>
                {!ocultarMascota && h.nombre_mascota && (
                  <div className="hist-modal-campo">
                    <label>Mascota</label>
                    <p>
                      {h.nombre_mascota} ({h.especie})
                    </p>
                  </div>
                )}
                {h.motivo_consulta && (
                  <div className="hist-modal-campo">
                    <label>Motivo</label>
                    <p>{h.motivo_consulta}</p>
                  </div>
                )}
                {h.peso_consulta != null && (
                  <div className="hist-modal-campo">
                    <label>Peso</label>
                    <p>{h.peso_consulta} kg</p>
                  </div>
                )}
                {h.diagnostico && (
                  <div className="hist-modal-campo">
                    <label>Diagnóstico</label>
                    <p>{h.diagnostico}</p>
                  </div>
                )}
                {(formula?.medicamentos?.length || h.tratamiento || h.medicamentos) && (
                  <div className="hist-modal-campo">
                    <label>Fórmula</label>
                    {formula?.medicamentos?.length ? (
                      <>
                        {formula.medicamentos.map((m) => (
                          <p key={m.idFormulaMedicamento}>
                            {m.nombre_medicamento}: {m.dosis}, {m.frecuencia}, {m.duracion_dias} día(s)
                          </p>
                        ))}
                        {formula.recomendaciones && <p><em>Recomendaciones: {formula.recomendaciones}</em></p>}
                        <FormulaImprimible registro={h} formula={formula} />
                      </>
                    ) : (
                      <p>{[h.tratamiento, h.medicamentos].filter(Boolean).join(' · ')}</p>
                    )}
                  </div>
                )}
                {h.observaciones && (
                  <div className="hist-modal-campo">
                    <label>Observaciones</label>
                    <p>{h.observaciones}</p>
                  </div>
                )}
                {h.proxima_cita && (
                  <div className="hist-modal-campo">
                    <label>Próxima cita</label>
                    <p>{h.proxima_cita}</p>
                  </div>
                )}
                <LaboratorioDesplegable idHistorial={h.idHistorial} modo="dueno" />
              </div>
            );
          })}
      </div>
    </>
  );
}