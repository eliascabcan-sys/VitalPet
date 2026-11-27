// =================================================================
// Archivo: src/components/Toast/ToastContext.tsx
// RESPONSABILIDAD: ÚNICO sistema de avisos de la app. Reemplaza alert()
// y confirm() del navegador:
//   - mostrarToast(msg, tipo)   → aviso breve (ok | error)
//   - confirmar(msg, opciones)  → modal Sí/No, devuelve Promise<boolean>
// Se monta una sola vez en main.tsx.
// =================================================================
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import './Toast.css';

// 'err' se mantiene por compatibilidad con código antiguo.
type TipoToast = 'ok' | 'error' | 'err' | '';

interface ToastState {
  msg: string;
  tipo: TipoToast;
  visible: boolean;
}

interface OpcionesConfirmar {
  titulo?: string;
  textoOk?: string;
  textoCancelar?: string;
  peligro?: boolean;
}

interface ConfirmState extends OpcionesConfirmar {
  msg: string;
}

interface ToastContextType {
  mostrarToast: (msg: string, tipo?: TipoToast) => void;
  confirmar: (msg: string, opciones?: OpcionesConfirmar) => Promise<boolean>;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ToastState>({ msg: '', tipo: '', visible: false });
  const [dialogo, setDialogo] = useState<ConfirmState | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mostrarToast = useCallback((msg: string, tipo: TipoToast = '') => {
    if (timer.current) clearTimeout(timer.current);
    setState({ msg, tipo: tipo === 'err' ? 'error' : tipo, visible: true });
    timer.current = setTimeout(() => setState((s) => ({ ...s, visible: false })), 3500);
  }, []);

  const confirmar = useCallback((msg: string, opciones: OpcionesConfirmar = {}) => {
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setDialogo({ msg, ...opciones });
    });
  }, []);

  const cerrar = (respuesta: boolean) => {
    resolver.current?.(respuesta);
    resolver.current = null;
    setDialogo(null);
  };

  useEffect(() => {
    if (!dialogo) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialogo]);

  return (
    <ToastContext.Provider value={{ mostrarToast, confirmar }}>
      {children}
      <div className={`vp-toast ${state.tipo}${state.visible ? ' show' : ''}`} role="status" aria-live="polite">
        {state.msg}
      </div>
      {dialogo && (
        <div className="vp-confirm-overlay" onClick={() => cerrar(false)}>
          <div
            className="vp-confirm"
            role="alertdialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>{dialogo.titulo ?? 'Confirmar'}</h3>
            <p>{dialogo.msg}</p>
            <div className="vp-confirm-actions">
              <button type="button" className="vp-confirm-cancel" onClick={() => cerrar(false)}>
                {dialogo.textoCancelar ?? 'Cancelar'}
              </button>
              <button
                type="button"
                autoFocus
                className={`vp-confirm-ok${dialogo.peligro ? ' peligro' : ''}`}
                onClick={() => cerrar(true)}
              >
                {dialogo.textoOk ?? 'Aceptar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastContextType {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>');
  return ctx;
}
