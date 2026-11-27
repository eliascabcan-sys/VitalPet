// =================================================================
// Archivo: src/pages/AdministracionCatalogoPage/AdministracionCatalogoPage.tsx
// RESPONSABILIDAD: Catálogo de la clínica: productos (precio, stock,
// si requieren prescripción) y categorías. Solo administrador.
// Endpoints: /products/ y /categorias/ (GET, POST, PUT, DELETE lógico)
// =================================================================
import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import { catalogoService } from '../../services/catalogoService';
import type { Categoria, Producto } from '../../services/catalogoService';
import { useToast } from '../../components/Toast/ToastContext';
import AdminModal from '../../components/AdminModal/AdminModal';
import FilterBar from '../../components/FilterBar/FilterBar';
import EmptyState from '../../components/EmptyState/EmptyState';
import Skeleton from '../../components/Skeleton/Skeleton';
import { useFiltrosURL } from '../../hooks/useFiltrosURL';
import '../../assets/css/admin.css';
import '../../assets/css/administracion.css';

type Pestana = 'productos' | 'categorias';

const STOCK_BAJO = 5;

// Filtros que se guardan en la URL: ?q=shampoo&categoria=2&stock=bajo
// (la pestaña Productos / Categorías sigue siendo estado local)
const FILTROS = { q: '', categoria: '', stock: '' };

const dinero = (n: number | string) => `$${Number(n).toLocaleString('es-CO')}`;

const FORM_PRODUCTO_VACIO = { nombre: '', idCategoria: '', precio: '', stock: '', requierePrescripcion: false };

export default function AdministracionCatalogoPage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const [pestana, setPestana] = useState<Pestana>('productos');
  const { filtros, setFiltro, limpiar, hayFiltros } = useFiltrosURL(FILTROS);

  const [modalProducto, setModalProducto] = useState(false);
  const [editandoProducto, setEditandoProducto] = useState<Producto | null>(null);
  const [formProducto, setFormProducto] = useState(FORM_PRODUCTO_VACIO);

  const [modalCategoria, setModalCategoria] = useState(false);
  const [editandoCategoria, setEditandoCategoria] = useState<Categoria | null>(null);
  const [nombreCategoria, setNombreCategoria] = useState('');

  const [guardando, setGuardando] = useState(false);
  const { mostrarToast, confirmar } = useToast();

  async function cargar() {
    setCargando(true);
    setError('');
    try {
      const [ps, cs] = await Promise.all([catalogoService.productos(), catalogoService.categorias()]);
      setProductos(ps);
      setCategorias(cs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar el catálogo.');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nombreDeCategoria = (id: number) => categorias.find((c) => c.idCategoria === id)?.nombre_categoria || `#${id}`;

  const filtrados = useMemo(() => {
    const q = filtros.q.trim().toLowerCase();
    return productos.filter(
      (p) =>
        (!q || p.nombre_producto.toLowerCase().includes(q)) &&
        (!filtros.categoria || String(p.idCategoria) === filtros.categoria) &&
        (!filtros.stock ||
          (filtros.stock === 'agotado'
            ? p.stock === 0
            : filtros.stock === 'bajo'
              ? p.stock > 0 && p.stock <= STOCK_BAJO
              : p.stock > STOCK_BAJO))
    );
  }, [productos, filtros]);

  const sinStock = productos.filter((p) => p.stock === 0).length;
  const stockBajo = productos.filter((p) => p.stock > 0 && p.stock <= STOCK_BAJO).length;

  // ---------- Productos ----------
  function abrirNuevoProducto() {
    setEditandoProducto(null);
    setFormProducto(FORM_PRODUCTO_VACIO);
    setModalProducto(true);
  }

  function abrirEditarProducto(p: Producto) {
    setEditandoProducto(p);
    setFormProducto({
      nombre: p.nombre_producto,
      idCategoria: String(p.idCategoria),
      precio: String(Number(p.precio)),
      stock: String(p.stock),
      requierePrescripcion: !!p.requierePrescripcion,
    });
    setModalProducto(true);
  }

  const campoProducto = (k: 'nombre' | 'precio' | 'stock') => (e: ChangeEvent<HTMLInputElement>) =>
    setFormProducto((f) => ({ ...f, [k]: e.target.value }));

  async function guardarProducto() {
    const precio = Number(formProducto.precio);
    const stock = Number(formProducto.stock);
    if (formProducto.nombre.trim().length < 3) return mostrarToast('El nombre debe tener al menos 3 caracteres.', 'error');
    if (!formProducto.idCategoria) return mostrarToast('Selecciona una categoría.', 'error');
    if (!(precio > 0)) return mostrarToast('El precio debe ser mayor que 0.', 'error');
    if (!Number.isInteger(stock) || stock < 0) return mostrarToast('El stock debe ser un número entero (0 o más).', 'error');

    const payload = {
      nombre_producto: formProducto.nombre.trim(),
      idCategoria: Number(formProducto.idCategoria),
      precio,
      stock,
      requierePrescripcion: formProducto.requierePrescripcion,
    };

    setGuardando(true);
    try {
      if (editandoProducto) {
        await catalogoService.actualizarProducto(editandoProducto.idProducto, payload);
        mostrarToast('Producto actualizado.', 'ok');
      } else {
        await catalogoService.crearProducto(payload);
        mostrarToast('Producto creado.', 'ok');
      }
      setModalProducto(false);
      await cargar();
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : 'No se pudo guardar el producto.', 'error');
    } finally {
      setGuardando(false);
    }
  }

  async function eliminarProducto(p: Producto) {
    if (!await confirmar(`¿Eliminar "${p.nombre_producto}" del catálogo? Dejará de mostrarse y de poder venderse.`)) return;
    try {
      await catalogoService.eliminarProducto(p.idProducto);
      mostrarToast('Producto eliminado.', 'ok');
      await cargar();
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : 'No se pudo eliminar.', 'error');
    }
  }

  // ---------- Categorías ----------
  function abrirNuevaCategoria() {
    setEditandoCategoria(null);
    setNombreCategoria('');
    setModalCategoria(true);
  }

  function abrirEditarCategoria(c: Categoria) {
    setEditandoCategoria(c);
    setNombreCategoria(c.nombre_categoria);
    setModalCategoria(true);
  }

  async function guardarCategoria() {
    if (nombreCategoria.trim().length < 2) return mostrarToast('El nombre debe tener al menos 2 caracteres.', 'error');
    setGuardando(true);
    try {
      if (editandoCategoria) {
        await catalogoService.actualizarCategoria(editandoCategoria.idCategoria, nombreCategoria.trim());
        mostrarToast('Categoría actualizada.', 'ok');
      } else {
        await catalogoService.crearCategoria(nombreCategoria.trim());
        mostrarToast('Categoría creada.', 'ok');
      }
      setModalCategoria(false);
      await cargar();
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : 'No se pudo guardar la categoría.', 'error');
    } finally {
      setGuardando(false);
    }
  }

  async function eliminarCategoria(c: Categoria) {
    if (!await confirmar(`¿Eliminar la categoría "${c.nombre_categoria}"?`)) return;
    try {
      await catalogoService.eliminarCategoria(c.idCategoria);
      mostrarToast('Categoría eliminada.', 'ok');
      await cargar();
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : 'No se pudo eliminar.', 'error');
    }
  }

  return (
    <section className="seccion activa">
      <div className="sec-header">
        <div>
          <div className="sec-titulo">Catálogo</div>
          <div className="sec-subtitulo">Productos, precios, inventario y categorías</div>
        </div>
        {pestana === 'productos' ? (
          <button
            className="btn-nuevo"
            onClick={() => {
              if (!categorias.length) {
                mostrarToast('Primero crea una categoría para poder agregar productos.', 'error');
                setPestana('categorias');
                return;
              }
              abrirNuevoProducto();
            }}
          >
            <i className="ti ti-plus" /> Nuevo producto
          </button>
        ) : (
          <button className="btn-nuevo" onClick={abrirNuevaCategoria}>
            <i className="ti ti-plus" /> Nueva categoría
          </button>
        )}
      </div>

      <div className="stats">
        <div className="stat">
          <div className="stat-icono">
            <i className="ti ti-package" />
          </div>
          <div>
            <div className="stat-label">Productos</div>
            <div className="stat-valor">{productos.length}</div>
          </div>
        </div>
        <div className="stat">
          <div className="stat-icono acento">
            <i className="ti ti-alert-triangle" />
          </div>
          <div>
            <div className="stat-label">Stock bajo</div>
            <div className="stat-valor acento">{stockBajo}</div>
          </div>
        </div>
        <div className="stat">
          <div className="stat-icono verde">
            <i className="ti ti-category" />
          </div>
          <div>
            <div className="stat-label">Agotados / Categorías</div>
            <div className="stat-valor verde">
              {sinStock} / {categorias.length}
            </div>
          </div>
        </div>
      </div>

      <div className="adm-tabs">
        <button className={`adm-tab${pestana === 'productos' ? ' activa' : ''}`} onClick={() => setPestana('productos')}>
          Productos
        </button>
        <button className={`adm-tab${pestana === 'categorias' ? ' activa' : ''}`} onClick={() => setPestana('categorias')}>
          Categorías
        </button>
      </div>

      {cargando && (
        <div className="skeleton-lista">
          <Skeleton variante="fila" cantidad={4} />
        </div>
      )}

      {!cargando && error && (
        <EmptyState icono="ti-wifi-off" mensaje={error} accion={<button onClick={cargar}>Reintentar</button>} />
      )}

      {!cargando && !error && pestana === 'productos' && (
        <>
          {!categorias.length && (
            <div className="vacio">
              <i className="ti ti-category" />
              Primero crea una categoría para poder agregar productos.
            </div>
          )}

          <FilterBar
            busqueda={filtros.q}
            onBusqueda={(v) => setFiltro('q', v)}
            placeholder="Buscar producto..."
            hayFiltros={hayFiltros}
            onLimpiar={limpiar}
          >
            <select
              className="filtro"
              value={filtros.categoria}
              onChange={(e) => setFiltro('categoria', e.target.value)}
            >
              <option value="">Todas las categorías</option>
              {categorias.map((c) => (
                <option key={c.idCategoria} value={c.idCategoria}>
                  {c.nombre_categoria}
                </option>
              ))}
            </select>

            <select className="filtro" value={filtros.stock} onChange={(e) => setFiltro('stock', e.target.value)}>
              <option value="">Todo el stock</option>
              <option value="agotado">Agotados</option>
              <option value="bajo">Stock bajo</option>
              <option value="disponible">Disponibles</option>
            </select>
          </FilterBar>

          <p className="conteo">{filtrados.length} producto(s) encontrado(s)</p>

          {!filtrados.length ? (
            <EmptyState
              icono="ti-package-off"
              mensaje={hayFiltros ? 'Ningún producto coincide con los filtros' : 'No hay productos para mostrar'}
              accion={hayFiltros ? <button onClick={limpiar}>Limpiar filtros</button> : undefined}
            />
          ) : (
            <div className="adm-tabla-wrap">
              <table className="adm-tabla tarjetas">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Categoría</th>
                    <th className="adm-num">Precio</th>
                    <th className="adm-num">Stock</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((p) => (
                    <tr key={p.idProducto}>
                      <td>
                        <strong>{p.nombre_producto}</strong>
                        {p.requierePrescripcion && (
                          <div style={{ marginTop: 4 }}>
                            <span className="chip receta">Requiere prescripción</span>
                          </div>
                        )}
                      </td>
                      <td data-label="Categoría">{nombreDeCategoria(p.idCategoria)}</td>
                      <td className="adm-num" data-label="Precio">{dinero(p.precio)}</td>
                      <td className="adm-num" data-label="Stock">
                        {p.stock === 0 ? (
                          <span className="chip rojo">Agotado</span>
                        ) : p.stock <= STOCK_BAJO ? (
                          <span className="chip naranja">{p.stock} (bajo)</span>
                        ) : (
                          p.stock
                        )}
                      </td>
                      <td>
                        <div className="adm-acciones">
                          <button className="btn-ico" title="Editar" onClick={() => abrirEditarProducto(p)}>
                            <i className="ti ti-edit" />
                          </button>
                          <button className="btn-ico rojo" title="Eliminar" onClick={() => eliminarProducto(p)}>
                            <i className="ti ti-trash" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {!cargando && !error && pestana === 'categorias' && (
        <>
          <p className="conteo">{categorias.length} categoría(s)</p>
          {!categorias.length ? (
            <div className="vacio">
              <i className="ti ti-category" />
              Aún no hay categorías.
            </div>
          ) : (
            <div className="adm-tabla-wrap">
              <table className="adm-tabla tarjetas">
                <thead>
                  <tr>
                    <th>Categoría</th>
                    <th className="adm-num">Productos</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {categorias.map((c) => (
                    <tr key={c.idCategoria}>
                      <td>
                        <strong>{c.nombre_categoria}</strong>
                      </td>
                      <td className="adm-num" data-label="Productos">
                        {productos.filter((p) => p.idCategoria === c.idCategoria).length}
                      </td>
                      <td>
                        <div className="adm-acciones">
                          <button className="btn-ico" title="Renombrar" onClick={() => abrirEditarCategoria(c)}>
                            <i className="ti ti-edit" />
                          </button>
                          <button className="btn-ico rojo" title="Eliminar" onClick={() => eliminarCategoria(c)}>
                            <i className="ti ti-trash" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <AdminModal
        abierto={modalProducto}
        titulo={editandoProducto ? 'Editar producto' : 'Nuevo producto'}
        onClose={() => setModalProducto(false)}
        pie={
          <>
            <button className="btn-cancelar" onClick={() => setModalProducto(false)}>
              Cancelar
            </button>
            <button className="btn-guardar" onClick={guardarProducto} disabled={guardando}>
              <i className="ti ti-device-floppy" /> {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          </>
        }
      >
        <div className="campo">
          <label>Nombre del producto</label>
          <input type="text" value={formProducto.nombre} onChange={campoProducto('nombre')} />
        </div>
        <div className="campo">
          <label>Categoría</label>
          <select
            value={formProducto.idCategoria}
            onChange={(e) => setFormProducto((f) => ({ ...f, idCategoria: e.target.value }))}
          >
            <option value="">Seleccionar...</option>
            {categorias.map((c) => (
              <option key={c.idCategoria} value={c.idCategoria}>
                {c.nombre_categoria}
              </option>
            ))}
          </select>
        </div>
        <div className="campo-2">
          <div className="campo" style={{ margin: 0 }}>
            <label>Precio</label>
            <input type="number" min="0" step="any" value={formProducto.precio} onChange={campoProducto('precio')} />
          </div>
          <div className="campo" style={{ margin: 0 }}>
            <label>Stock</label>
            <input type="number" min="0" step="1" value={formProducto.stock} onChange={campoProducto('stock')} />
          </div>
        </div>
        <label className="adm-check">
          <input
            type="checkbox"
            checked={formProducto.requierePrescripcion}
            onChange={(e) => setFormProducto((f) => ({ ...f, requierePrescripcion: e.target.checked }))}
          />
          Requiere prescripción (historial clínico) para venderse
        </label>
      </AdminModal>

      <AdminModal
        abierto={modalCategoria}
        titulo={editandoCategoria ? 'Renombrar categoría' : 'Nueva categoría'}
        onClose={() => setModalCategoria(false)}
        pie={
          <>
            <button className="btn-cancelar" onClick={() => setModalCategoria(false)}>
              Cancelar
            </button>
            <button className="btn-guardar" onClick={guardarCategoria} disabled={guardando}>
              <i className="ti ti-device-floppy" /> {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          </>
        }
      >
        <div className="campo">
          <label>Nombre de la categoría</label>
          <input type="text" value={nombreCategoria} onChange={(e) => setNombreCategoria(e.target.value)} />
        </div>
      </AdminModal>
    </section>
  );
}