// =================================================================
// Archivo: src/pages/VeterinarioHistorialPage/VeterinarioHistorialPage.tsx
// RESPONSABILIDAD: Listado de todos los registros clínicos con
// buscador, filtro por días, crear/editar/eliminar.
// =================================================================
import { useEffect, useMemo, useState } from 'react';
import { historialService } from '../../services/historialService';
import type { RegistroHistorial } from '../../services/historialService';
import { mascotasService } from '../../services/mascotasService';
import type { Mascota } from '../../services/mascotasService';
import { useToast } from '../../components/Toast/ToastContext';
import { useAuth } from '../../context/AuthContext';
import FilterBar from '../../components/FilterBar/FilterBar';
import EmptyState from '../../components/EmptyState/EmptyState';
import Skeleton from '../../components/Skeleton/Skeleton';
import FiltroDias from '../../components/FiltroDias/FiltroDias';
import PesoControles from '../../components/PesoControles/PesoControles';
import { useFiltrosURL } from '../../hooks/useFiltrosURL';
import { dentroDeDias, enRango } from '../../utils/fechas';
import SelectorPaciente from '../../components/SelectorPaciente/SelectorPaciente';
import '../../assets/css/admin.css';
import FormulaImprimible from '../../components/FormulaImprimible/FormulaImprimible';
import { textoCitaControl } from '../../utils/citaControl';
import { LaboratorioDesplegable } from '../../components/LaboratorioPanel/LaboratorioPanel';
import HistoriaForm, {
FORM_VACIO, aPayload, desdeRegistro, validar,} from '../../components/HistoriaForm/HistoriaForm';
import type { FormHistoria } from '../../components/HistoriaForm/HistoriaForm';
import FormulaEditor from '../../components/FormulaEditor/FormulaEditor';
import { formulaAPayload, formulaDesdeRegistro, formulaVacia, validarFormula } from '../../components/FormulaEditor/formulaform';
import type { FormulaForm } from '../../components/FormulaEditor/formulaform';

// Filtros que se guardan en la URL: ?q=otitis&dias=30  (dias vacío = "Ver todo")
const FILTROS = { q: '', desde: '', hasta: '', dias: '' };

interface Campo {
  label: string;
  valor?: string | number | null;
}

function Campo({ label, valor }: Campo) {
  if (valor === null || valor === undefined || String(valor).trim() === '') return null;
  return (
    <div className="hist-campo">
      <label>{label}</label>
      <p>{valor}</p>
    </div>
  );
}

export default function VeterinarioHistorialPage() {
  const [registros, setRegistros] = useState<RegistroHistorial[]>([]);
  const [mascotasActivas, setMascotasActivas] = useState<Mascota[]>([]);
  const { filtros, setFiltro, limpiar, hayFiltros } = useFiltrosURL(FILTROS);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [form, setForm] = useState<FormHistoria>(FORM_VACIO);
  // Fórmula: medicamentos con su stock del inventario (Día 12).
  const [formula, setFormula] = useState<FormulaForm>(formulaVacia);
  const [guardando, setGuardando] = useState(false);
  // Regla de mascota nueva: sin consulta previa solo se permite anamnesis y examen.
  const [mascotaNueva, setMascotaNueva] = useState(false);

  const { mostrarToast, confirmar } = useToast();
  // El backend solo permite eliminar/desactivar al administrador (403 para veterinario).
  const { usuario } = useAuth();
  const esAdmin = usuario?.rol === 'administrador';

  async function cargar() {
    setCargando(true);
    setError('');
    try {
      // Igual que el original: intenta /historial/ y si viene vacío,
      // arma la lista mascota por mascota como respaldo.
      let data: RegistroHistorial[] = [];
      try {
        data = await historialService.todos();
      } catch {
        data = [];
      }

      if (!data.length) {
        const mascotas = await mascotasService.todas();
        const resultados = await Promise.all(
          mascotas.map(async (m) => {
            try {
              const historiales = await historialService.porMascota(m.idMascota);
              return historiales.map((h) => ({
                ...h,
                idMascota: h.idMascota || m.idMascota,
                nombre_mascota: h.nombre_mascota || m.nombre_mascota,
                especie: h.especie || m.especie,
              }));
            } catch {
              return [];
            }
          })
        );
        data = resultados.flat();
      }

      setRegistros(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar historial.');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  const filtrados = useMemo(() => {
    const q = filtros.q.trim().toLowerCase();
    return registros
      .filter((h) => h.estado !== 'inactivo')
      .filter((h) => dentroDeDias(h.fechaRegistro, filtros.dias))
      .filter((h) => enRango(h.fechaRegistro, filtros.desde, filtros.hasta))
      .filter((h) => {
        if (!q) return true;
        const valores = [
          h.nombre_mascota,
          h.diagnostico,
          h.motivo_consulta,
          h.tratamiento,
          h.observaciones,
          h.medicamentos,
          h.especie,
          h.formulas?.[0]?.recomendaciones,
        ];
        return valores.some((v) => String(v || '').toLowerCase().includes(q));
      })
      .sort(
        (a, b) =>
          new Date(b.fechaRegistro || 0).getTime() -
          new Date(a.fechaRegistro || 0).getTime()
      );
  }, [registros, filtros]);

  // Al elegir la mascota se consulta al backend si es nueva (sin consulta real previa).
  async function elegirMascota(valor: string) {
    setForm((f) => ({ ...f, idMascota: valor, diagnostico: '' }));
    setMascotaNueva(false);
    if (!valor) return;
    try {
      const estado = await historialService.esNueva(Number(valor));
      setMascotaNueva(estado.mascota_nueva);
      if (estado.mascota_nueva) {
        mostrarToast('Mascota nueva: en esta consulta solo se registra anamnesis y examen.', 'ok');
      }
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : 'No se pudo consultar el estado de la mascota.', 'error');
    }
  }

  async function abrirNuevo() {
    setEditandoId(null);
    setMascotaNueva(false);
    setForm(FORM_VACIO);
    setFormula(formulaVacia());
    const data = await mascotasService.todas().catch(() => []);
    setMascotasActivas(data.filter((m) => m.estado === 'activo'));
    setModalAbierto(true);
  }

  async function abrirEditar(id: number) {
    try {
      const data = await historialService.obtener(id);
      setEditandoId(id);
      setMascotaNueva(!!data.mascota_nueva);
      setForm(desdeRegistro(data));
      setFormula(formulaDesdeRegistro(data));
      const mascotas = await mascotasService.todas().catch(() => []);
      setMascotasActivas(mascotas.filter((m) => m.estado === 'activo'));
      setModalAbierto(true);
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : 'Error al cargar el historial.', 'error');
    }
  }

  async function guardar() {
    const idMascota = Number(form.idMascota);
    if (!idMascota) return mostrarToast('Selecciona una mascota.', 'error');
    const problema = validar(form);
    if (problema) return mostrarToast(problema, 'error');
    const problemaFormula = validarFormula(formula);
    if (problemaFormula) return mostrarToast(problemaFormula, 'error');

    // Con el diagnóstico bloqueado no se envía el campo (así no se pisa un
    // diagnóstico antiguo que el registro ya pudiera tener).
    const { diagnostico, ...resto } = aPayload(form);
    const base = mascotaNueva ? resto : { ...resto, diagnostico };
    const formulaPayload = formulaAPayload(formula);
    const payload = formulaPayload ? { ...base, formula: formulaPayload } : base;

    setGuardando(true);
    try {
      if (editandoId) {
        await historialService.actualizar(editandoId, payload);
        mostrarToast('Historial actualizado.', 'ok');
      } else {
        const creado = await historialService.crear({ ...payload, idMascota, estado: 'activo' });
        if (creado.seguimiento_creado && creado.idSeguimiento) {
          mostrarToast(
            `Registro creado para ${creado.nombre_mascota || 'la mascota'}. Seguimiento #${creado.idSeguimiento} generado correctamente.`,
            'ok'
          );
        } else if (creado.mascota_nueva) {
          mostrarToast('Primera consulta registrada. El diagnóstico se habilita en el siguiente control.', 'ok');
        } else {
          mostrarToast('Registro clínico creado. No existe una plantilla compatible para este diagnóstico.', 'ok');
        }
      }
      setModalAbierto(false);
      await cargar();
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : 'Error al guardar.', 'error');
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(id: number) {
    if (!await confirmar(`¿Eliminar el historial con id ${id}?`)) return;
    try {
      await historialService.eliminar(id);
      mostrarToast('Historial eliminado.', 'ok');
      await cargar();
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : 'Error al eliminar.', 'error');
    }
  }

  return (
    <section id="sec-historial" className="seccion activa">
      <div className="sec-header">
        <div>
          <div className="sec-titulo">Historial clínico</div>
          <div className="sec-subtitulo">Diagnósticos y fórmulas por mascota</div>
        </div>
        <button className="btn-nuevo" onClick={abrirNuevo}>
          <i className="ti ti-plus" /> Nuevo registro
        </button>
      </div>

      <FiltroDias
        dias={filtros.dias}
        onChange={(v) => {
          setFiltro('dias', v);
          setFiltro('desde', '');
          setFiltro('hasta', '');
        }}
      />

      <FilterBar
        busqueda={filtros.q}
        onBusqueda={(v) => setFiltro('q', v)}
        placeholder="Buscar por mascota o diagnóstico..."
        hayFiltros={hayFiltros}
        onLimpiar={limpiar}
      >
        <label className="filter-bar-fecha">
          Desde
          <input
            type="date"
            value={filtros.desde}
            max={filtros.hasta || undefined}
            onChange={(e) => {
              setFiltro('desde', e.target.value);
              setFiltro('dias', '');
            }}
          />
        </label>

        <label className="filter-bar-fecha">
          Hasta
          <input
            type="date"
            value={filtros.hasta}
            min={filtros.desde || undefined}
            onChange={(e) => {
              setFiltro('hasta', e.target.value);
              setFiltro('dias', '');
            }}
          />
        </label>
      </FilterBar>

      {cargando && (
        <div className="skeleton-lista">
          <Skeleton variante="fila" cantidad={4} />
        </div>
      )}


      {!cargando && error && (
        <EmptyState
          icono="ti-wifi-off"
          mensaje={error}
          accion={<button onClick={cargar}>Reintentar</button>}
        />
      )}

      {!cargando && !error && (
        <p className="conteo">{filtrados.length} registro(s) encontrado(s)</p>
      )}

      <div className="hist-lista">

        {!cargando && !error && !filtrados.length && (
          <EmptyState
            icono="ti-clipboard-list"
            mensaje={
              hayFiltros
                ? 'Ningún registro coincide con los filtros'
                : 'Sin registros clínicos'
            }
            accion={
              hayFiltros ? (
                <button onClick={limpiar}>Limpiar filtros</button>
              ) : undefined
            }
          />
        )}

        {!cargando &&
          !error &&
          filtrados.map((h) => {
            const d = new Date(h.fechaRegistro);
            const fecha = isNaN(d.getTime())
              ? 'Sin fecha'
              : d.toLocaleDateString('es-CO', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                });
            const nombreMascota =
              h.nombre_mascota || `Mascota ID: ${h.idMascota || ''}`;
            const formula = h.formulas?.[0];
            const textoFormula = formula?.medicamentos?.length
              ? formula.medicamentos
                  .map((m) => `${m.nombre_medicamento} — ${m.dosis}, ${m.frecuencia}, ${m.duracion_dias} día(s)`)
                  .join(' | ')
              : [h.tratamiento, h.medicamentos].filter(Boolean).join(' · ');

            return (
              <div className="hist-card" key={h.idHistorial}>
                <div className="hist-header">
                  <span className="hist-fecha">
                    <i className="ti ti-calendar" /> {fecha}
                  </span>
                  <span className="hist-mascota">
                    <i className="ti ti-paw" /> {nombreMascota}
                    {h.especie ? ` · ${h.especie}` : ''}
                  </span>
                </div>

                <Campo label="Motivo" valor={h.motivo_consulta} />
                <Campo label="Diagnóstico" valor={h.diagnostico} />
                <Campo label="Fórmula" valor={textoFormula} />
                <Campo label="Recomendaciones" valor={formula?.recomendaciones} />
                <Campo label="Cita de control" valor={textoCitaControl(h.cita_control)} />
                <Campo label="Peso" valor={h.peso_consulta ? `${h.peso_consulta} kg` : ''} />
                <Campo
                  label="Temperatura"
                  valor={h.temperatura ? `${h.temperatura} °C` : ''}
                />
                <Campo label="Observaciones" valor={h.observaciones} />
                <Campo label="Próxima cita" valor={h.proxima_cita} />

                <div className="hist-acciones">
                  <button onClick={() => abrirEditar(h.idHistorial)}>
                    <i className="ti ti-edit" /> Editar
                  </button>
                  {formula && <FormulaImprimible registro={h} formula={formula} />}

                  {esAdmin && (
                    <button
                      className="btn-del"
                      onClick={() => eliminar(h.idHistorial)}
                    >
                      <i className="ti ti-trash" /> Eliminar
                    </button>
                  )}
                </div>
                <LaboratorioDesplegable idHistorial={h.idHistorial} modo="veterinario" />
              </div>
            );
          })}
      </div>

      <div className={`modal-fondo${modalAbierto ? ' abierto' : ''}`}>
        <div className="modal-caja modal-historia">
          <div className="modal-titulo-fila">
            <div className="modal-titulo">
              {editandoId ? 'Editar registro clínico' : 'Nuevo registro clínico'}
            </div>

            <button
              className="btn-cerrar"
              onClick={() => setModalAbierto(false)}
            >
              <i className="ti ti-x" />
            </button>
          </div>

          <SelectorPaciente
            mascotas={mascotasActivas}
            valor={form.idMascota}
            onChange={elegirMascota}
            disabled={!!editandoId}
          />
          
          <PesoControles idMascota={Number(form.idMascota)} />
          <HistoriaForm
            form={form}
            onChange={(campo, valor) => setForm((f) => ({ ...f, [campo]: valor }))}
            diagnosticoBloqueado={mascotaNueva}
          />
          <FormulaEditor value={formula} onChange={setFormula} />
          <div className="modal-pie">
            <button
              className="btn-cancelar"
              onClick={() => setModalAbierto(false)}
            >
              Cancelar
            </button>

            <button
              className="btn-guardar"
              onClick={guardar}
              disabled={guardando}
            >
              <i className="ti ti-device-floppy" />{' '}
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}