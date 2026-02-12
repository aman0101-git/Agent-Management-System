import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDevelopment = process.env.NODE_ENV === 'development';

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [ react(), tailwindcss() ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: isDevelopment ? {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  } : undefined,
})
