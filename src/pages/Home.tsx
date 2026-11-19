import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, KeyRound, Lock, Plus, Sparkles } from 'lucide-react'
import { api, errorMessage } from '../data'
import { pendingCode, useAuth } from '../data/auth'
import type { ProjectListItem } from '../data/backend'
import { daysUntil, fmtDate } from '../lib/format'
import { Button, Dialog, EmptyState, ErrorBox, Field, Loading, Spinner, cx } from '../components/ui'

export default function Home() {
  const { profile } = useAuth()
  const [items, setItems] = useState<ProjectListItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      setItems(await api.listProjects())
    } catch (e) {
      setError(errorMessage(e))
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])

  if (!profile) return null
  return profile.role === 'buyer' ? <BuyerHome items={items} error={error} reload={load} /> : <CompanyHome items={items} error={error} reload={load} />
}

// ————————————————————————— Acheteur —————————————————————————

function BuyerHome({ items, error, reload }: { items: ProjectListItem[] | null; error: string | null; reload: () => void }) {
  const nav = useNavigate()
  const [creating, setCreating] = useState(false)
  const [seeding, setSeeding] = useState(false)

  const demo = async () => {
    setSeeding(true)
    try {
      nav(`/p/${await api.openExampleProject()}`)
    } catch (e) {
      alert(errorMessage(e))
    } finally {
      setSeeding(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-title text-[2.125rem] leading-none font-bold sm:text-[2.5rem]">Mes projets</h1>
          <p className="mt-2 text-ink-2">Un projet par affaire ; dans chaque projet, un lot par demande d’offre.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!!items?.length && (
            <Button variant="ghost" icon={seeding ? <Spinner /> : <Sparkles size={16} />} disabled={seeding} onClick={demo}>
              Projet exemple
            </Button>
          )}
          <Button variant="primary" icon={<Plus size={18} />} onClick={() => setCreating(true)}>
            Nouveau projet
          </Button>
        </div>
      </div>

      {error && <ErrorBox message={error} onRetry={reload} />}
      {!items && !error && <Loading />}
      {items && items.length === 0 && (
        <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
          <div className="panel flex flex-col gap-6 p-6 sm:p-8">
            <h2 className="font-title text-[1.75rem] leading-tight font-semibold">Lancer une consultation en trois temps</h2>
            <ol className="grid gap-4">
              {[
                ['Créez le projet et ses lots', 'Pour chaque lot : la DPGF (collée depuis Excel) et la date de rendu.'],
                ['Partagez le code du projet', 'Les entreprises créent leur compte, saisissent le code et répondent en ligne.'],
                ['Comparez et décidez', 'Podium, critères notés, commentaires internes et synthèse à présenter.'],
              ].map(([t, d], i) => (
                <li key={t} className="grid grid-cols-[2.25rem_1fr] gap-3">
                  <span className="num flex size-9 items-center justify-center rounded-full border border-ink/70 text-[1.0625rem] font-semibold">{i + 1}</span>
                  <div>
                    <p className="font-semibold">{t}</p>
                    <p className="text-ink-2">{d}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" icon={<Plus size={18} />} onClick={() => setCreating(true)}>
                Créer mon premier projet
              </Button>
              <Button icon={seeding ? <Spinner /> : <Sparkles size={16} />} disabled={seeding} onClick={demo}>
                Explorer le projet exemple
              </Button>
            </div>
          </div>
          <div className="panel hidden flex-col justify-center gap-3 p-8 text-ink-2 sm:flex">
            <p className="text-[0.875rem] text-ink-3">Ce que voient les entreprises</p>
            <div className="rounded-md border border-line p-4">
              <p className="text-[0.8125rem] text-ink-3">Code du projet</p>
              <p className="num text-[2.125rem] font-semibold tracking-[0.2em] text-ink">K7M4QX</p>
            </div>
            <p className="text-[0.875rem]">Elles ne voient ni votre budget, ni les offres concurrentes, ni vos notes.</p>
          </div>
        </div>
      )}
      {items && items.length > 0 && (
        <ul className="grid gap-3 md:grid-cols-2">
          {items.map((it) => (
            <ProjectCard key={it.project.id} it={it} />
          ))}
        </ul>
      )}

      <ProjectForm
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(id) => {
          setCreating(false)
          nav(`/p/${id}`)
        }}
      />
    </div>
  )
}

function ProjectCard({ it }: { it: ProjectListItem }) {
  const next = useMemo(() => {
    const upcoming = it.lots.map((l) => daysUntil(l.due_date)).filter((d): d is number => d != null && d >= 0)
    return upcoming.length ? Math.min(...upcoming) : null
  }, [it.lots])
  const submitted = it.offers.filter((o) => o.status === 'submitted').length
  return (
    <li>
      <Link to={`/p/${it.project.id}`} className="panel group flex h-full flex-col gap-4 p-5 transition-colors hover:border-ink-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-[1.1875rem] font-semibold">{it.project.name}</h3>
            <p className="truncate text-[0.8438rem] text-ink-3">
              {it.project.locked_at && (
                <span className="mr-1.5 inline-flex items-center gap-1 rounded-[3px] bg-warn-soft px-1.5 py-px text-[0.75rem] font-semibold text-warn">
                  <Lock size={11} /> Verrouillé
                </span>
              )}
              {it.project.is_example && <span className="mr-1.5 rounded-[3px] bg-plan-soft px-1.5 py-px text-[0.75rem] font-semibold text-plan">Exemple</span>}
              {it.project.reference || 'Sans référence'}
            </p>
          </div>
          {!it.project.is_example && (
            <span className="num shrink-0 rounded-[4px] border border-ink/70 px-2 py-0.5 text-[0.8125rem] font-semibold tracking-[0.12em]">{it.project.access_code}</span>
          )}
        </div>
        <dl className="grid grid-cols-3 gap-3 text-[0.875rem]">
          <div>
            <dt className="text-[0.7812rem] text-ink-3">Lots</dt>
            <dd className="num font-semibold">{it.lots.length}</dd>
          </div>
          <div>
            <dt className="text-[0.7812rem] text-ink-3">Offres reçues</dt>
            <dd className="num font-semibold">{submitted}</dd>
          </div>
          <div>
            <dt className="text-[0.7812rem] text-ink-3">Prochaine remise</dt>
            <dd className={cx('num font-semibold', next != null && next <= 3 && 'text-warn')}>{next == null ? '—' : next === 0 ? 'ce soir' : `J−${next}`}</dd>
          </div>
        </dl>
        <span className="mt-auto inline-flex items-center gap-1 text-[0.875rem] font-medium text-plan">
          Ouvrir le projet <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
        </span>
      </Link>
    </li>
  )
}

export function ProjectForm({
  open,
  onClose,
  onCreated,
  initial,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  onCreated?: (id: string) => void
  initial?: { id: string; name: string; reference: string; description: string }
  onSaved?: () => void
}) {
  return (
    <Dialog open={open} onClose={onClose} title={initial ? 'Modifier le projet' : 'Nouveau projet'}>
      {open && <ProjectFormBody onClose={onClose} onCreated={onCreated} initial={initial} onSaved={onSaved} />}
    </Dialog>
  )
}

function ProjectFormBody({
  onClose,
  onCreated,
  initial,
  onSaved,
}: {
  onClose: () => void
  onCreated?: (id: string) => void
  initial?: { id: string; name: string; reference: string; description: string }
  onSaved?: () => void
}) {
  const [f, setF] = useState({ name: initial?.name ?? '', reference: initial?.reference ?? '', description: initial?.description ?? '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <form
      className="grid gap-4"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        setError(null)
        try {
          if (initial) {
            await api.updateProject(initial.id, { name: f.name.trim(), reference: f.reference.trim(), description: f.description })
            onSaved?.()
          } else {
            const p = await api.createProject({ name: f.name.trim(), reference: f.reference.trim(), description: f.description })
            onCreated?.(p.id)
          }
        } catch (err) {
          setError(errorMessage(err))
        } finally {
          setBusy(false)
        }
      }}
    >
      <Field label="Nom du projet" htmlFor="pr-name">
        <input id="pr-name" className="field" required autoFocus placeholder="Ex. Logements Paris 17e" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      </Field>
      <Field label="Référence de l’affaire" htmlFor="pr-ref">
        <input id="pr-ref" className="field" placeholder="Ex. 24-017" value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} />
      </Field>
      <Field label="Présentation pour les entreprises" htmlFor="pr-desc" hint="Adresse du chantier, planning, contacts… visible des entreprises.">
        <textarea id="pr-desc" rows={3} className="field resize-y" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
      </Field>
      {error && <p className="text-[0.875rem] text-bad">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Annuler
        </Button>
        <Button type="submit" variant="primary" disabled={busy || !f.name.trim()}>
          {busy && <Spinner />} {initial ? 'Enregistrer' : 'Créer le projet'}
        </Button>
      </div>
    </form>
  )
}

// ————————————————————————— Entreprise —————————————————————————

function CompanyHome({ items, error, reload }: { items: ProjectListItem[] | null; error: string | null; reload: () => void }) {
  const nav = useNavigate()
  const { userId } = useAuth()
  const [autoJoin, setAutoJoin] = useState(() => pendingCode.get())

  // Arrivée par un lien d'invitation : on rejoint le projet automatiquement
  useEffect(() => {
    if (!autoJoin) return
    let alive = true
    api
      .joinProject(autoJoin)
      .then((pid) => alive && nav(`/p/${pid}`))
      .catch(() => {})
      .finally(() => {
        pendingCode.clear()
        if (alive) setAutoJoin(null)
      })
    return () => {
      alive = false
    }
  }, [autoJoin, nav])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-title text-[2.125rem] leading-none font-bold sm:text-[2.5rem]">Mes consultations</h1>
        <p className="mt-2 text-ink-2">Les projets sur lesquels vous êtes invité à remettre une offre.</p>
      </div>
      <JoinCodeBox onJoined={(pid) => nav(`/p/${pid}`)} />
      {error && <ErrorBox message={error} onRetry={reload} />}
      {(!items || autoJoin) && !error && <Loading />}
      {items && !autoJoin && items.length === 0 && (
        <EmptyState title="Aucun projet pour l’instant">Saisissez ci-dessus le code transmis par l’acheteur pour accéder à ses demandes d’offre.</EmptyState>
      )}
      {items && items.length > 0 && (
        <ul className="grid gap-3 md:grid-cols-2">
          {items.map((it) => {
            const mine = it.offers.filter((o) => o.company_id === userId)
            const sent = mine.filter((o) => o.status === 'submitted').length
            const open = it.lots.filter((l) => (daysUntil(l.due_date) ?? 0) >= 0)
            return (
              <li key={it.project.id}>
                <Link to={`/p/${it.project.id}`} className="panel group flex h-full flex-col gap-3 p-5 hover:border-ink-3">
                  <h3 className="text-[1.1875rem] font-semibold">{it.project.name}</h3>
                  <p className="text-[0.875rem] text-ink-2">
                    <span className="num font-semibold text-ink">{it.lots.length}</span> lot{it.lots.length > 1 ? 's' : ''},{' '}
                    <span className="num font-semibold text-ink">{sent}</span> offre{sent > 1 ? 's' : ''} envoyée{sent > 1 ? 's' : ''}
                    {open.length > 0 && (
                      <>
                        , prochaine remise le <span className="num font-medium">{fmtDate([...open].sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))[0].due_date)}</span>
                      </>
                    )}
                  </p>
                  <span className="mt-auto inline-flex items-center gap-1 text-[0.875rem] font-medium text-plan">
                    Voir les lots <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export function JoinCodeBox({ onJoined, initial = '' }: { onJoined: (pid: string) => void; initial?: string }) {
  const [code, setCode] = useState(initial.toUpperCase())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shakeKey, setShakeKey] = useState(0)
  const clean = code.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6)
  return (
    <form
      className="panel grid gap-4 p-5 md:grid-cols-[1fr_auto] md:items-center"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        setError(null)
        try {
          onJoined(await api.joinProject(clean))
        } catch (err) {
          setError(errorMessage(err))
          setShakeKey((k) => k + 1)
        } finally {
          setBusy(false)
        }
      }}
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="join-code" className="flex items-center gap-2 text-[1.0625rem] font-semibold">
          <KeyRound size={18} className="text-plan" /> Rejoindre un projet
        </label>
        <p className="text-[0.875rem] text-ink-2">Saisissez le code de 6 caractères transmis par l’acheteur.</p>
        {error && (
          <p className="text-[0.875rem] text-bad" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <div key={shakeKey} className={cx('w-full md:w-[260px]', shakeKey > 0 && 'anim-shake')}>
          <input
            id="join-code"
            className="field num h-14 text-center text-[1.75rem] font-semibold tracking-[0.4em] uppercase"
            placeholder="······"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            value={clean}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>
        <Button type="submit" variant="primary" className="h-14 px-5" disabled={busy || clean.length < 6}>
          {busy ? <Spinner /> : <ArrowRight size={18} />} Accéder
        </Button>
      </div>
    </form>
  )
}
