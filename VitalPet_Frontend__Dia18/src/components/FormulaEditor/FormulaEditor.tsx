// =================================================================
// Archivo: src/components/FormulaEditor/FormulaEditor.tsx
// RESPONSABILIDAD: Editor de la fórmula (medicamento, dosis, frecuencia,
// duración, recomendaciones). Mientras el veterinario escribe el nombre
// del medicamento muestra cuántas unidades hay en el inventario y cuántas
// del mismo tipo, y avisa si la cantidad pedida no alcanza.
// =================================================================
import { useEffect, useRef, useState } from 'react';
import { formulaStockService } from '../../services/formulaStockService';
import type { ProductoStock } from '../../services/formulaStockService';
import { medicamentoVacio } from './formulaform';
import type { FormulaForm, MedicamentoForm } from './formulaform';
import './FormulaEditor.css';

const VIAS = ['Oral', 'Subcutánea', 'Intramuscular', 'Intravenosa', 'Tópica', 'Oftálmica', 'Ótica', 'Otra'];
const MIN_LETRAS = 2;
const ESPERA_MS = 300;

const claseEstado = (e: ProductoStock['estado_stock']) => (e === 'disponible' ? 'ok' : e === 'bajo' ? 'bajo' : 'agotado');
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

function AvisoStock({ producto, cantidad }: { producto: ProductoStock; cantidad: string }) {
  const pedida = Number(cantidad);
  const faltan = Number.isInteger(pedida) && pedida > producto.stock ? pedida - producto.stock : 0;
  const tipo = producto.nombre_subcategoria || producto.nombre_categoria || 'este tipo';
  return (
    <div className="fe-stock-bloque" role="status">
      <span className={`fe-stock ${claseEstado(producto.estado_stock)}`}>
        <i className="ti ti-packages" />
        {producto.estado_stock === 'agotado'
          ? 'Agotado en el inventario'
          : `${plural(producto.stock, 'unidad', 'unidades')} en inventario${producto.estado_stock === 'bajo' ? ' (stock bajo)' : ''}`}
      </span>
      <span className="fe-tipo">
        {tipo}: {plural(producto.unidades_del_tipo, 'unidad', 'unidades')} en {plural(producto.productos_del_tipo, 'producto', 'productos')}
      </span>
      {faltan > 0 && producto.stock > 0 && (
        <span className="fe-stock agotado">
          <i className="ti ti-alert-triangle" /> Solo hay {producto.stock}; faltan {faltan} para esta fórmula.
        </span>
      )}
    </div>
  );
}

interface FilaProps {
  m: MedicamentoForm;
  numero: number;
  onCambio: (cambios: Partial<MedicamentoForm>) => void;
  onQuitar: () => void;
}

function FilaMedicamento({ m, numero, onCambio, onQuitar }: FilaProps) {
  const [sugerencias, setSugerencias] = useState<ProductoStock[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [sinResultados, setSinResultados] = useState(false);

  // onCambio cambia en cada render del padre: se guarda en una ref para no reiniciar la búsqueda.
  const cambioRef = useRef(onCambio);
  useEffect(() => { cambioRef.current = onCambio; });

  const texto = m.nombre_medicamento.trim();
  const yaEnlazado = !!m.producto && m.producto.nombre_producto.toLowerCase() === texto.toLowerCase();

  useEffect(() => {
    setSinResultados(false);
    if (texto.length < MIN_LETRAS || yaEnlazado) {
      setSugerencias([]);
      setBuscando(false);
      return;
    }
    let vigente = true;
    setBuscando(true);
    const temporizador = setTimeout(() => {
      formulaStockService.buscar(texto)
        .then((productos) => {
          if (!vigente) return;
          setSugerencias(productos);
          setSinResultados(productos.length === 0);
          // Si lo escrito coincide exactamente con un producto, se enlaza solo.
          const exacto = productos.find((p) => p.nombre_producto.toLowerCase() === texto.toLowerCase());
          if (exacto) cambioRef.current({ idProducto: exacto.idProducto, producto: exacto });
        })
        .catch(() => { if (vigente) setSugerencias([]); })   // sin stock no se bloquea la fórmula
        .finally(() => { if (vigente) setBuscando(false); });
    }, ESPERA_MS);
    return () => { vigente = false; clearTimeout(temporizador); };
  }, [texto, yaEnlazado]);

  function escribirNombre(valor: string) {
    // Al cambiar el texto se rompe el enlace con el producto anterior.
    onCambio({ nombre_medicamento: valor, idProducto: null, producto: null });
    setAbierto(true);
  }

  function elegir(p: ProductoStock) {
    onCambio({ nombre_medicamento: p.nombre_producto, idProducto: p.idProducto, producto: p });
    setAbierto(false);
  }

  const campo = (c: keyof MedicamentoForm) => ({
    value: m[c] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      onCambio({ [c]: e.target.value }),
  });

  return (
    <div className="fe-fila">
      <div className="fe-fila-cabecera">
        <strong>Medicamento {numero}</strong>
        <button type="button" className="fe-quitar" onClick={onQuitar} aria-label={`Quitar medicamento ${numero}`}>
          <i className="ti ti-trash" /> Quitar
        </button>
      </div>

      <div className="campo fe-autocompletar">
        <label>Medicamento *</label>
        <input
          type="text"
          maxLength={150}
          autoComplete="off"
          placeholder="Escribe para ver el stock del inventario"
          value={m.nombre_medicamento}
          onChange={(e) => escribirNombre(e.target.value)}
          onFocus={() => setAbierto(true)}
          onBlur={() => setAbierto(false)}
        />
        {abierto && sugerencias.length > 0 && !yaEnlazado && (
          <ul className="fe-sugerencias" role="listbox">
            {sugerencias.map((p) => (
              <li key={p.idProducto}>
                <button type="button" role="option" aria-selected={false}
                  onMouseDown={(e) => e.preventDefault()} onClick={() => elegir(p)}>
                  <span>{p.nombre_producto}</span>
                  <span className={`fe-stock ${claseEstado(p.estado_stock)}`}>
                    {p.stock <= 0 ? 'Agotado' : `${p.stock} u.`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {buscando && <span className="fe-ayuda">Consultando inventario…</span>}
        {m.producto && <AvisoStock producto={m.producto} cantidad={m.cantidad} />}
        {!m.producto && !buscando && sinResultados && texto.length >= MIN_LETRAS && (
          <span className="fe-ayuda">No está en el inventario. Puedes formularlo igual.</span>
        )}
      </div>

      <div className="campo-2">
        <div className="campo">
          <label>Presentación</label>
          <input type="text" maxLength={100} placeholder="Tabletas 250 mg, jarabe 60 ml…" {...campo('presentacion')} />
        </div>
        <div className="campo">
          <label>Vía de administración</label>
          <select {...campo('via_administracion')}>
            <option value="">Seleccionar...</option>
            {VIAS.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
      </div>

      <div className="campo-2">
        <div className="campo">
          <label>Dosis *</label>
          <input type="text" maxLength={100} placeholder="1 tableta, 0.5 ml/kg…" {...campo('dosis')} />
        </div>
        <div className="campo">
          <label>Frecuencia *</label>
          <input type="text" maxLength={100} placeholder="Cada 8 horas" {...campo('frecuencia')} />
        </div>
      </div>

      <div className="campo-2">
        <div className="campo">
          <label>Duración (días) *</label>
          <input type="number" min={1} max={365} {...campo('duracion_dias')} />
        </div>
        <div className="campo">
          <label>Cantidad a entregar</label>
          <input type="number" min={1} placeholder="Unidades" {...campo('cantidad')} />
        </div>
      </div>

      <div className="campo">
        <label>Indicaciones</label>
        <input type="text" placeholder="Con comida, agitar antes de usar…" {...campo('indicaciones')} />
      </div>
    </div>
  );
}

interface Props {
  value: FormulaForm;
  onChange: (valor: FormulaForm) => void;
}

export default function FormulaEditor({ value, onChange }: Props) {
  function cambiarFila(clave: string, cambios: Partial<MedicamentoForm>) {
    onChange({
      ...value,
      medicamentos: value.medicamentos.map((m) => (m.clave === clave ? { ...m, ...cambios } : m)),
    });
  }

  function quitarFila(clave: string) {
    const resto = value.medicamentos.filter((m) => m.clave !== clave);
    onChange({ ...value, medicamentos: resto.length ? resto : [medicamentoVacio()] });
  }

  return (
    <>
      <div className="hf-titulo">Fórmula</div>
      {value.medicamentos.map((m, i) => (
        <FilaMedicamento
          key={m.clave}
          m={m}
          numero={i + 1}
          onCambio={(c) => cambiarFila(m.clave, c)}
          onQuitar={() => quitarFila(m.clave)}
        />
      ))}
      <button type="button" className="fe-agregar"
        onClick={() => onChange({ ...value, medicamentos: [...value.medicamentos, medicamentoVacio()] })}>
        <i className="ti ti-plus" /> Agregar medicamento
      </button>

      <div className="campo" style={{ marginTop: 12 }}>
        <label>Recomendaciones</label>
        <textarea rows={3} placeholder="Reposo, dieta blanda, cuándo volver a consulta…"
          value={value.recomendaciones}
          onChange={(e) => onChange({ ...value, recomendaciones: e.target.value })} />
      </div>
    </>
  );
}