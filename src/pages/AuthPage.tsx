import { useEffect, useState, type CSSProperties, type FormEvent, type PointerEvent } from 'react'
import { Building2, CalendarClock, HardHat, MailCheck } from 'lucide-react'
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

  // Parallaxe légère : la scène suit le pointeur (souris uniquement)
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse') return
    const el = e.currentTarget
    const r = el.getBoundingClientRect()
    el.style.setProperty('--px', (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3))
    el.style.setProperty('--py', (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3))
  }

  return (
    <div className="auth-bg relative min-h-dvh overflow-hidden bg-night text-white" onPointerMove={onMove}>
      <div className="auth-glow" aria-hidden="true" />
      <div className="auth-grid" aria-hidden="true" />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-[1200px] flex-col px-4 sm:px-8 lg:px-12">
        <header className="auth-in flex items-center gap-2.5 py-5 lg:py-8">
          <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
            <rect width="32" height="32" rx="6" fill="#F3F5F8" />
            <rect x="6" y="19" width="5" height="7" fill="#1B2A3A" />
            <rect x="13.5" y="13" width="5" height="13" fill="#1B2A3A" />
            <rect x="21" y="8" width="5" height="18" fill="#F8E04E" />
          </svg>
          <span className="grid leading-none">
            <span className="font-title text-[1.625rem] leading-none font-bold">Batimatch</span>
            <a href="https://paceapp.fr" target="_blank" rel="noreferrer" className="auth-by mt-1 text-[0.75rem] text-white/55 hover:text-white">
              by <span className="font-semibold text-white/85">PaceApp</span>
            </a>
          </span>
        </header>

        <div className="grid flex-1 content-start items-center gap-5 pb-8 lg:grid-cols-[minmax(0,1fr)_440px] lg:content-center lg:gap-16 lg:pb-16 xl:gap-24">
          {/* Présentation */}
          <section className="hidden lg:block">
            <h1 className="auth-in max-w-[34rem] font-title text-[3.25rem] leading-[1.02] font-bold xl:text-[3.625rem]" style={{ animationDelay: '0.08s' }}>
              Vos consultations d’entreprises, de la DPGF au <span className="marker marker-strong anim-marker">bon choix</span>.
            </h1>
            <ol className="auth-steps mt-7 grid max-w-[31rem] gap-3 text-[1rem] text-white/85">
              <li className="auth-in" style={{ animationDelay: '0.22s' }}>
                L’acheteur publie ses lots avec une date de rendu et partage un code projet.
              </li>
              <li className="auth-in" style={{ animationDelay: '0.34s' }}>
                Les entreprises répondent en ligne, prix unitaires, variantes et options.
              </li>
              <li className="auth-in" style={{ animationDelay: '0.46s' }}>
                Le comparatif et l’aide à la décision se construisent tout seuls.
              </li>
            </ol>
            <Scene />
          </section>

          <p className="auth-in text-[1rem] text-white/80 lg:hidden">Vos consultations d’entreprises, de la DPGF au bon choix.</p>

          {/* Formulaire */}
          <main className="auth-card w-full max-w-[440px] justify-self-center rounded-xl bg-sheet p-5 text-ink sm:p-8 lg:justify-self-end">
          {code && (
            <p className="mb-5 rounded-md border border-plan/25 bg-plan-soft px-4 py-3 text-[0.9062rem]">
              Vous avez été invité sur un projet (code <strong className="num tracking-wider">{code}</strong>). Créez votre compte entreprise ou
              connectez-vous pour y accéder.
            </p>
          )}

          {mode === 'sent' || mode === 'reset-sent' ? (
            <div className="anim-pop flex flex-col items-start gap-4">
              <MailCheck size={40} className="text-plan" />
              <h2 className="font-title text-[2rem] leading-tight font-bold">Vérifiez votre boîte mail</h2>
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
                <h2 className="font-title text-[2.125rem] leading-tight font-bold">
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
                    <legend className="mb-2 text-[0.8438rem] font-medium text-ink-2">Vous êtes</legend>
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
                        <span className="text-[0.8125rem] leading-snug text-ink-2">{o.d}</span>
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
                  <p className="anim-shake rounded-md bg-bad-soft px-3 py-2 text-[0.875rem] text-bad" role="alert">
                    {error}
                  </p>
                )}

                <Button type="submit" variant="primary" disabled={busy} className="mt-1 h-11">
                  {busy && <Spinner />}
                  {mode === 'login' ? 'Se connecter' : mode === 'signup' ? 'Créer mon compte' : 'Recevoir le lien'}
                </Button>
                {mode === 'login' && (
                  <button type="button" className="justify-self-start text-[0.875rem] text-ink-2 hover:text-ink" onClick={() => (setMode('reset'), setError(null))}>
                    Mot de passe oublié ?
                  </button>
                )}
                {mode === 'reset' && (
                  <button type="button" className="justify-self-start text-[0.875rem] text-ink-2 hover:text-ink" onClick={() => setMode('login')}>
                    Revenir à la connexion
                  </button>
                )}
              </form>
            </>
          )}
          </main>
        </div>
      </div>
    </div>
  )
}

const OFFERS = [
  { name: 'Entreprise A', amount: 412300 },
  { name: 'Entreprise B', amount: 386900 },
  { name: 'Entreprise C', amount: 428750 },
]

/** Montant qui défile jusqu'à sa valeur, une seule fois à l'arrivée sur la page */
function CountUp({ to, delay }: { to: number; delay: number }) {
  const [v, setV] = useState(0)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return setV(to)
    let raf = 0
    const start = performance.now() + delay
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / 900))
      setV(Math.round(to * (1 - Math.pow(1 - t, 3))))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [to, delay])
  return <>{v.toLocaleString('fr-FR')} €</>
}

/** Aperçu d'un comparatif : trois offres, le surligneur passe sur la moins-disante */
function Scene() {
  const max = Math.max(...OFFERS.map((o) => o.amount))
  const min = Math.min(...OFFERS.map((o) => o.amount))
  return (
    <div className="auth-scene relative mt-10 h-[15rem] max-w-[33rem]" aria-hidden="true">
      <div className="auth-layer absolute -top-3 right-0" style={{ '--depth': '22px' } as CSSProperties}>
        <div className="auth-chip auth-float anim-pop" style={{ animationDelay: '1.1s, 1.6s' }}>
          <span className="text-[0.75rem] text-white/60">Code projet</span>
          <span className="num text-[1rem] font-semibold tracking-[0.14em]">BM-4F7K</span>
        </div>
      </div>

      <div className="auth-layer auth-tilt absolute top-5 left-0 w-[27rem]" style={{ '--depth': '10px' } as CSSProperties}>
        <div className="auth-glass anim-pop rounded-lg p-4" style={{ animationDelay: '0.55s' }}>
          <div className="mb-3 flex items-baseline justify-between">
            <span className="font-title text-[1.1875rem] font-bold">Lot 03, gros œuvre</span>
            <span className="text-[0.8125rem] text-white/60">3 offres reçues</span>
          </div>
          <div className="grid gap-2.5">
            {OFFERS.map((o, i) => {
              const best = o.amount === min
              const d = 0.8 + i * 0.14
              return (
                <div key={o.name} className="grid grid-cols-[6.25rem_1fr_7rem] items-center gap-3 text-[0.875rem]">
                  <span className={best ? 'font-semibold' : 'text-white/75'}>{o.name}</span>
                  <span className="h-2.5 overflow-hidden rounded-full bg-white/10">
                    <span
                      className="anim-grow block h-full rounded-full"
                      style={{ width: `${(o.amount / max) * 100}%`, background: best ? 'var(--color-marker)' : 'rgb(255 255 255 / 0.32)', animationDelay: `${d}s` }}
                    />
                  </span>
                  <span className="num pr-1 text-right">
                    {best ? (
                      <span className="marker anim-marker font-semibold" style={{ animationDelay: '2s' }}>
                        <CountUp to={o.amount} delay={d * 1000} />
                      </span>
                    ) : (
                      <span className="text-white/75">
                        <CountUp to={o.amount} delay={d * 1000} />
                      </span>
                    )}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="auth-layer absolute bottom-0 left-[17.5rem]" style={{ '--depth': '30px' } as CSSProperties}>
        <div className="auth-chip auth-float anim-pop" style={{ animationDelay: '1.3s, 2.4s' }}>
          <span className="text-[0.75rem] text-white/60">Rendu des offres</span>
          <span className="flex items-center gap-1.5 text-[1rem] font-semibold">
            <CalendarClock size={16} className="text-marker" /> J−3
          </span>
        </div>
      </div>
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
      <h1 className="font-title text-[2rem] font-bold">Complétez votre profil</h1>
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
        {error && <p className="text-[0.875rem] text-bad">{error}</p>}
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
