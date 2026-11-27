// =================================================================
// Archivo: src/components/PreparacionCita/PreparacionCita.tsx
// RESPONSABILIDAD: Muestra, dentro de una cita próxima, lo que le falta a la
// mascota (vacunas / desparasitación y exámenes) — lo mismo que lleva el
// correo de recordatorio. Si no falta nada, solo muestra un "todo al día".
// Los datos llegan ya cargados desde la página (una sola petición para
// todas las citas), así que este componente no hace peticiones.
// =================================================================
import { useState } from 'react';
import type { PreparacionDeCita } from '../../services/citasService';
import './PreparacionCita.css';

const ETIQUETA_VACUNA: Record<string, string> = {
    vencida: 'Vencida',
    proxima: 'Próxima',
    sin_datos: 'Sin registro',
};

const ETIQUETA_EXAMEN: Record<string, string> = {
    solicitado: 'Por realizar',
    en_proceso: 'En proceso',
};

interface Props {
    fila?: PreparacionDeCita;
}

export default function PreparacionCita({ fila }: Props) {
    const [abierto, setAbierto] = useState(false);
    if (!fila) return null;

    if (fila.al_dia) {
        return (
        <div className="prep">
            <span className="prep-ok">
            <i className="ti ti-circle-check" /> Todo al día para esta cita
            </span>
        </div>
        );
    }

    return (
        <div className="prep">
        <button
            type="button"
            className="prep-chip"
            aria-expanded={abierto}
            onClick={() => setAbierto((a) => !a)}
        >
            <i className="ti ti-checklist" />
            {fila.total === 1 ? 'Te falta 1 pendiente' : `Te faltan ${fila.total} pendientes`}
            <i className="ti ti-chevron-down prep-flecha" />
        </button>

        {abierto && (
            <div className="prep-panel">
            {fila.vacunas.length > 0 && (
                <div className="prep-grupo">
                <div className="prep-grupo-titulo">Vacunas y desparasitación</div>
                <ul className="prep-lista">
                    {fila.vacunas.map((v) => (
                    <li className="prep-item" key={v.nombre}>
                        <span className={`prep-etiqueta ${v.estado}`}>{ETIQUETA_VACUNA[v.estado] ?? v.estado}</span>
                        <span>{v.nombre}</span>
                        {v.mensaje && <span className="prep-detalle">{v.mensaje}</span>}
                    </li>
                    ))}
                </ul>
                </div>
            )}

            {fila.examenes.length > 0 && (
                <div className="prep-grupo">
                <div className="prep-grupo-titulo">Exámenes</div>
                <ul className="prep-lista">
                    {fila.examenes.map((e, i) => (
                    <li className="prep-item" key={`${e.tipo_examen}-${i}`}>
                        <span className={`prep-etiqueta ${e.estado}`}>{ETIQUETA_EXAMEN[e.estado] ?? e.estado}</span>
                        <span>{e.tipo_examen}</span>
                    </li>
                    ))}
                </ul>
                </div>
            )}

            <p className="prep-pie">Puedes resolverlo en la misma cita: el veterinario lo revisa contigo.</p>
            </div>
        )}
        </div>
    );
}