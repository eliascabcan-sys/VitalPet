// =================================================================
// Archivo: src/pages/VeterinarioAgendaPage/VeterinarioAgendaPage.tsx
// RESPONSABILIDAD: Agenda del veterinario (y del administrador, que elige
// de quién ver la agenda). Tres vistas — Día, Semana y Mes — y un panel
// fijo con las citas por asignar. Pensada para empezar el día aquí:
// qué franjas hay, cuántos cupos quedan y quién viene.
// =================================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import { citasService } from '../../services/citasService';
import type { Agenda, CitaAgenda } from '../../services/citasService';
import { veterinariosService } from '../../services/veterinariosService';
import type { Veterinario } from '../../services/veterinariosService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/Toast/ToastContext';
import EmptyState from '../../components/EmptyState/EmptyState';
import Skeleton from '../../components/Skeleton/Skeleton';
import CalendarioMes from '../../components/CalendarioMes/CalendarioMes';
import DiaDetalle from '../../components/AgendaVet/DiaDetalle';
import SemanaVista from '../../components/AgendaVet/SemanaVista';
import PorAsignarPanel from '../../components/AgendaVet/PorAsignarPanel';
import { aISO, capitalizar, diaLargo, nombreMes, rangoSemana, sumarDias, sumarMeses } from '../../components/AgendaVet/fechas';
import '../../assets/css/admin.css';
import '../../components/AgendaVet/AgendaVet.css';

type Vista = 'dia' | 'semana' | 'mes';
const VISTAS: { valor: Vista; etiqueta: string }[] = [
  { valor: 'dia', etiqueta: 'Día' },
  { valor: 'semana', etiqueta: 'Semana' },
  { valor: 'mes', etiqueta: 'Mes' },
];

export default function VeterinarioAgendaPage() {
  const { usuario } = useAuth();
  const { mostrarToast, confirmar } = useToast();
  const esAdmin = usuario?.rol === 'administrador';
  const hoy = aISO(new Date());

  const [vista, setVista] = useState<Vista>('dia');
  const [fecha, setFecha] = useState(hoy);
  const [vets, setVets] = useState<Veterinario[]>([]);
  const [idVet, setIdVet] = useState('');
  const [agenda, setAgenda] = useState<Agenda | null>(null);
  const [sinAsignar, setSinAsignar] = useState<CitaAgenda[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const selectorFecha = useRef<HTMLInputElement>(null);

  // El administrador elige de qué veterinario ve la agenda.
  useEffect(() => {
    if (!esAdmin) return;
    veterinariosService.listar(false).then((v) => {
      setVets(v);
      if (v.length) setIdVet(String(v[0].idVeterinario));
    }).catch(() => mostrarToast('No se pudo cargar la lista de veterinarios.', 'error'));
  }, [esAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  const cargar = useCallback(async () => {
    if (esAdmin && !idVet) return;
    setCargando(true);
    setError('');
    try {
      const [a, s] = await Promise.all([
        citasService.agenda(vista, fecha, esAdmin ? Number(idVet) : undefined),
        citasService.sinAsignar(),
      ]);
      setAgenda(a);
      setSinAsignar(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la agenda.');
    } finally {
      setCargando(false);
    }
  }, [vista, fecha, idVet, esAdmin]);

  useEffect(() => { cargar(); }, [cargar]);

  async function asignar(c: CitaAgenda, confirmarCita: boolean) {
    if (!agenda) return;
    const quien = esAdmin ? agenda.nombre_veterinario || 'este veterinario' : 'ti';
    if (!(await confirmar(`¿Asignar la cita de ${c.nombre_mascota || 'la mascota'} a ${quien}?`))) return;
    try {
      await citasService.asignar(c.idCita, agenda.idVeterinario, confirmarCita);
      mostrarToast(confirmarCita ? 'Cita asignada y confirmada.' : 'Cita asignada.', 'ok');
      await cargar();
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : 'No se pudo asignar la cita.', 'error');
    }
  }

  const irADia = (iso: string) => {
    setFecha(iso);
    setVista('dia');
  };

  const mover = (dir: -1 | 1) =>
    setFecha((f) => (vista === 'mes' ? sumarMeses(f, dir) : sumarDias(f, dir * (vista === 'semana' ? 7 : 1))));

  const abrirSelector = () => {
    try { selectorFecha.current?.showPicker(); } catch { selectorFecha.current?.focus(); }
  };

  // Texto del centro de la barra: cambia según la vista.
  const titulo = capitalizar(
    vista === 'dia' ? diaLargo(fecha)
    : vista === 'mes' ? nombreMes(fecha)
    : agenda ? rangoSemana(agenda.desde, agenda.hasta) : '',
  );

  // Citas por asignar que caen en el periodo que se está mirando, y cuántas hay cada día.
  const porAsignarPorDia = sinAsignar.reduce<Record<string, number>>((acc, c) => {
    const dia = aISO(new Date(c.fechaHora));
    acc[dia] = (acc[dia] || 0) + 1;
    return acc;
  }, {});
  const porAsignarEnPeriodo = agenda
    ? sinAsignar.filter((c) => { const d = aISO(new Date(c.fechaHora)); return d >= agenda.desde && d <= agenda.hasta; }).length
    : 0;

  const diaElegido = agenda?.dias.find((d) => d.fecha === fecha);
  const esHoyEnDia = vista === 'dia' && fecha === hoy;

  return (
    <section className="seccion activa">
      <div className="sec-header">
        <div>
          <div className="sec-titulo">Agenda</div>
          <div className="sec-subtitulo">
            {agenda?.nombre_veterinario ? `Agenda de ${agenda.nombre_veterinario}` : 'Tus citas, franjas y cupos'}
          </div>
        </div>
      </div>

      <div className="av-controles">
        <div className="av-grupo">
          <div className="av-segmentado" role="group" aria-label="Cambiar vista">
            {VISTAS.map((v) => (
              <button
                key={v.valor}
                type="button"
                className={vista === v.valor ? 'activo' : ''}
                aria-pressed={vista === v.valor}
                onClick={() => setVista(v.valor)}
              >
                {v.etiqueta}
              </button>
            ))}
          </div>
          {esAdmin && (
            <select className="av-vet" aria-label="Veterinario" value={idVet} onChange={(e) => setIdVet(e.target.value)}>
              {vets.map((v) => (
                <option key={v.idVeterinario} value={v.idVeterinario}>{`${v.nombre || ''} ${v.apellido || ''}`.trim()}</option>
              ))}
            </select>
          )}
        </div>

        <div className="av-grupo">
          <div className="av-nav">
            <button type="button" className="av-nav-btn" onClick={() => mover(-1)} aria-label="Anterior">‹</button>
            <button type="button" className="av-fecha" onClick={abrirSelector} title="Elegir una fecha">
              {titulo || '…'}
              <input
                ref={selectorFecha}
                type="date"
                tabIndex={-1}
                value={fecha}
                onChange={(e) => e.target.value && setFecha(e.target.value)}
                aria-hidden="true"
              />
            </button>
            <button type="button" className="av-nav-btn" onClick={() => mover(1)} aria-label="Siguiente">›</button>
          </div>
          <button type="button" className="av-hoy" onClick={() => setFecha(hoy)} disabled={esHoyEnDia}>Hoy</button>
        </div>
      </div>

      {agenda && !cargando && !error && (
        <div className="av-resumen">
          <span className="av-dato"><b>{agenda.total_citas}</b> cita(s) asignadas</span>
          {porAsignarEnPeriodo > 0 && <span className="av-dato alerta"><b>{porAsignarEnPeriodo}</b> por asignar en este periodo</span>}
        </div>
      )}

      <div className="av-layout">
        <div>
          {cargando && <Skeleton variante="fila" cantidad={4} />}
          {!cargando && error && <EmptyState icono="ti-wifi-off" mensaje={error} accion={<button onClick={cargar}>Reintentar</button>} />}

          {!cargando && !error && agenda && (
            <>
              {vista === 'dia' && agenda.dias[0] && <DiaDetalle dia={agenda.dias[0]} />}

              {vista === 'semana' && (
                <SemanaVista agenda={agenda} hoy={hoy} porAsignar={porAsignarPorDia} onIrADia={irADia} />
              )}

              {vista === 'mes' && (
                <>
                  <CalendarioMes agenda={agenda} seleccionado={fecha} hoy={hoy} onSeleccionar={setFecha} porAsignar={porAsignarPorDia} />
                  <div className="cm-leyenda">
                    <span className="l-con">Con citas</span>
                    <span className="l-alto">Casi lleno</span>
                    <span className="l-lleno">Lleno</span>
                    <span className="l-cerrado">Cerrado (domingo)</span>
                    <span className="l-asignar">Citas por asignar</span>
                  </div>
                  {diaElegido && (
                    <>
                      <h3 className="av-dia-elegido">{capitalizar(diaLargo(diaElegido.fecha))}</h3>
                      <DiaDetalle dia={diaElegido} />
                    </>
                  )}
                </>
              )}
            </>
          )}
        </div>

        <PorAsignarPanel citas={sinAsignar} onAsignar={asignar} onIrADia={irADia} />
      </div>
    </section>
  );
}