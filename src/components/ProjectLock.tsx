import { useEffect, useState } from 'react'
import { Lock, LockOpen, Mail } from 'lucide-react'
import { api, errorMessage } from '../data'
import { Button, Dialog, Field, Spinner } from './ui'

/** Événement émis quand une modification est tentée sur un projet verrouillé */
export const LOCKED_EVENT = 'batimatch:locked'

export type LockMode = 'set' | 'unlock' | null

/**
 * Verrouillage d'un projet par code.
 * « set » : premier verrouillage, on choisit le code. « unlock » : saisie du code, avec « Code oublié ? ».
 */
export function ProjectLockDialog({ projectId, projectName, mode, onClose, onDone }: { projectId: string; projectName: string; mode: LockMode; onClose: () => void; onDone: () => void }) {
  return (
    <Dialog open={mode != null} onClose={onClose} title={mode === 'set' ? 'Verrouiller le projet' : 'Déverrouiller le projet'}>
      {mode === 'set' && <SetCode projectId={projectId} projectName={projectName} onClose={onClose} onDone={onDone} />}
      {mode === 'unlock' && <Unlock projectId={projectId} onClose={onClose} onDone={onDone} />}
    </Dialog>
  )
}

const CODE_HELP = '4 caractères au moins. Il vous sera demandé pour modifier à nouveau ce projet.'

function SetCode({ projectId, projectName, onClose, onDone }: { projectId: string; projectName: string; onClose: () => void; onDone: () => void }) {
  const [code, setCode] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (code.trim().length < 4) return setError('Le code doit faire au moins 4 caractères.')
    if (code !== confirm) return setError('Les deux codes ne sont pas identiques.')
    setBusy(true)
    setError(null)
    try {
      await api.lockProject(projectId, code)
      onDone()
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <p className="text-[0.9062rem] text-ink-2">
        « {projectName} » restera consultable, mais plus rien ne pourra y être modifié, ni par vous ni par les entreprises, tant qu’il n’est pas déverrouillé avec ce code.
      </p>
      <Field label="Code de déverrouillage" htmlFor="lock-code" hint={CODE_HELP}>
        <input id="lock-code" type="password" autoComplete="new-password" autoFocus className="field" value={code} onChange={(e) => setCode(e.target.value)} />
      </Field>
      <Field label="Confirmer le code" htmlFor="lock-confirm">
        <input id="lock-confirm" type="password" autoComplete="new-password" className="field" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </Field>
      {error && (
        <p className="text-[0.875rem] text-bad" role="alert">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          Annuler
        </Button>
        <Button type="submit" variant="primary" disabled={busy} icon={busy ? <Spinner /> : <Lock size={15} />}>
          Verrouiller
        </Button>
      </div>
    </form>
  )
}

function Unlock({ projectId, onClose, onDone }: { projectId: string; onClose: () => void; onDone: () => void }) {
  const [step, setStep] = useState<'code' | 'reset'>('code')
  const [code, setCode] = useState('')
  const [reset, setReset] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const BLOCKED = 'Trop d’essais : réessayez dans 15 minutes.'

  const unlock = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const r = await api.unlockProject(projectId, code)
      if (r === 'ok') return onDone()
      setError(r === 'blocked' ? BLOCKED : 'Code incorrect.')
    } catch (err) {
      setError(errorMessage(err))
    }
    setBusy(false)
  }
  const forgot = async () => {
    setBusy(true)
    setError(null)
    try {
      await api.requestLockReset(projectId)
      setInfo('Un code à 6 chiffres vient de vous être envoyé par e-mail. Il est valable 30 minutes.')
      setStep('reset')
    } catch (err) {
      const msg = errorMessage(err)
      // Une demande récente : le code déjà envoyé reste valable
      if (/déjà été envoyé/.test(msg)) {
        setInfo(msg)
        setStep('reset')
      } else setError(msg)
    }
    setBusy(false)
  }
  const change = async (e: React.FormEvent) => {
    e.preventDefault()
    if (next.trim().length < 4) return setError('Le nouveau code doit faire au moins 4 caractères.')
    if (next !== confirm) return setError('Les deux codes ne sont pas identiques.')
    setBusy(true)
    setError(null)
    try {
      const r = await api.resetLockCode(projectId, reset, next)
      if (r === 'ok') return onDone()
      setError(r === 'blocked' ? BLOCKED : r === 'expired' ? 'Ce code a expiré : demandez-en un nouveau.' : 'Le code reçu par e-mail est incorrect.')
    } catch (err) {
      setError(errorMessage(err))
    }
    setBusy(false)
  }

  if (step === 'reset') {
    return (
      <form onSubmit={change} className="flex flex-col gap-3">
        {info && (
          <p className="flex items-start gap-2 rounded-md bg-plan-soft px-3 py-2 text-[0.875rem]" role="status">
            <Mail size={16} className="mt-0.5 shrink-0 text-plan" /> {info}
          </p>
        )}
        <Field label="Code reçu par e-mail" htmlFor="lock-reset">
          <input id="lock-reset" inputMode="numeric" autoComplete="one-time-code" autoFocus className="field num tracking-[0.3em]" maxLength={6} value={reset} onChange={(e) => setReset(e.target.value.replace(/\D/g, ''))} />
        </Field>
        <Field label="Nouveau code de déverrouillage" htmlFor="lock-new" hint={CODE_HELP}>
          <input id="lock-new" type="password" autoComplete="new-password" className="field" value={next} onChange={(e) => setNext(e.target.value)} />
        </Field>
        <Field label="Confirmer le nouveau code" htmlFor="lock-new2">
          <input id="lock-new2" type="password" autoComplete="new-password" className="field" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        {error && (
          <p className="text-[0.875rem] text-bad" role="alert">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => (setStep('code'), setError(null))}>
            Retour
          </Button>
          <Button type="submit" variant="primary" disabled={busy || reset.length < 6} icon={busy ? <Spinner /> : <LockOpen size={15} />}>
            Changer le code et déverrouiller
          </Button>
        </div>
      </form>
    )
  }
  return (
    <form onSubmit={unlock} className="flex flex-col gap-3">
      <Field label="Code de déverrouillage" htmlFor="unlock-code">
        <input id="unlock-code" type="password" autoComplete="off" autoFocus className="field" value={code} onChange={(e) => setCode(e.target.value)} />
      </Field>
      {error && (
        <p className="text-[0.875rem] text-bad" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" className="text-[0.875rem] text-plan underline-offset-2 hover:underline" disabled={busy} onClick={forgot}>
          Code oublié ?
        </button>
        <span className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" variant="primary" disabled={busy || !code} icon={busy ? <Spinner /> : <LockOpen size={15} />}>
            Déverrouiller
          </Button>
        </span>
      </div>
    </form>
  )
}

/** Message bref quand on tente de modifier un projet verrouillé */
export function LockedToast() {
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const on = () => setShown(Date.now())
    window.addEventListener(LOCKED_EVENT, on)
    return () => window.removeEventListener(LOCKED_EVENT, on)
  }, [])
  useEffect(() => {
    if (!shown) return
    const t = setTimeout(() => setShown(0), 3200)
    return () => clearTimeout(t)
  }, [shown])
  if (!shown) return null
  return (
    <div key={shown} role="status" className="anim-rise no-print fixed inset-x-3 bottom-4 z-50 mx-auto flex max-w-sm items-center gap-2 rounded-lg bg-night px-3.5 py-2.5 text-[0.875rem] text-white shadow-[var(--shadow-3)]">
      <Lock size={16} className="shrink-0 text-marker" /> Projet verrouillé : déverrouillez-le depuis la page du projet pour modifier.
    </div>
  )
}
