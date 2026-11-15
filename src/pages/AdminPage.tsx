import { ExternalLink } from 'lucide-react'
import { useAuth } from '../data/auth'
import { Navigate } from 'react-router-dom'
import { isAdminEmail } from '../lib/admin'
import { cx } from '../components/ui'

const REPO = 'https://github.com/baziventillateur/batimatch'
const SUPABASE = 'https://supabase.com/dashboard/project/uhdanxctslncwwmcziba'

interface LinkItem {
  label: string
  href: string
  note?: string
}

const GROUPS: { title: string; items: LinkItem[] }[] = [
  {
    title: 'Production',
    items: [
      { label: 'Application en production', href: 'https://baziventillateur.github.io/Batimatch/', note: 'Site public GitHub Pages' },
      { label: 'Dernier déploiement', href: `${REPO}/actions`, note: 'Workflow « pages » : test, build, publication' },
      { label: 'Réglages GitHub Pages', href: `${REPO}/settings/pages`, note: 'Source doit être « GitHub Actions »' },
    ],
  },
  {
    title: 'Code (GitHub)',
    items: [
      { label: 'Dépôt', href: REPO },
      { label: 'Historique des modifications', href: `${REPO}/commits/main` },
      { label: 'Schéma SQL (à exécuter dans Supabase)', href: `${REPO}/blob/main/supabase/schema.sql` },
      { label: 'Guide d’installation Supabase', href: `${REPO}/blob/main/supabase/README.md` },
    ],
  },
  {
    title: 'Base de données et comptes (Supabase)',
    items: [
      { label: 'Tableau de bord du projet', href: SUPABASE },
      { label: 'Éditeur SQL', href: `${SUPABASE}/sql/new`, note: 'Pour relancer schema.sql' },
      { label: 'Tables', href: `${SUPABASE}/editor` },
      { label: 'Utilisateurs inscrits', href: `${SUPABASE}/auth/users` },
      { label: 'Adresses de redirection (Auth)', href: `${SUPABASE}/auth/url-configuration`, note: 'Site URL et Redirect URLs' },
      { label: 'Stockage des logos', href: `${SUPABASE}/storage/buckets` },
    ],
  },
]

const LOCAL_NOTE = 'Dossier de travail : /home/claude/batimatch (session Claude). Ce chemin n’est pas accessible depuis ton navigateur.'

export default function AdminPage() {
  const { profile } = useAuth()
  if (!profile) return null
  if (!isAdminEmail(profile.email)) return <Navigate to="/" replace />

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header>
        <h1 className="font-title text-[1.625rem] font-bold">Panneau admin</h1>
        <p className="mt-1 text-[0.875rem] text-ink-3">Liens utiles pour le projet Batimatch.</p>
      </header>

      {GROUPS.map((g) => (
        <section key={g.title} className="overflow-hidden rounded-md border border-line bg-sheet">
          <h2 className="border-b border-line bg-paper/60 px-4 py-2.5 text-[0.875rem] font-semibold">{g.title}</h2>
          <ul>
            {g.items.map((it, i) => (
              <li key={it.href} className={cx(i > 0 && 'border-t border-line')}>
                <a
                  href={it.href}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-paper/60 focus-visible:bg-paper/60"
                >
                  <span className="min-w-0">
                    <span className="block text-[0.9375rem] font-medium text-ink">{it.label}</span>
                    {it.note && <span className="block text-[0.8125rem] text-ink-3">{it.note}</span>}
                  </span>
                  <ExternalLink size={16} className="shrink-0 text-ink-3" aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className="rounded-md border border-line bg-paper/50 px-4 py-3 text-[0.8125rem] text-ink-3">
        <h2 className="mb-1 text-[0.875rem] font-semibold text-ink">Projet local</h2>
        {LOCAL_NOTE}
      </section>
    </div>
  )
}
