import { useState, type FormEvent } from 'react'
import { Building2, HardHat, MailCheck } from 'lucide-react'
import { api, errorMessage } from '../data'
import { pendingCode, useAuth } from '../data/auth'
import type { Role } from '../lib/types'
import { Button, Field, Spinner, cx } from '../components/ui'

type Mode = 'login' | 'signup' | 'reset' | 'sent' | 'reset-sent'

export default function AuthPage() {
  const { userId, profile } = useAuth()
  const code = pendingCode.get()
  const [mode, setMode] = useState<Mode>(code ? 'signup' : 'login')
  const [role, setRole] = useState<Role>(code ? 'company' : 'buyer')
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '', companyName: '', phone: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))

  // Connecté mais sans profil : on le complète
  if (userId && !profile) return <CompleteProfile />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (mode === 'login') await api.signIn(form.email.trim(), form.password)
      else if (mode === 'signup') {
        const { needsConfirmation } = await api.signUp({ ...form, email: form.email.trim(), role })
        if (needsConfirmation) setMode('sent')
      } else if (mode === 'reset') {
        await api.resetPassword(form.email.trim())
        setMode('reset-sent')
      }
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* Panneau de présentation */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-ink p-10 text-white lg:flex">
        <div className="flex items-center gap-2.5">
          <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
            <rect width="32" height="32" rx="6" fill="#F3F5F8" />
            <rect x="6" y="19" width="5" height="7" fill="#1B2A3A" />
            <rect x="13.5" y="13" width="5" height="13" fill="#1B2A3A" />
            <rect x="21" y="8" width="5" height="18" fill="#F8E04E" />
          </svg>
          <span className="font-title text-[26px] font-bold">batimatch</span>
        </div>
        <div className="max-w-[30rem]">
          <h1 className="font-title text-[46px] leading-[1.02] font-bold">
            Vos consultations d’entreprises, de la DPGF au <span className="marker marker-strong anim-marker text-ink">bon choix</span>.
          </h1>
          <ul className="mt-8 grid gap-4 text-[16px] text-white/85">
            <li>L’acheteur publie ses lots avec une date de rendu et partage un code projet.</li>
            <li>Les entreprises répondent en ligne, prix unitaires, variantes et options.</li>
            <li>Le comparatif et l’aide à la décision se construisent tout seuls.</li>
          </ul>
        </div>
        <Bars />
      </aside>

      {/* Formulaire */}
      <main className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-[440px]">
          <div className="mb-6 flex items-center gap-2.5 lg:hidden">
            <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
              <rect width="32" height="32" rx="6" fill="#1B2A3A" />
              <rect x="6" y="19" width="5" height="7" fill="#F3F5F8" />
              <rect x="13.5" y="13" width="5" height="13" fill="#F3F5F8" />
              <rect x="21" y="8" width="5" height="18" fill="#F8E04E" />
            </svg>
            <span className="font-title text-[23px] font-bold">batimatch</span>
          </div>
          <p className="-mt-3 mb-6 text-[15px] text-ink-2 lg:hidden">Vos consultations d’entreprises, de la DPGF au bon choix.</p>

          {code && (
            <p className="mb-5 rounded-md border border-plan/25 bg-plan-soft px-4 py-3 text-[14.5px]">
              Vous avez été invité sur un projet (code <strong className="num tracking-wider">{code}</strong>). Créez votre compte entreprise ou
              connectez-vous pour y accéder.
            </p>
          )}

          {mode === 'sent' || mode === 'reset-sent' ? (
            <div className="anim-pop flex flex-col items-start gap-4">
              <MailCheck size={40} className="text-plan" />
              <h2 className="font-title text-[32px] leading-tight font-bold">Vérifiez votre boîte mail</h2>
              <p className="text-ink-2">
                {mode === 'sent'
                  ? `Un lien de confirmation a été envoyé à ${form.email}. Cliquez dessus, puis revenez vous connecter.`
                  : `Si un compte existe pour ${form.email}, un lien pour choisir un nouveau mot de passe vient d’être envoyé.`}
              </p>
              <Button onClick={() => setMode('login')}>Revenir à la connexion</Button>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="font-title text-[34px] leading-tight font-bold">
                  {mode === 'login' ? 'Connexion' : mode === 'signup' ? 'Créer un compte' : 'Mot de passe oublié'}
                </h2>
                {mode !== 'reset' && (
                  <p className="mt-1 text-ink-2">
                    {mode === 'login' ? 'Pas encore de compte ? ' : 'Déjà inscrit ? '}
                    <button type="button" className="font-medium text-plan underline-offset-2 hover:underline" onClick={() => (setMode(mode === 'login' ? 'signup' : 'login'), setError(null))}>
                      {mode === 'login' ? 'Créer un compte' : 'Se connecter'}
                    </button>
                  </p>
                )}
              </div>

              <form onSubmit={submit} className="grid gap-4">
                {mode === 'signup' && (
                  <fieldset className="grid grid-cols-2 gap-2.5">
                    <legend className="mb-2 text-[13.5px] font-medium text-ink-2">Vous êtes</legend>
                    {(
                      [
                        { v: 'buyer', icon: <HardHat size={22} />, t: 'Acheteur', d: 'Je lance des consultations' },
                        { v: 'company', icon: <Building2 size={22} />, t: 'Entreprise', d: 'Je réponds aux consultations' },
                      ] as const
                    ).map((o) => (
                      <label
                        key={o.v}
                        className={cx(
                          'flex cursor-pointer flex-col gap-1 rounded-md border-2 p-3 transition-colors',
                          role === o.v ? 'border-ink bg-sheet' : 'border-line bg-sheet/60 hover:border-ink-3',
                        )}
                      >
                        <input type="radio" name="role" value={o.v} checked={role === o.v} onChange={() => setRole(o.v)} className="sr-only" />
                        <span className={cx('transition-transform', role === o.v && 'scale-110 text-plan')}>{o.icon}</span>
                        <span className="font-semibold">{o.t}</span>
                        <span className="text-[13px] leading-snug text-ink-2">{o.d}</span>
                      </label>
                    ))}
                  </fieldset>
                )}

                {mode === 'signup' && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Prénom" htmlFor="a-first">
                        <input id="a-first" className="field" required autoComplete="given-name" value={form.firstName} onChange={(e) => set({ firstName: e.target.value })} />
                      </Field>
                      <Field label="Nom" htmlFor="a-last">
                        <input id="a-last" className="field" required autoComplete="family-name" value={form.lastName} onChange={(e) => set({ lastName: e.target.value })} />
                      </Field>
                    </div>
                    <Field label="Entreprise" htmlFor="a-company">
                      <input id="a-company" className="field" required autoComplete="organization" value={form.companyName} onChange={(e) => set({ companyName: e.target.value })} />
                    </Field>
                    <Field label="Téléphone de l’entreprise" htmlFor="a-phone">
                      <input id="a-phone" className="field" type="tel" autoComplete="tel" value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
                    </Field>
                  </>
                )}

                <Field label="Email" htmlFor="a-email">
                  <input id="a-email" className="field" type="email" required autoComplete="email" value={form.email} onChange={(e) => set({ email: e.target.value })} />
                </Field>
                {mode !== 'reset' && (
                  <Field label="Mot de passe" htmlFor="a-pass" hint={mode === 'signup' ? '6 caractères minimum.' : undefined}>
                    <input
                      id="a-pass"
                      className="field"
                      type="password"
                      required
                      minLength={6}
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      value={form.password}
                      onChange={(e) => set({ password: e.target.value })}
                    />
                  </Field>
                )}

                {error && (
                  <p className="anim-shake rounded-md bg-bad-soft px-3 py-2 text-[14px] text-bad" role="alert">
                    {error}
                  </p>
                )}

                <Button type="submit" variant="primary" disabled={busy} className="mt-1 h-11">
                  {busy && <Spinner />}
                  {mode === 'login' ? 'Se connecter' : mode === 'signup' ? 'Créer mon compte' : 'Recevoir le lien'}
                </Button>
                {mode === 'login' && (
                  <button type="button" className="justify-self-start text-[14px] text-ink-2 hover:text-ink" onClick={() => (setMode('reset'), setError(null))}>
                    Mot de passe oublié ?
                  </button>
                )}
                {mode === 'reset' && (
                  <button type="button" className="justify-self-start text-[14px] text-ink-2 hover:text-ink" onClick={() => setMode('login')}>
                    Revenir à la connexion
                  </button>
                )}
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

/** Barres qui montent : un clin d'œil au comparatif */
function Bars() {
  const bars = [46, 72, 58, 92, 64]
  return (
    <div className="flex h-32 items-end gap-3" aria-hidden="true">
      {bars.map((h, i) => (
        <span
          key={i}
          className="anim-rise w-10 rounded-t-[4px]"
          style={{ height: `${h}%`, background: i === 1 ? 'var(--color-marker)' : 'rgb(255 255 255 / 0.18)', animationDelay: `${0.15 + i * 0.09}s` }}
        />
      ))}
    </div>
  )
}

function CompleteProfile() {
  const { userId, setProfile } = useAuth()
  const [form, setForm] = useState({ firstName: '', lastName: '', companyName: '', phone: '', role: 'buyer' as Role })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  return (
    <main className="mx-auto flex min-h-dvh max-w-[440px] flex-col justify-center gap-5 px-4">
      <h1 className="font-title text-[32px] font-bold">Complétez votre profil</h1>
      <form
        className="grid gap-3"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          try {
            const { toProfile } = await import('../data/rows')
            const row = await api.updateProfile(userId!, {
              role: form.role,
              first_name: form.firstName,
              last_name: form.lastName,
              company_name: form.companyName,
              phone: form.phone,
            })
            setProfile(toProfile(row))
          } catch (err) {
            setError(errorMessage(err))
          } finally {
            setBusy(false)
          }
        }}
      >
        <select className="field" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })} aria-label="Type de compte">
          <option value="buyer">Acheteur : je lance des consultations</option>
          <option value="company">Entreprise : je réponds aux consultations</option>
        </select>
        <input className="field" placeholder="Prénom" required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
        <input className="field" placeholder="Nom" required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
        <input className="field" placeholder="Entreprise" required value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
        <input className="field" placeholder="Téléphone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        {error && <p className="text-[14px] text-bad">{error}</p>}
        <Button type="submit" variant="primary" disabled={busy}>
          Enregistrer
        </Button>
        <Button variant="ghost" onClick={() => api.signOut()}>
          Se déconnecter
        </Button>
      </form>
    </main>
  )
}
