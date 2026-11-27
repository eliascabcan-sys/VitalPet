// =================================================================
// Archivo: src/hooks/useFiltrosURL.ts
// RESPONSABILIDAD: Guarda los filtros de una lista en la URL
// (?q=luna&estado=activo) usando useSearchParams. Así el filtro
// sobrevive a recargar la página, al botón "atrás" y se puede
// compartir el enlace.
//
// Uso:
//   const FILTROS = { q: '', estado: '' };            // fuera del componente
//   const { filtros, setFiltro, limpiar, hayFiltros } = useFiltrosURL(FILTROS);
//   filtros.q  ->  valor actual
//   setFiltro('estado', 'activo')
// Los valores iguales al valor por defecto no se escriben en la URL.
//
// CORRECCIÓN: en react-router v6, si se llama setFiltro varias veces seguidas
// (ej. setFiltro('dias', '7'); setFiltro('desde', '')), cada llamada partía de
// los parámetros "viejos" del render y la última pisaba a las anteriores, por
// eso los botones de días y las fechas no hacían nada. Ahora guardamos en una
// referencia los parámetros más recientes para que las llamadas se acumulen.
// =================================================================
import { useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

export function useFiltrosURL<T extends Record<string, string>>(porDefecto: T) {
  const [params, setParams] = useSearchParams();
  const defaults = useRef(porDefecto);

  // Parámetros más recientes, incluso los pedidos en esta misma ejecución.
  const ultimos = useRef(params);
  ultimos.current = params;

  const filtros = useMemo(() => {
    const actual = { ...defaults.current };
    for (const clave of Object.keys(defaults.current) as (keyof T & string)[]) {
      const valor = params.get(clave);
      if (valor !== null) actual[clave] = valor as T[typeof clave];
    }
    return actual;
  }, [params]);

  const setFiltro = useCallback(
    <K extends keyof T & string>(clave: K, valor: T[K]) => {
      const siguientes = new URLSearchParams(ultimos.current);
      if (valor === '' || valor === defaults.current[clave]) siguientes.delete(clave);
      else siguientes.set(clave, valor);
      ultimos.current = siguientes;
      setParams(siguientes, { replace: true }); // no llena el historial con cada tecla
    },
    [setParams]
  );

  const limpiar = useCallback(() => {
    const siguientes = new URLSearchParams(ultimos.current);
    for (const clave of Object.keys(defaults.current)) siguientes.delete(clave);
    ultimos.current = siguientes;
    setParams(siguientes, { replace: true });
  }, [setParams]);

  const hayFiltros = useMemo(
    () => (Object.keys(defaults.current) as (keyof T & string)[]).some((k) => filtros[k] !== defaults.current[k]),
    [filtros]
  );

  return { filtros, setFiltro, limpiar, hayFiltros };
}