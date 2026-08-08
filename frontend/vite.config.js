import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Dev-mode proxy: forwards /api requests to the Express server (no CORS needed)
    proxy: {
      '/api': {
        target:       'http://localhost:5000',
        changeOrigin: true,
        secure:       false,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        // Rolldown (Vite 8) requires manualChunks to be a function
        manualChunks(id) {
          if (id.includes('echarts')) return 'echarts';
          if (id.includes('lucide-react')) return 'icons';
          if (
            id.includes('node_modules/react') ||
            id.includes('node_modules/react-dom') ||
            id.includes('node_modules/axios') ||
            id.includes('node_modules/date-fns')
          ) return 'vendor';
        },
      },
    },
  },
})
