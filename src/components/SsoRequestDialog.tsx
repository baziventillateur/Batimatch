import { useState, type FormEvent } from 'react'
import { CircleCheck, ShieldCheck } from 'lucide-react'
import { api, errorMessage } from '../data'
import type { SsoProvider } from '../data/rows'
import { Button, Dialog, Field, Spinner } from './ui'

const SSO_USER_COUNTS = ['1 à 10', '11 à 50', '51 à 200', 'Plus de 200']

const EMPTY = { company: '', contact: '', email: '', phone: '', users: SSO_USER_COUNTS[1], provider: 'microsoft' as SsoProvider, message: '' }

/** Demande d'activation de la connexion SSO, ouverte depuis la page de connexion (sans compte) */
export function SsoRequestDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState(EMPTY)
  // Champ invisible : un robot le remplit, une personne non
  const [trap, setTrap] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))

  const close = () => {
    onClose()
    if (sentTo) {
      setForm(EMPTY)
      setSentTo(null)
    }
    setError(null)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (!trap) await api.requestSso({ ...form, email: form.email.trim() })
      setSentTo(form.email.trim())
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onClose={close} title="Connexion entreprise par SSO">
      {sentTo ? (
        <div className="anim-pop flex flex-col items-start gap-3 py-2">
          <CircleCheck size={36} className="text-good" />
          <h3 className="font-title text-[1.5rem] leading-tight font-bold">Demande envoyée</h3>
          <p className="text-[0.9375rem] text-ink-2">
            {api.kind === 'mock' ? 'Démo : aucun e-mail n’est envoyé.' : <>Un accusé de réception vient de partir vers <strong className="font-semibold text-ink">{sentTo}</strong>.</>} Nous revenons vers vous rapidement pour
            préparer l’activation avec votre service informatique.
          </p>
          <Button variant="primary" onClick={close}>
            Fermer
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="grid gap-3.5">
          <p className="flex gap-2.5 rounded-md border border-plan/25 bg-plan-soft px-3 py-2.5 text-[0.8438rem] leading-snug text-ink-2">
            <ShieldCheck size={18} className="mt-0.5 shrink-0 text-plan" />
            <span>
              Vos collaborateurs se connectent à Batimatch avec leur compte professionnel <strong className="font-semibold text-ink">Microsoft</strong> (Entra ID, Microsoft 365) : pas de mot de passe
              supplémentaire, et un compte désactivé dans votre annuaire ne peut plus se connecter. Le SSO est activé sur demande, entreprise par entreprise.
            </span>
          </p>

          <Field label="Entreprise" htmlFor="sso-company">
            <input id="sso-company" className="field" required minLength={2} maxLength={120} autoComplete="organization" value={form.company} onChange={(e) => set({ company: e.target.value })} />
          </Field>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Votre nom" htmlFor="sso-contact">
              <input id="sso-contact" className="field" required minLength={2} maxLength={120} autoComplete="name" value={form.contact} onChange={(e) => set({ contact: e.target.value })} />
            </Field>
            <Field label="Téléphone (facultatif)" htmlFor="sso-phone">
              <input id="sso-phone" className="field" type="tel" maxLength={40} autoComplete="tel" value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
            </Field>
          </div>
          <Field label="E-mail professionnel" htmlFor="sso-email">
            <input id="sso-email" className="field" type="email" required maxLength={200} autoComplete="email" value={form.email} onChange={(e) => set({ email: e.target.value })} />
          </Field>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Utilisateurs estimés" htmlFor="sso-users">
              <select id="sso-users" className="field" value={form.users} onChange={(e) => set({ users: e.target.value })}>
                {SSO_USER_COUNTS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Annuaire d’entreprise" htmlFor="sso-provider">
              <select id="sso-provider" className="field" value={form.provider} onChange={(e) => set({ provider: e.target.value as SsoProvider })}>
                <option value="microsoft">Microsoft Entra ID (Microsoft 365)</option>
                <option value="other">Autre, à préciser</option>
              </select>
            </Field>
          </div>
          <Field label="Message (facultatif)" htmlFor="sso-message">
            <textarea id="sso-message" rows={2} maxLength={2000} className="field resize-y" value={form.message} onChange={(e) => set({ message: e.target.value })} />
          </Field>
          <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" value={trap} onChange={(e) => setTrap(e.target.value)} />

          {error && (
            <p className="anim-shake rounded-md bg-bad-soft px-3 py-2 text-[0.875rem] text-bad" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" variant="primary" disabled={busy} className="h-11">
            {busy && <Spinner />}
            Demander l’activation
          </Button>
          <p className="text-[0.75rem] leading-snug text-ink-3">Vos coordonnées servent uniquement à traiter cette demande.</p>
        </form>
      )}
    </Dialog>
  )
}
