// =================================================================
// Archivo: src/components/SelectorPaciente/SelectorPaciente.tsx
// RESPONSABILIDAD: Elegir una mascota en DOS pasos, como piensa el
// veterinario: 1) el dueño (se busca por su nombre o por el de su mascota)
// y 2) una de las mascotas de ese dueño. Si tiene una sola, queda elegida.
// Reemplaza al selector plano con todas las mascotas de la clínica.
// =================================================================
import { useMemo, useState } from 'react';
import type { Mascota } from '../../services/mascotasService';
import FotoMascota from '../FotoMascota/FotoMascota';
import './SelectorPaciente.css';

interface Props {
  mascotas: Mascota[];                  // solo las activas, con "nombre_dueno"
  valor: string;                        // idMascota elegida ('' = ninguna)
  onChange: (idMascota: string) => void;
  disabled?: boolean;
}

interface Dueno { id: number; nombre: string; mascotas: Mascota[] }

const sinTildes = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const MAX_RESULTADOS = 6;

export default function SelectorPaciente({ mascotas, valor, onChange, disabled }: Props) {
  const [idDueno, setIdDueno] = useState<number | null>(null);
  const [busqueda, setBusqueda] = useState('');

  // Mascotas agrupadas por dueño, ordenadas por nombre.
  const duenos = useMemo<Dueno[]>(() => {
    const mapa = new Map<number, Dueno>();
    mascotas.forEach((m) => {
      const id = m.idUsuario ?? 0;
      const d = mapa.get(id) ?? { id, nombre: m.nombre_dueno || `Dueño #${id}`, mascotas: [] };
      d.mascotas.push(m);
      mapa.set(id, d);
    });
    return [...mapa.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }, [mascotas]);

  // Si ya hay una mascota elegida (por ejemplo al editar), de ahí sale el dueño.
  const elegida = mascotas.find((m) => String(m.idMascota) === valor);
  const duenoActual = duenos.find((d) => d.id === (elegida ? elegida.idUsuario ?? 0 : idDueno)) ?? null;

  const q = sinTildes(busqueda.trim());
  const todos = !q && duenos.length <= 8; // pocos dueños: se listan todos sin escribir
  const resultados = q || todos
    ? duenos.filter((d) => !q || sinTildes(d.nombre).includes(q) || d.mascotas.some((m) => sinTildes(m.nombre_mascota).includes(q)))
    : [];

  function elegirDueno(d: Dueno) {
    setIdDueno(d.id);
    setBusqueda('');
    onChange(d.mascotas.length === 1 ? String(d.mascotas[0].idMascota) : ''); // un solo animal: ya está elegido
  }

  function cambiarDueno() {
    setIdDueno(null);
    onChange('');
  }

  // ---------- Paso 2: el dueño ya está elegido -> sus mascotas ----------
  if (duenoActual) {
    return (
      <div className="sp">
        <label className="sp-et">Dueño</label>
        <div className="sp-dueno">
          <span><i className="ti ti-user" /> <strong>{duenoActual.nombre}</strong></span>
          {!disabled && <button type="button" className="sp-cambiar" onClick={cambiarDueno}>Cambiar</button>}
        </div>

        <label className="sp-et">Mascota</label>
        <div className="sp-mascotas" role="radiogroup" aria-label="Mascotas del dueño">
          {duenoActual.mascotas.map((m) => (
            <button
              key={m.idMascota}
              type="button"
              role="radio"
              aria-checked={String(m.idMascota) === valor}
              disabled={disabled}
              className={`sp-mascota${String(m.idMascota) === valor ? ' activa' : ''}`}
              onClick={() => onChange(String(m.idMascota))}
            >
              <FotoMascota mascota={m} tamano={36} />
              <span><strong>{m.nombre_mascota}</strong><small>{m.especie}{m.raza ? ` · ${m.raza}` : ''}</small></span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ---------- Paso 1: buscar al dueño ----------
  return (
    <div className="sp">
      <label className="sp-et">Dueño</label>
      <input
        type="search"
        className="sp-buscar"
        placeholder="Escribe el nombre del dueño o de su mascota…"
        value={busqueda}
        disabled={disabled}
        onChange={(e) => setBusqueda(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && resultados[0]) { e.preventDefault(); elegirDueno(resultados[0]); } }}
        autoComplete="off"
      />
      {resultados.length > 0 && (
        <ul className="sp-lista">
          {resultados.slice(0, MAX_RESULTADOS).map((d) => (
            <li key={d.id}>
              <button type="button" onClick={() => elegirDueno(d)}>
                <strong>{d.nombre}</strong>
                <small>{d.mascotas.map((m) => m.nombre_mascota).join(', ')}</small>
              </button>
            </li>
          ))}
          {resultados.length > MAX_RESULTADOS && <li className="sp-mas">Hay {resultados.length - MAX_RESULTADOS} más: escribe para afinar la búsqueda.</li>}
        </ul>
      )}
      {q && resultados.length === 0 && <p className="sp-ayuda">Ningún dueño ni mascota coincide con "{busqueda}".</p>}
      {!q && !todos && <p className="sp-ayuda">Escribe para buscar entre {duenos.length} dueños.</p>}
    </div>
  );
}