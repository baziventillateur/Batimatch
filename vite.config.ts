import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'

// Numéro de version : 1.<nombre de publications>, avec la date et les dernières nouveautés
// (titres des publications), lus dans l'historique git au moment du build.
function version() {
  const git = (cmd: string) => execSync(`git ${cmd}`, { encoding: 'utf-8' }).trim()
  try {
    const total = Number(git('rev-list --count --no-merges HEAD'))
    const lines = git('log -15 --no-merges --date=iso-strict --pretty=format:%cd%x09%s').split('\n')
    return {
      numero: `1.${total}`,
      date: new Date().toISOString(),
      historique: lines.map((line, i) => {
        const [date, ...titre] = line.split('\t')
        return { numero: `1.${total - i}`, date, titre: titre.join(' ') }
      }),
    }
  } catch {
    return { numero: 'locale', date: new Date().toISOString(), historique: [] }
  }
}

// base: './' permet de servir l'app depuis n'importe quel sous-dossier
// (GitHub Pages, Netlify, ouverture locale du dossier dist).
export default defineConfig({
  base: './',
  define: { __VERSION__: JSON.stringify(version()) },
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
} as Parameters<typeof defineConfig>[0])
