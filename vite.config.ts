import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    allowedHosts: ['localhost', '127.0.0.1', 'frontend', 'crm.udarsoft.com'],
  },
  preview: {
    host: true,
    allowedHosts: ['localhost', '127.0.0.1', 'frontend', 'crm.udarsoft.com'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    chunkSizeWarningLimit: 1024,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          tanstack: ['@tanstack/react-router', '@tanstack/react-table'],
          form: ['react-hook-form', '@hookform/resolvers/zod', 'zod'],
          ui: ['framer-motion'],
        },
      },
    },
  },
})
