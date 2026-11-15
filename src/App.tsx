import { useEffect, useState } from 'react'
import { HashRouter, Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { LogOut, Shield, UserRound } from 'lucide-react'
import { AuthProvider, useAuth } from './data/auth'
import { api, errorMessage } from './data'
import { Button, CompanyLogo, Dialog, Field, Loading, Menu, MenuItem } from './components/ui'
import AuthPage from './pages/AuthPage'
import Home from './pages/Home'
import ProfilePage from './pages/ProfilePage'
import ProjectPage from './pages/ProjectPage'
import JoinPage from './pages/JoinPage'
import ConsultationLayout from './pages/ConsultationLayout'
import DpgfTab from './pages/DpgfTab'
import OffersTab from './pages/OffersTab'
import OfferEditor from './pages/OfferEditor'
import CompareTab from './pages/CompareTab'
import DecisionTab from './pages/DecisionTab'
import SynthesePage from './pages/SynthesePage'
import ResponsePage from './pages/ResponsePage'
import AdminPage from './pages/AdminPage'
import { isAdminEmail } from './lib/admin'

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5 rounded-sm" aria-label="Batimatch, retour à l’accueil">
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="6" fill="#1B2A3A" />
        <rect x="6" y="19" width="5" height="7" fill="#F3F5F8" />
        <rect x="13.5" y="13" width="5" height="13" fill="#F3F5F8" />
        <rect x="21" y="8" width="5" height="18" fill="#F8E04E" />
      </svg>
      <span className="font-title text-[23px] leading-none font-bold tracking-[0.01em]">batimatch</span>
    </Link>
  )
}

function UserMenu() {
  const { profile } = useAuth()
  const nav = useNavigate()
  if (!profile) return null
  const name = profile.companyName || [profile.firstName, profile.lastName].filter(Boolean).join(' ') || profile.email
  return (
    <div className="flex items-center gap-2">
      <span className="hidden text-right leading-tight sm:block">
        <span className="block text-[14px] font-medium">{name}</span>
        <span className="block text-[12px] text-ink-3">{profile.role === 'buyer' ? 'Acheteur' : 'Entreprise'}</span>
      </span>
      <CompanyLogo name={name} url={profile.logoUrl} size={32} />
      <Menu label="Mon compte" icon={<UserRound size={18} />}>
        {(close) => (
          <>
            <MenuItem icon={<UserRound />} onClick={() => (close(), nav('/profil'))}>
              Mon profil et mon logo
            </MenuItem>
            {isAdminEmail(profile.email) && (
              <MenuItem icon={<Shield />} onClick={() => (close(), nav('/admin'))}>
                Panneau admin
              </MenuItem>
            )}
            <MenuItem
              icon={<LogOut />}
              onClick={async () => {
                close()
                await api.signOut()
                nav('/')
              }}
            >
              Se déconnecter
            </MenuItem>
          </>
        )}
      </Menu>
    </div>
  )
}

/** Choix d'un nouveau mot de passe après le lien « mot de passe oublié » */
function PasswordRecovery() {
  const [open, setOpen] = useState(false)
  const [pw, setPw] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => api.onPasswordRecovery(() => setOpen(true)), [])
  return (
    <Dialog open={open} onClose={() => setOpen(false)} title="Nouveau mot de passe">
      <form
        className="grid gap-4"
        onSubmit={async (e) => {
          e.preventDefault()
          try {
            await api.updatePassword(pw)
            setOpen(false)
          } catch (err) {
            setMsg(errorMessage(err))
          }
        }}
      >
        <Field label="Choisissez un nouveau mot de passe" htmlFor="np">
          <input id="np" type="password" minLength={6} required className="field" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        </Field>
        {msg && <p className="text-[14px] text-bad">{msg}</p>}
        <Button type="submit" variant="primary">
          Enregistrer le mot de passe
        </Button>
      </form>
    </Dialog>
  )
}

function Shell() {
  const { userId, profile } = useAuth()
  const loc = useLocation()

  if (userId === undefined) return <Loading label="Connexion" />

  // Pages accessibles sans compte : connexion et lien d'invitation
  if (!userId || !profile) {
    if (loc.pathname.startsWith('/rejoindre/')) {
      return (
        <Routes>
          <Route path="/rejoindre/:code" element={<JoinPage />} />
        </Routes>
      )
    }
    return <AuthPage />
  }

  const isBuyer = profile.role === 'buyer'
  return (
    <div className="flex min-h-dvh flex-col">
      {api.kind === 'mock' && (
        <p className="no-print bg-marker px-4 py-1 text-center text-[13px] font-medium">
          Mode démonstration : les données restent dans ce navigateur.
        </p>
      )}
      <header className="no-print border-b border-line bg-sheet">
        <div className="mx-auto flex h-14 max-w-[1320px] items-center justify-between gap-4 px-4 sm:px-6">
          <Logo />
          <UserMenu />
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1320px] flex-1 px-4 pt-5 pb-28 sm:px-6 sm:pt-7">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/profil" element={<ProfilePage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/rejoindre/:code" element={<JoinPage />} />
          <Route path="/p/:pid" element={<ProjectPage />} />
          {isBuyer ? (
            <>
              <Route path="/p/:pid/l/:cid" element={<ConsultationLayout />}>
                <Route index element={<Navigate to="dpgf" replace />} />
                <Route path="dpgf" element={<DpgfTab />} />
                <Route path="offres" element={<OffersTab />} />
                <Route path="offres/:oid" element={<OfferEditor />} />
                <Route path="comparatif" element={<CompareTab />} />
                <Route path="decision" element={<DecisionTab />} />
                <Route path="synthese" element={<SynthesePage />} />
              </Route>
            </>
          ) : (
            <Route path="/p/:pid/l/:cid" element={<ResponsePage />} />
          )}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <Shell />
        <PasswordRecovery />
      </AuthProvider>
    </HashRouter>
  )
}
