// =================================================================
// Archivo: src/components/EsquemaSanitario/EsquemaSanitario.tsx
// RESPONSABILIDAD: Muestra el esquema sanitario de UNA mascota
// (vacunas, desparasitaciones, antipulgas): qué está al día, qué le toca
// pronto y qué está atrasado. El cálculo lo hace el backend.
// =================================================================
import type { EsquemaSanitario as Esquema, EstadoEsquema, ItemEsquema, TipoAplicacion } from '../../services/esquemaSanitarioService';
import './EsquemaSanitario.css';

const ETIQUETA_ESTADO: Record<EstadoEsquema, string> = {
  al_dia: 'Al día',
  proxima: 'Próxima',
  vencida: 'Atrasada',
  sin_datos: 'Faltan datos',
  opcional: 'Opcional',
};

const GRUPOS: { tipo: TipoAplicacion; titulo: string; icono: string }[] = [
  { tipo: 'vacuna', titulo: 'Vacunas', icono: 'ti-vaccine' },
  { tipo: 'desparasitacion', titulo: 'Desparasitación', icono: 'ti-pill' },
  { tipo: 'antipulgas', titulo: 'Antipulgas y garrapatas', icono: 'ti-bug' },
];

const fecha = (v?: string | null) =>
  v ? new Date(`${v}T00:00:00`).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';

function Fila({ it }: { it: ItemEsquema }) {
  return (
    <div className={`es-item ${it.estado}`}>
      <div className="es-item-cab">
        <div className="es-nombre">{it.nombre}</div>
        <span className={`es-estado ${it.estado}`}>{ETIQUETA_ESTADO[it.estado]}</span>
      </div>
      <p className="es-msg">{it.mensaje}</p>
      <p className="es-det">
        {it.dosis_total != null && <>Dosis {Math.min(it.dosis_aplicadas, it.dosis_total)} de {it.dosis_total} · </>}
        Última: {fecha(it.ultima_aplicacion)}
        {it.fecha_objetivo && <> · Próxima: {fecha(it.fecha_objetivo)}</>}
      </p>
      {it.detalle && <p className="es-det">{it.detalle}</p>}
    </div>
  );
}

export default function EsquemaSanitario({ esquema }: { esquema: Esquema }) {
  const r = esquema.resumen;
  return (
    <div className="es-panel">
      <div className="es-titulo">
        <i className="ti ti-shield-check" /> Esquema sanitario de {esquema.nombre_mascota}
        {esquema.edad_semanas != null && <small> · {esquema.edad_semanas} semanas de edad</small>}
      </div>

      <div className="es-resumen">
        <span className="es-estado al_dia">{r.al_dia} al día</span>
        <span className="es-estado proxima">{r.proxima} próximas</span>
        <span className="es-estado vencida">{r.vencida} atrasadas</span>
        {r.sin_datos > 0 && <span className="es-estado sin_datos">{r.sin_datos} sin datos</span>}
      </div>

      {GRUPOS.map((g) => {
        const items = esquema.items.filter((i) => i.tipo === g.tipo);
        if (!items.length) return null;
        return (
          <div key={g.tipo} className="es-grupo">
            <div className="es-grupo-tit"><i className={`ti ${g.icono}`} /> {g.titulo}</div>
            {items.map((it) => <Fila key={it.clave} it={it} />)}
          </div>
        );
      })}

      <p className="es-nota">{esquema.nota}</p>
    </div>
  );
}
