import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// base: './' permet de servir l'app depuis n'importe quel sous-dossier
// (GitHub Pages, Netlify, ouverture locale du dossier dist).
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
} as Parameters<typeof defineConfig>[0])
