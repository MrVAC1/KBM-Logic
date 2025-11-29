import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Fix for Recharts lodash imports
      'lodash': 'lodash-es',
    },
  },
  optimizeDeps: {
    include: [
      'lodash-es', 
      'recharts',
      'date-fns',
      'react-day-picker',
    ],
    esbuildOptions: {
      // Fix for date-fns ESM resolution
      mainFields: ['module', 'main'],
    },
  },
  build: {
    chunkSizeWarningLimit: 1600,
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})

