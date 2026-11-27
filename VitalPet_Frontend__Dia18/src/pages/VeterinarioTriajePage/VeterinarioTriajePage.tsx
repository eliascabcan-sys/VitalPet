// =================================================================
// Archivo: src/pages/VeterinarioTriajePage/VeterinarioTriajePage.tsx
// RESPONSABILIDAD: Página informativa con la escala de triaje de
// Manchester adaptada. Los niveles se leen del backend (GET /triaje/niveles).
// =================================================================
import '../../assets/css/admin.css';
import '../../assets/css/triaje.css';
import { useNivelesTriaje } from '../../hooks/useNivelesTriaje';

export default function VeterinarioTriajePage() {
  const { niveles, cargando, error } = useNivelesTriaje();

  return (
    <section id="sec-triaje" className="seccion activa">
      <div className="sec-header">
        <div>
          <div className="sec-titulo">Triaje de Manchester</div>
          <div className="sec-subtitulo">Referencia para interpretar el nivel de urgencia de las alertas</div>
        </div>
      </div>

      <p className="triaje-intro">
        Cuando un dueño llena su reporte diario, el sistema genera una alerta con un color según la gravedad
        de lo reportado. Esta clasificación está adaptada del sistema de triaje de Manchester (usado en
        urgencias humanas) al contexto veterinario, para priorizar qué pacientes deben ser atendidos primero.
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
            <div className="tiempo">
              <i className="ti ti-clock" /> {n.tiempo_texto}
            </div>
            <div className="desc">{n.desc_veterinario}</div>
          </div>
        ))}
      </div>

      <p className="triaje-nota">
        <i className="ti ti-info-circle" /> Esta escala es una guía de apoyo interno del equipo VitalPet,
        adaptada de estudios de triaje veterinario. No reemplaza el criterio clínico del veterinario
        tratante. Si una alerta pasa su tiempo máximo sin ser revisada, el sistema la sube un nivel.
      </p>
    </section>
  );
}