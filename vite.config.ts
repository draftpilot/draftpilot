import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import createExternal from 'vite-plugin-external'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    global: 'window',
  },
})
