// =================================================================
// Archivo: src/components/AuthPanel/AuthPanel.tsx
// RESPONSABILIDAD: Panel de marca (lado izquierdo) compartido por las
// pantallas de acceso: login, registro, recuperar contraseña y OAuth.
// Los estilos viven en assets/css/auth.css bajo .vp-auth.
// =================================================================
import { Link } from 'react-router-dom';
import logo from '../../assets/img/Adobe Express - file.png';

const PUNTOS = [
  { icono: 'ti-clipboard-heart', texto: 'Historial clínico siempre a la mano' },
  { icono: 'ti-bell-ringing', texto: 'Alertas de salud por triaje' },
  { icono: 'ti-calendar-check', texto: 'Citas sin llamadas ni confusiones' },
];

// Mismo trazo de electrocardiograma de la landing (viewBox 1440x90).
const PULSO =
  'M0,45 H260 L280,45 L292,14 L310,80 L326,30 L338,45 H820 L840,45 L852,14 L870,80 L886,30 L898,45 H1440';

export default function AuthPanel() {
  return (
    <aside className="vp-auth-panel" aria-label="VitalPet">
      <div className="vp-auth-panel-bg" aria-hidden="true" />
      <div className="vp-auth-panel-contenido">
        <Link to="/" className="vp-auth-marca">
          <img src={logo} alt="" />
          <span>
            Vital<span>Pet</span>
          </span>
        </Link>

        <div className="vp-auth-mensaje">
          <h2>
            La salud de tu mascota, <span>siempre conectada</span>
          </h2>
          <ul>
            {PUNTOS.map((p) => (
              <li key={p.texto}>
                <i className={`ti ${p.icono}`} aria-hidden="true" />
                {p.texto}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <svg className="vp-auth-pulso" viewBox="0 0 1440 90" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <path d={PULSO} pathLength={1} />
      </svg>
    </aside>
  );
}
