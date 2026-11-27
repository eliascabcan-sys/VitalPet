// =================================================================
// Archivo: src/pages/HomePage/HomePage.tsx
// RESPONSABILIDAD: Landing pública. Navbar, hero con vista del
// producto, funciones (bento), pasos, veterinarias (con tarjeta
// "Más próximamente"), cierre, footer y WhatsApp flotante.
// Todo el CSS vive en home.css bajo el contenedor .vp-landing.
// =================================================================
import { Link } from 'react-router-dom';
import logo from '../../assets/img/Adobe Express - file.png';
import logoLoquivet from '../../assets/img/veterinaria.png';
import { VETERINARIAS_DISPONIBLES, WHATSAPP } from '../../constants/landing';
import '../../assets/css/home.css';

// Niveles de triaje: mismos nombres y significado que usa la aplicación.
const NIVELES = [
  { clase: 'verde', nombre: 'Verde', detalle: 'Estándar' },
  { clase: 'amarillo', nombre: 'Amarillo', detalle: 'Urgente' },
  { clase: 'naranja', nombre: 'Naranja', detalle: 'Muy urgente' },
  { clase: 'rojo', nombre: 'Rojo', detalle: 'Emergencia' },
];

const HISTORIAL = [
  { icono: 'bi-shield-plus', texto: 'Vacunación al día' },
  { icono: 'bi-clipboard2-pulse', texto: 'Resultados de laboratorio' },
  { icono: 'bi-stethoscope', texto: 'Consulta de control' },
];

const DIAS = ['L', 'M', 'X', 'J', 'V', 'S'];

const PASOS = [
  {
    titulo: 'Regístrate',
    texto: 'Crea tu cuenta como dueño o administrador de veterinaria en minutos.',
  },
  {
    titulo: 'Elige tu veterinaria',
    texto: 'Selecciona la veterinaria de tu preferencia y queda vinculado a ella.',
  },
  {
    titulo: 'Gestiona tu mascota',
    texto: 'Accede al historial clínico, citas y reportes diarios de salud.',
  },
];

// Imágenes por id de veterinaria. Si una clínica no tiene imagen, se muestra su inicial.
const IMAGENES_VET: Record<string, string> = {
  loquivet: logoLoquivet,
};

// Trazo de electrocardiograma (viewBox 1440x90). Se dibuja una sola vez al cargar.
const PULSO_HERO =
  'M0,45 H260 L280,45 L292,14 L310,80 L326,30 L338,45 H820 L840,45 L852,14 L870,80 L886,30 L898,45 H1440';

// Trazo de electrocardiograma entre los tres pasos (viewBox 1000x60).
const PULSO_PASOS =
  'M0,30 H225 L235,30 L243,8 L255,52 L265,22 L272,30 H725 L735,30 L743,8 L755,52 L765,22 L772,30 H1000';

export default function HomePage() {
  const anio = new Date().getFullYear();
  const whatsappHref = `https://wa.me/${WHATSAPP.numero}?text=${encodeURIComponent(WHATSAPP.mensaje)}`;

  return (
    <div className="vp-landing">
      {/* ---------- Navbar ---------- */}
      <nav className="vp-navbar" aria-label="Principal">
        <div className="vp-contenedor vp-navbar-fila">
          <Link to="/" className="marca">
            <img src={logo} alt="" className="nav-logo" />
            <span className="texto-marca">
              Vital<span>Pet</span>
            </span>
          </Link>

          <ul className="vp-navbar-enlaces">
            <li><a href="#que-ofrece">Funciones</a></li>
            <li><a href="#como-funciona">Cómo funciona</a></li>
            <li><a href="#veterinarias">Veterinarias</a></li>
          </ul>

          <div className="vp-navbar-acciones">
            <Link to="/login" className="btn-admin" aria-label="Iniciar sesión">
              <i className="bi bi-box-arrow-in-right" aria-hidden="true" />
              <span>Iniciar sesión</span>
            </Link>
            <Link to="/registro" className="btn-dueno" aria-label="Registrarse">
              <i className="bi bi-person-plus" aria-hidden="true" />
              <span>Registrarse</span>
            </Link>
          </div>
        </div>
      </nav>

      <main>
        {/* ---------- Hero ---------- */}
        <section className="vp-hero">
          <div className="vp-hero-bg" />
          <div className="vp-hero-overlay" />

          <div className="vp-contenedor vp-hero-rejilla">
            <div className="vp-hero-contenido">
              <h1>
                La salud de tu mascota,
                <br />
                <span>siempre conectada</span>
              </h1>

              <p>
                VitalPet conecta dueños y veterinarios en una sola plataforma. Historial clínico,
                citas, alertas de salud y seguimiento diario.
              </p>

              <div className="vp-hero-botones">
                <Link to="/login" className="btn-cta">
                  Comenzar ahora <i className="bi bi-arrow-right" aria-hidden="true" />
                </Link>
                <a href="#como-funciona" className="btn-cta-secundario">
                  Ver cómo funciona
                </a>
              </div>
            </div>

            {/* Fragmentos de la interfaz: ejemplo ilustrativo */}
            <div className="vp-hero-ui" aria-hidden="true">
              <div className="vp-ui vp-ui-reporte">
                <div className="vp-ui-cabecera">
                  <span className="vp-ui-avatar">M</span>
                  <div>
                    <strong>Max</strong>
                    <small>Corgi · 3 años</small>
                  </div>
                  <span className="vp-ui-etiqueta">Reporte de hoy</span>
                </div>
                <ul className="vp-ui-lista">
                  <li><span>Apetito</span><b><i className="bi bi-check-circle-fill" /> Normal</b></li>
                  <li><span>Energía</span><b><i className="bi bi-check-circle-fill" /> Normal</b></li>
                  <li><span>Hidratación</span><b><i className="bi bi-check-circle-fill" /> Normal</b></li>
                </ul>
                <div className="vp-ui-estado verde">
                  <i className="bi bi-heart-pulse-fill" /> Triaje verde · sin alertas
                </div>
              </div>

              <div className="vp-ui vp-ui-alerta">
                <span className="vp-ui-alerta-icono"><i className="bi bi-bell-fill" /></span>
                <div>
                  <strong>Alerta amarilla</strong>
                  <small>Luna no comió hoy. Aviso enviado al veterinario.</small>
                </div>
              </div>

              <span className="vp-ui-nota">Vista de ejemplo</span>
            </div>
          </div>

          <svg
            className="vp-hero-pulso"
            viewBox="0 0 1440 90"
            preserveAspectRatio="xMidYMid slice"
            aria-hidden="true"
          >
            <path d={PULSO_HERO} pathLength={1} />
          </svg>
        </section>

        {/* ---------- Qué ofrece (bento) ---------- */}
        <section className="vp-caracteristicas" id="que-ofrece">
          <div className="vp-contenedor">
            <header className="vp-encabezado-seccion">
              <h2 className="vp-titulo-seccion">¿Qué ofrece VitalPet?</h2>
              <p className="vp-subtitulo-seccion">
                Herramientas pensadas para veterinarios y dueños de mascotas
              </p>
            </header>

            <div className="vp-bento">
              <article className="vp-bento-item vp-bento-triaje">
                <div className="vp-bento-texto">
                  <h3>Alertas de salud por triaje</h3>
                  <p>
                    El dueño reporta el estado diario de su mascota y el sistema alerta al
                    veterinario automáticamente.
                  </p>
                </div>
                <ul className="vp-niveles" aria-label="Niveles de triaje">
                  {NIVELES.map((n) => (
                    <li key={n.clase} className={`vp-nivel ${n.clase}`}>
                      <span className="vp-nivel-barra" aria-hidden="true" />
                      <b>{n.nombre}</b>
                      <span>{n.detalle}</span>
                    </li>
                  ))}
                </ul>
              </article>

              <article className="vp-bento-item vp-bento-historial">
                <div className="vp-bento-texto">
                  <h3>Historial clínico digital</h3>
                  <p>
                    Cada consulta queda registrada. Diagnósticos, tratamientos y observaciones por
                    paciente.
                  </p>
                </div>
                <ol className="vp-linea-tiempo">
                  {HISTORIAL.map((h) => (
                    <li key={h.texto}>
                      <span className="vp-linea-punto" aria-hidden="true">
                        <i className={`bi ${h.icono}`} />
                      </span>
                      {h.texto}
                    </li>
                  ))}
                </ol>
              </article>

              <article className="vp-bento-item vp-bento-citas">
                <div className="vp-bento-texto">
                  <h3>Gestión de citas</h3>
                  <p>Agenda citas fácilmente y recibe notificaciones. Sin llamadas, sin confusiones.</p>
                </div>
                <div className="vp-semana" aria-hidden="true">
                  <div className="vp-semana-dias">
                    {DIAS.map((d) => (
                      <span key={d} className={d === 'J' ? 'activo' : ''}>{d}</span>
                    ))}
                  </div>
                  <div className="vp-semana-cita">
                    <i className="bi bi-calendar2-check" />
                    <span>Control y vacunas · 10:30</span>
                  </div>
                  <div className="vp-semana-aviso">
                    <i className="bi bi-bell" /> Recordatorio enviado
                  </div>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* ---------- Cómo funciona ---------- */}
        <section className="vp-como-funciona" id="como-funciona">
          <div className="vp-contenedor">
            <header className="vp-encabezado-seccion">
              <h2 className="vp-titulo-seccion">¿Cómo funciona?</h2>
              <p className="vp-subtitulo-seccion">En tres pasos sencillos</p>
            </header>

            <div className="vp-pasos-caja">
              <svg
                className="vp-pasos-pulso"
                viewBox="0 0 1000 60"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path d={PULSO_PASOS} />
              </svg>
            <ol className="vp-pasos">
              {PASOS.map((p, i) => (
                <li className="vp-paso" key={p.titulo}>
                  <span className="numero">{i + 1}</span>
                  <h3>{p.titulo}</h3>
                  <p>{p.texto}</p>
                </li>
              ))}
            </ol>
            </div>
          </div>
        </section>

        {/* ---------- Veterinarias ---------- */}
        <section className="vp-veterinaria" id="veterinarias">
          <div className="vp-contenedor">
            <header className="vp-encabezado-seccion">
              <h2 className="vp-titulo-seccion">Veterinaria disponible</h2>
              <p className="vp-subtitulo-seccion">
                Actualmente contamos con esta clínica en la plataforma
              </p>
            </header>

            <div className="vp-grid-vets">
              {VETERINARIAS_DISPONIBLES.map((v) => (
                <article className="vp-card-vet" key={v.id}>
                  <div className="img-vet">
                    {IMAGENES_VET[v.id] ? (
                      <img src={IMAGENES_VET[v.id]} alt={`Logo de ${v.nombre}`} />
                    ) : (
                      <span className="img-vet-inicial" aria-hidden="true">
                        {v.nombre.charAt(0)}
                      </span>
                    )}
                    <span className="vp-estado-vet">
                      <span className="vp-punto-vivo" aria-hidden="true" /> En VitalPet
                    </span>
                  </div>

                  <div className="info">
                    <h3>{v.nombre}</h3>
                    <p>
                      <i className="bi bi-geo-alt" aria-hidden="true" /> {v.direccion}
                    </p>

                    <div className="vp-acciones-vet">
                      <Link to="/registro" className="btn-ver-mas">
                        Ver más <i className="bi bi-arrow-right" aria-hidden="true" />
                      </Link>
                      {v.instagram && (
                        <a
                          href={v.instagram}
                          className="btn-red-social"
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Instagram de ${v.nombre}`}
                        >
                          <i className="bi bi-instagram" aria-hidden="true" />
                        </a>
                      )}
                    </div>
                  </div>
                </article>
              ))}

              {/* Tarjeta "Más próximamente" */}
              <article className="vp-card-vet vp-card-proximamente">
                <div className="vp-proximamente-cuerpo">
                  <span className="vp-badge-pronto">Pronto</span>
                  <span className="vp-proximamente-icono" aria-hidden="true">
                    <i className="bi bi-hospital" />
                  </span>
                  <h3>Más veterinarias próximamente</h3>
                  <p>Estamos sumando nuevas clínicas a VitalPet.</p>
                  <Link to="/registro" className="vp-enlace-sumate">
                    ¿Tienes una veterinaria? Regístrala{' '}
                    <i className="bi bi-arrow-right" aria-hidden="true" />
                  </Link>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* ---------- Cierre ---------- */}
        <section className="vp-cierre">
          <div className="vp-contenedor vp-cierre-fila">
            <div>
              <h2>Todo el cuidado de tu mascota, en un solo lugar</h2>
              <p>Crea tu cuenta, elige tu veterinaria y empieza el seguimiento hoy.</p>
            </div>
            <div className="vp-cierre-botones">
              <Link to="/registro" className="btn-cta">
                Crear cuenta
              </Link>
              <Link to="/login" className="btn-cta-secundario">
                Ya tengo cuenta
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ---------- Footer ---------- */}
      <footer className="vp-footer">
        <div className="vp-contenedor">
          <div className="vp-footer-fila">
            <div className="vp-footer-marca">
              <div className="marca-footer">
                Vital<span>Pet</span>
              </div>
              <p>Sistema de gestión de clínica veterinaria.</p>
              <p>
                Optimiza los procesos de tu clínica y mejora el seguimiento diario de cada mascota.
              </p>
            </div>

            <nav className="vp-footer-col" aria-label="Explora">
              <h3>Explora</h3>
              <a href="#que-ofrece">Funciones</a>
              <a href="#como-funciona">Cómo funciona</a>
              <a href="#veterinarias">Veterinarias</a>
            </nav>

            <nav className="vp-footer-col" aria-label="Tu cuenta">
              <h3>Tu cuenta</h3>
              <Link to="/login">Iniciar sesión</Link>
              <Link to="/registro">Registrarse</Link>
            </nav>
          </div>
          <hr />
          <p className="pie">© {anio} VitalPet · Conectando dueños y veterinarios</p>
        </div>
      </footer>

      <a
        href={whatsappHref}
        className="whatsapp-flotante"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Escríbenos por WhatsApp"
      >
        <i className="bi bi-whatsapp" aria-hidden="true" />
      </a>
    </div>
  );
}
