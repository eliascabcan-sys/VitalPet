import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { qrcode } from 'vite-plugin-qrcode'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), qrcode()],
  server: {
    // Permite abrir la app desde un túnel (ngrok, cloudflared...) además de localhost.
    allowedHosts: true,
    // Todo lo que empiece por /api se reenvía a FastAPI. Así el navegador
    // habla siempre con el mismo origen (Vite) y no hay problemas de CORS.
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:8000',
        // Sin changeOrigin: el backend necesita saber con qué dirección entró el
        // usuario (la del túnel en el celular) para que Google vuelva a ella.
        changeOrigin: false,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            if (req.headers.host) proxyReq.setHeader('x-forwarded-host', req.headers.host)
          })
        },
      },
    },
  },
})
