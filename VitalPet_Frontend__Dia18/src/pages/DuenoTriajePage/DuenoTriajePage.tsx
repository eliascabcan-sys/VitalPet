// =================================================================
// Archivo: src/pages/DuenoTriajePage/DuenoTriajePage.tsx
// RESPONSABILIDAD: Página informativa sobre los niveles de triaje para
// el dueño. Los niveles se leen del backend (GET /triaje/niveles).
// =================================================================
import '../../assets/css/dueno.css';
import '../../assets/css/triaje.css';
import { useNivelesTriaje } from '../../hooks/useNivelesTriaje';

export default function DuenoTriajePage() {
  const { niveles, cargando, error } = useNivelesTriaje();

  return (
    <section className="section active">
      <div className="section-header">
        <div>
          <div className="page-title">¿Qué significan las alertas?</div>
          <div className="page-sub">Así clasifica el sistema la urgencia de tu reporte diario.</div>
        </div>
      </div>

      <p className="triaje-intro">
        Cada vez que envías tu reporte diario, el sistema lo revisa y le asigna un color de urgencia (similar
        al triaje que se usa en urgencias). Con base en ese color, el veterinario decide si tu mascota necesita
        chequeo, consulta, seguimiento u hospitalización.
      </p>

      {cargando && <p className="triaje-intro">Cargando niveles...</p>}
      {error && <p className="triaje-intro">{error}</p>}

      <div className="triaje-grid">
        {niveles.map((n) => (
          <div className={`triaje-card triaje-${n.codigo}`} key={n.codigo}>
            <div className="nivel">Nivel {n.numero}</div>
            <div className="nombre">
              {n.etiqueta} · {n.nombre}
            </div>
            <div className="desc">{n.desc_dueno}</div>
          </div>
        ))}
      </div>

      <p className="triaje-nota">
        <i className="ti ti-info-circle" /> Si en cualquier momento ves signos graves en tu mascota (rojo o
        naranja), no esperes a que el sistema te responda: comunícate directamente con la clínica.
      </p>
    </section>
  );
}