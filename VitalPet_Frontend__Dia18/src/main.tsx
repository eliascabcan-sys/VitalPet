// =================================================================
// Archivo: src/main.tsx
// RESPONSABILIDAD: Punto de entrada. Monta el router y el AuthProvider
// envolviendo toda la app.
// =================================================================
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './assets/css/tokens.css';
import './assets/css/global.css';
import './assets/css/tabla-tarjetas.css';
import './assets/css/mobile-listas.css';
import './assets/css/legibilidad-movil.css';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/Toast/ToastContext';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);