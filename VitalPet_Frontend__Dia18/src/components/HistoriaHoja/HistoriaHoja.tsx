// =================================================================
// Archivo: src/components/HistoriaHoja/HistoriaHoja.tsx
// RESPONSABILIDAD: Muestra UN registro de historial clínico como una
// hoja tipo Word, con menú lateral que desplaza a cada sección y
// resalta la sección visible.
// =================================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import type { RegistroHistorial } from '../../services/historialService';
import FormulaImprimible from '../FormulaImprimible/FormulaImprimible';
import { textoCitaControl } from '../../utils/citaControl';
import LaboratorioPanel from '../LaboratorioPanel/LaboratorioPanel';
import './HistoriaHoja.css';

interface Seccion {
  id: string;
  titulo: string;
  mostrar: (h: RegistroHistorial) => boolean;
  render: (h: RegistroHistorial) => React.ReactNode;
}

const texto = (v?: string | number | null) =>
  v !== undefined && v !== null && String(v).trim() !== '' ? <p>{v}</p> : <p className="hh-vacio">Sin información registrada.</p>;

const delTipo = (h: RegistroHistorial, tipo: string) =>
  h.secciones?.find((s) => s.tipo === tipo)?.contenido?.trim() || '';

const SECCIONES: Seccion[] = [
  {
    id: 'paciente',
    titulo: 'Datos del paciente',
    mostrar: () => true,
    render: (h) => (
      <table className="hh-tabla">
        <tbody>
          <tr><td className="k">Paciente</td><td>{h.nombre_mascota || '—'}</td><td className="k">Especie</td><td>{h.especie || '—'}</td></tr>
          <tr>
            <td className="k">Fecha</td>
            <td colSpan={3}>{h.fechaRegistro ? new Date(h.fechaRegistro).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}</td>
          </tr>
        </tbody>
      </table>
    ),
  },
  { id: 'motivo', titulo: 'Motivo de consulta', mostrar: () => true, render: (h) => texto(h.motivo_consulta) },
  { id: 'anamnesis', titulo: 'Anamnesis', mostrar: () => true, render: (h) => texto(delTipo(h, 'anamnesis')) },
  {
    id: 'examen',
    titulo: 'Examen clínico',
    mostrar: () => true,
    render: (h) => (
      <>
        <table className="hh-tabla">
          <tbody>
            <tr>
              <td className="k">Peso</td><td>{h.peso_consulta != null ? `${h.peso_consulta} kg` : '—'}</td>
              <td className="k">Temperatura</td><td>{h.temperatura != null ? `${h.temperatura} °C` : '—'}</td>
            </tr>
            <tr>
              <td className="k">Frec. cardiaca</td><td>{h.frecuencia_cardiaca != null ? `${h.frecuencia_cardiaca} lpm` : '—'}</td>
              <td className="k">Frec. respiratoria</td><td>{h.frecuencia_respiratoria != null ? `${h.frecuencia_respiratoria} rpm` : '—'}</td>
            </tr>
            <tr>
              <td className="k">Mucosas</td><td>{h.mucosas || '—'}</td>
              <td className="k">TLLC</td><td>{h.tllc_seg != null ? `${h.tllc_seg} s` : '—'}</td>
            </tr>
            <tr>
              <td className="k">Hidratación</td><td>{h.hidratacion || '—'}</td>
              <td className="k">Condición corporal</td><td>{h.condicion_corporal != null ? `${h.condicion_corporal}/9` : '—'}</td>
            </tr>
          </tbody>
        </table>
        {delTipo(h, 'examen_fisico') && <p>{delTipo(h, 'examen_fisico')}</p>}
      </>
    ),
  },
  { id: 'diagnostico', titulo: 'Diagnóstico', mostrar: () => true, render: (h) => texto(h.diagnostico) },
  {
    id: 'formula',
    titulo: 'Fórmula',
    mostrar: () => true,
    render: (h) => {
      const f = h.formulas?.[0];
      if (!f?.medicamentos?.length) {
        // Registros antiguos: texto libre de "Tratamiento"/"Medicamentos"
        return texto([h.tratamiento, h.medicamentos].filter(Boolean).join('\n'));
      }
      return (
        <>
          <table className="hh-tabla">
            <thead>
              <tr><th>Medicamento</th><th>Dosis</th><th>Frecuencia</th><th>Duración</th></tr>
            </thead>
            <tbody>
              {f.medicamentos.map((m) => (
                <tr key={m.idFormulaMedicamento}>
                  <td>{m.nombre_medicamento}{m.presentacion ? ` (${m.presentacion})` : ''}</td>
                  <td>{m.dosis}{m.via_administracion ? ` · ${m.via_administracion}` : ''}</td>
                  <td>{m.frecuencia}</td>
                  <td>{m.duracion_dias} día(s)</td>
                </tr>
              ))}
            </tbody>
          </table>
          {f.recomendaciones && <p><strong>Recomendaciones:</strong> {f.recomendaciones}</p>}
          {h.cita_control && <p><strong>Cita de control:</strong> {textoCitaControl(h.cita_control)}</p>}
          <FormulaImprimible registro={h} formula={f} />
        </>
      );
    },
  },
  {
    id: 'laboratorio',
    titulo: 'Laboratorio',
    mostrar: () => true,
    render: (h) => <LaboratorioPanel idHistorial={h.idHistorial} modo="dueno" />,
  },
  { id: 'procedimientos', titulo: 'Procedimientos', mostrar: (h) => !!delTipo(h, 'procedimientos'), render: (h) => texto(delTipo(h, 'procedimientos')) },
  { id: 'inyectologia', titulo: 'Inyectología', mostrar: (h) => !!delTipo(h, 'inyectologia'), render: (h) => texto(delTipo(h, 'inyectologia')) },
  { id: 'observaciones', titulo: 'Observaciones', mostrar: () => true, render: (h) => texto(h.observaciones) },
  { id: 'proxima', titulo: 'Próxima cita', mostrar: (h) => !!h.proxima_cita, render: (h) => texto(h.proxima_cita) },
];

interface Props {
  registro: RegistroHistorial;
}

export default function HistoriaHoja({ registro }: Props) {
  const secciones = useMemo(() => SECCIONES.filter((s) => s.mostrar(registro)), [registro]);
  const [activa, setActiva] = useState(secciones[0]?.id ?? '');
  const escritorio = useRef<HTMLDivElement>(null);

  // Resalta en el menú la sección que está a la vista.
  useEffect(() => {
    const raiz = escritorio.current;
    if (!raiz) return;
    const obs = new IntersectionObserver(
      (entradas) => {
        const visible = entradas.find((e) => e.isIntersecting);
        if (visible) setActiva(visible.target.id.replace('hh-', ''));
      },
      { root: raiz, rootMargin: '0px 0px -70% 0px' }
    );
    secciones.forEach((s) => {
      const el = raiz.querySelector(`#hh-${s.id}`);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [secciones]);

  function irA(id: string) {
    setActiva(id);
    escritorio.current?.querySelector(`#hh-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="hh-layout">
      <nav className="hh-menu" aria-label="Secciones de la historia clínica">
        <h4>Secciones</h4>
        {secciones.map((s) => (
          <button key={s.id} type="button" className={`hh-item${activa === s.id ? ' activo' : ''}`} onClick={() => irA(s.id)}>
            {s.titulo}
          </button>
        ))}
      </nav>
      <div className="hh-escritorio" ref={escritorio}>
        <article className="hh-hoja">
          <h2 className="hh-titulo">Historia clínica</h2>
          <p className="hh-subtitulo">VitalPet · Registro #{registro.idHistorial}</p>
          {secciones.map((s) => (
            <section key={s.id} id={`hh-${s.id}`} className="hh-seccion">
              <h3>{s.titulo}</h3>
              {s.render(registro)}
            </section>
          ))}
        </article>
      </div>
    </div>
  );
}