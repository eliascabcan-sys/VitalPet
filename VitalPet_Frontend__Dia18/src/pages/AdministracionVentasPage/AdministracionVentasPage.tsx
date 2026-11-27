// =================================================================
// Archivo: src/pages/AdministracionVentasPage/AdministracionVentasPage.tsx
// RESPONSABILIDAD: Ventas de la clínica. Ruta compartida:
//  - Administrador: ve TODAS las ventas, las marca como pagadas o las
//    cancela (se repone el stock), y registra ventas en mostrador.
//  - Veterinario: registra ventas a nombre de un dueño (el backend solo
//    le lista sus propias compras).
// Endpoints: /ventas/, /ventas/mias, /users/duenos, /products/
// =================================================================
import { useEffect, useMemo, useState } from 'react';
import { ventasService } from '../../services/ventasService';
import type { Venta } from '../../services/ventasService';
import { catalogoService } from '../../services/catalogoService';
import type { Producto } from '../../services/catalogoService';
import { usersService } from '../../services/usersService';
import type { UsuarioAdmin } from '../../services/usersService';
import { useToast } from '../../components/Toast/ToastContext';
import { useAuth } from '../../context/AuthContext';
import AdminModal from '../../components/AdminModal/AdminModal';
import FilterBar from '../../components/FilterBar/FilterBar';
import EmptyState from '../../components/EmptyState/EmptyState';
import Skeleton from '../../components/Skeleton/Skeleton';
import { useFiltrosURL } from '../../hooks/useFiltrosURL';
import { enRango } from '../../utils/fechas';
import '../../assets/css/admin.css';
import '../../assets/css/administracion.css';

// Filtros que se guardan en la URL: ?q=maria&estado=pendiente&desde=2026-09-01
const FILTROS = { q: '', estado: '', desde: '', hasta: '' };

const dinero = (n: number | string) => `$${Number(n).toLocaleString('es-CO')}`;

interface Linea {
  idProducto: string;
  cantidad: string;
}
const LINEA_VACIA: Linea = { idProducto: '', cantidad: '1' };

export default function AdministracionVentasPage() {
  const { usuario } = useAuth();
  const esAdmin = usuario?.rol === 'administrador';
  const { mostrarToast, confirmar } = useToast();

  const [ventas, setVentas] = useState<Venta[]>([]);
  const [duenos, setDuenos] = useState<UsuarioAdmin[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const { filtros, setFiltro, limpiar, hayFiltros } = useFiltrosURL(FILTROS);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [clienteId, setClienteId] = useState('');
  const [lineas, setLineas] = useState<Linea[]>([LINEA_VACIA]);
  const [idHistorial, setIdHistorial] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    setCargando(true);
    setError('');
    try {
      const [vs, ds, ps] = await Promise.all([
        esAdmin ? ventasService.todas() : ventasService.mias(),
        usersService.duenos().catch(() => [] as UsuarioAdmin[]),
        catalogoService.productos(),
      ]);
      setVentas([...vs].sort((a, b) => b.idVenta - a.idVenta));
      setDuenos(ds);
      setProductos(ps);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar las ventas.');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nombreCliente = (id: number) => {
    const d = duenos.find((x) => x.idUsuario === id);
    return d ? `${d.nombre} ${d.apellido}` : `Usuario #${id}`;
  };

  const filtradas = useMemo(() => {
    const q = filtros.q.trim().toLowerCase();

    return ventas.filter(
      (v) =>
        (!filtros.estado || v.estado === filtros.estado) &&
        enRango(v.fecha, filtros.desde, filtros.hasta) &&
        (!q ||
          String(v.idVenta) === q ||
          nombreCliente(v.idUsuario).toLowerCase().includes(q))
    );

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ventas, duenos, filtros]);

  const totalPagado = ventas
    .filter((v) => v.estado === 'pagada')
    .reduce((s, v) => s + Number(v.total), 0);

  const pendientes = ventas.filter((v) => v.estado === 'pendiente').length;

  // ---------- Nueva venta ----------
  const productoDe = (id: string) => productos.find((p) => String(p.idProducto) === id);
  const requiereReceta = lineas.some((l) => productoDe(l.idProducto)?.requierePrescripcion);

  const totalNueva = lineas.reduce((s, l) => {
    const p = productoDe(l.idProducto);
    return s + (p ? Number(p.precio) * (Number(l.cantidad) || 0) : 0);
  }, 0);

  function abrirNueva() {
    setClienteId('');
    setLineas([LINEA_VACIA]);
    setIdHistorial('');
    setModalAbierto(true);
  }

  function cambiarLinea(i: number, cambio: Partial<Linea>) {
    setLineas((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...cambio } : l)));
  }

  async function registrarVenta() {
    if (!clienteId) return mostrarToast('Selecciona el cliente (dueño).', 'error');

    // Une líneas repetidas del mismo producto para que el stock se valide sobre el total.
    const acumulado = new Map<number, number>();

    for (const l of lineas) {
      if (!l.idProducto) return mostrarToast('Hay una línea sin producto.', 'error');

      const cant = Number(l.cantidad);

      if (!Number.isInteger(cant) || cant < 1) {
        return mostrarToast('La cantidad debe ser un entero mayor a 0.', 'error');
      }

      const id = Number(l.idProducto);
      acumulado.set(id, (acumulado.get(id) || 0) + cant);
    }

    let historial: number | null = null;

    if (requiereReceta) {
      historial = Number(idHistorial);

      if (!Number.isInteger(historial) || historial < 1) {
        return mostrarToast(
          'Un producto requiere prescripción: indica el ID del historial clínico.',
          'error'
        );
      }
    }

    setGuardando(true);

    try {
      await ventasService.crear({
        idUsuario: Number(clienteId),
        items: [...acumulado.entries()].map(([idProducto, cantidad]) => ({
          idProducto,
          cantidad,
        })),
        idHistorial: historial,
      });

      mostrarToast('Venta registrada.', 'ok');
      setModalAbierto(false);
      await cargar();
    } catch (err) {
      mostrarToast(
        err instanceof Error ? err.message : 'No se pudo registrar la venta.',
        'error'
      );
    } finally {
      setGuardando(false);
    }
  }

  // ---------- Acciones del administrador ----------
  async function marcarPagada(v: Venta) {
    try {
      await ventasService.cambiarEstado(v.idVenta, 'pagada');
      mostrarToast(`Venta #${v.idVenta} marcada como pagada.`, 'ok');
      await cargar();
    } catch (err) {
      mostrarToast(
        err instanceof Error ? err.message : 'No se pudo actualizar.',
        'error'
      );
    }
  }

  async function cancelar(v: Venta) {
    if (!await confirmar(`¿Cancelar la venta #${v.idVenta}? Se repondrá el stock de los productos.`)) {
      return;
    }

    try {
      await ventasService.cancelar(v.idVenta);
      mostrarToast(`Venta #${v.idVenta} cancelada.`, 'ok');
      await cargar();
    } catch (err) {
      mostrarToast(
        err instanceof Error ? err.message : 'No se pudo cancelar.',
        'error'
      );
    }
  }

  return (
    <section className="seccion activa">
      <div className="sec-header">
        <div>
          <div className="sec-titulo">Ventas</div>
          <div className="sec-subtitulo">
            {esAdmin
              ? 'Historial de ventas y cobros'
              : 'Registra ventas en mostrador. El historial completo lo ve el administrador.'}
          </div>
        </div>

        <button className="btn-nuevo" onClick={abrirNueva}>
          <i className="ti ti-plus" /> Nueva venta
        </button>
      </div>

      {esAdmin && (
        <div className="stats">
          <div className="stat">
            <div className="stat-icono">
              <i className="ti ti-receipt" />
            </div>
            <div>
              <div className="stat-label">Ventas</div>
              <div className="stat-valor">{ventas.length}</div>
            </div>
          </div>

          <div className="stat">
            <div className="stat-icono verde">
              <i className="ti ti-cash" />
            </div>
            <div>
              <div className="stat-label">Total cobrado</div>
              <div className="stat-valor verde">{dinero(totalPagado)}</div>
            </div>
          </div>

          <div className="stat">
            <div className="stat-icono acento">
              <i className="ti ti-clock" />
            </div>
            <div>
              <div className="stat-label">Pendientes de pago</div>
              <div className="stat-valor acento">{pendientes}</div>
            </div>
          </div>
        </div>
      )}

      <FilterBar
        busqueda={filtros.q}
        onBusqueda={(v) => setFiltro('q', v)}
        placeholder="Buscar por cliente o N.º de venta..."
        hayFiltros={hayFiltros}
        onLimpiar={limpiar}
      >
        <select
          className="filtro"
          value={filtros.estado}
          onChange={(e) => setFiltro('estado', e.target.value)}
        >
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="pagada">Pagada</option>
          <option value="cancelada">Cancelada</option>
        </select>

        <label className="filter-bar-fecha">
          Desde
          <input
            type="date"
            value={filtros.desde}
            max={filtros.hasta || undefined}
            onChange={(e) => setFiltro('desde', e.target.value)}
          />
        </label>

        <label className="filter-bar-fecha">
          Hasta
          <input
            type="date"
            value={filtros.hasta}
            min={filtros.desde || undefined}
            onChange={(e) => setFiltro('hasta', e.target.value)}
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
        <p className="conteo">{filtradas.length} venta(s)</p>
      )}

      <div className="hist-lista">

        {!cargando && !error && !filtradas.length && (
          <EmptyState
            icono="ti-receipt-off"
            mensaje={
              hayFiltros
                ? 'Ninguna venta coincide con los filtros'
                : 'No hay ventas para mostrar'
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
          filtradas.map((v) => (
            <div className="hist-fila" key={v.idVenta}>
              <div className="hist-top">
                <div>
                  <strong>Venta #{v.idVenta}</strong>
                  <div className="adm-sub">
                    {nombreCliente(v.idUsuario)} ·{' '}
                    {new Date(v.fecha).toLocaleString('es-CO')}
                    {v.idHistorial ? ` · Historial #${v.idHistorial}` : ''}
                  </div>
                </div>

                <span className={`chip ${v.estado || 'pendiente'}`}>
                  {v.estado || 'pendiente'}
                </span>
              </div>

              {v.detalles.map((d) => (
                <div className="adm-detalle" key={d.idDetalleVenta}>
                  <span>
                    {d.cantidad} × {d.nombre_producto || `Producto #${d.idProducto}`}
                  </span>
                  <span>{dinero(d.subtotal)}</span>
                </div>
              ))}

              <div className="adm-total">
                <span>Total</span>
                <span className="venta-valor">{dinero(v.total)}</span>
              </div>

              {esAdmin && v.estado !== 'cancelada' && (
                <div className="hist-acciones">
                  {v.estado === 'pendiente' && (
                    <button onClick={() => marcarPagada(v)}>
                      <i className="ti ti-check" /> Marcar pagada
                    </button>
                  )}

                  <button className="btn-del" onClick={() => cancelar(v)}>
                    <i className="ti ti-x" /> Cancelar
                  </button>
                </div>
              )}
            </div>
          ))}
      </div>

      <AdminModal
        abierto={modalAbierto}
        titulo="Nueva venta"
        ancho={460}
        onClose={() => setModalAbierto(false)}
        pie={
          <>
            <button
              className="btn-cancelar"
              onClick={() => setModalAbierto(false)}
            >
              Cancelar
            </button>

            <button
              className="btn-guardar"
              onClick={registrarVenta}
              disabled={guardando}
            >
              <i className="ti ti-device-floppy" />{' '}
              {guardando ? 'Registrando...' : 'Registrar venta'}
            </button>
          </>
        }
      >
        <div className="campo">
          <label>Cliente (dueño)</label>
          <select
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
          >
            <option value="">Seleccionar...</option>

            {duenos.map((d) => (
              <option key={d.idUsuario} value={d.idUsuario}>
                {d.nombre} {d.apellido} — {d.email}
              </option>
            ))}
          </select>
          {!duenos.length && (
            <div className="adm-ayuda">
              No hay dueños disponibles. Registra un dueño o revisa que el backend esté corriendo.
            </div>
          )}
        </div>

        <div className="campo" style={{ marginBottom: 6 }}>
          <label>Productos</label>
        </div>

        {lineas.map((l, i) => (
          <div className="adm-linea" key={i}>
            <select
              value={l.idProducto}
              onChange={(e) =>
                cambiarLinea(i, { idProducto: e.target.value })
              }
            >
              <option value="">Producto...</option>

              {productos.map((p) => (
                <option
                  key={p.idProducto}
                  value={p.idProducto}
                  disabled={p.stock === 0}
                >
                  {p.nombre_producto} — {dinero(p.precio)} (stock {p.stock})
                </option>
              ))}
            </select>

            <input
              type="number"
              min="1"
              step="1"
              value={l.cantidad}
              onChange={(e) =>
                cambiarLinea(i, { cantidad: e.target.value })
              }
            />

            <button
              className="btn-ico rojo"
              title="Quitar"
              disabled={lineas.length === 1}
              onClick={() =>
                setLineas((ls) => ls.filter((_, idx) => idx !== i))
              }
            >
              <i className="ti ti-trash" />
            </button>
          </div>
        ))}

        <button
          className="btn-cancelar"
          style={{ width: '100%', marginBottom: 10 }}
          onClick={() => setLineas((ls) => [...ls, LINEA_VACIA])}
        >
          <i className="ti ti-plus" /> Agregar producto
        </button>

        {requiereReceta && (
          <div className="campo">
            <label>ID del historial clínico (prescripción)</label>
            <input
              type="number"
              min="1"
              value={idHistorial}
              onChange={(e) => setIdHistorial(e.target.value)}
            />

            <div className="adm-ayuda">
              Uno de los productos requiere prescripción. Debe ser un historial
              activo de una mascota de este dueño y no haberse usado en otra venta.
            </div>
          </div>
        )}

        <div className="adm-total">
          <span>Total estimado</span>
          <span className="venta-valor">{dinero(totalNueva)}</span>
        </div>
      </AdminModal>
    </section>
  );
}