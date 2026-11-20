import { useMemo, useState } from 'react'
import { Check, MailPlus, Send, X } from 'lucide-react'
import { api, errorMessage } from '../data'
import type { LotRow } from '../data/rows'
import { fmtDate } from '../lib/format'
import { Button, Dialog, Spinner, cx } from './ui'

type LotLite = Pick<LotRow, 'id' | 'name' | 'due_date' | 'status'>
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/

/**
 * Inviter une ou plusieurs entreprises par e-mail sur un ou plusieurs lots.
 * Depuis un lot : ce lot est déjà coché. Depuis le projet : on choisit les lots.
 */
export function InviteCompanyDialog({ open, onClose, projectId, lots, preselect, onSent }: { open: boolean; onClose: () => void; projectId: string; lots: LotLite[]; preselect?: string[]; onSent?: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Inviter une entreprise">
      {open && <Body projectId={projectId} lots={lots} preselect={preselect} onClose={onClose} onSent={onSent} />}
    </Dialog>
  )
}

function Body({ projectId, lots, preselect, onClose, onSent }: { projectId: string; lots: LotLite[]; preselect?: string[]; onClose: () => void; onSent?: () => void }) {
  const [emails, setEmails] = useState<string[]>([])
  const [draft, setDraft] = useState('')
  const [picked, setPicked] = useState<Set<string>>(new Set(preselect ?? (lots.length === 1 ? [lots[0].id] : [])))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ emails: string[]; example: boolean } | null>(null)

  /** Découpe ce qui est tapé ou collé : virgules, points-virgules, espaces, retours à la ligne */
  const absorb = (text: string, final: boolean) => {
    const parts = text.split(/[\s,;]+/)
    const rest = final ? '' : (parts.pop() ?? '')
    const good = parts.map((p) => p.trim().toLowerCase()).filter((p) => EMAIL_RE.test(p))
    const bad = parts.filter((p) => p.trim() && !EMAIL_RE.test(p.trim()))
    if (good.length) setEmails((cur) => [...new Set([...cur, ...good])])
    setDraft(bad.length ? [...bad, rest].join(' ').trim() : rest)
    return [...new Set([...emails, ...good])]
  }
  const pending = draft.trim()
  const all = useMemo(() => (EMAIL_RE.test(pending) ? [...new Set([...emails, pending.toLowerCase()])] : emails), [emails, pending])
  const hasDraft = [...picked].some((id) => lots.find((l) => l.id === id)?.status === 'draft')
  const ready = all.length > 0 && picked.size > 0 && (!pending || EMAIL_RE.test(pending))

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ready) return
    setBusy(true)
    setError(null)
    const sent: string[] = []
    let example = false
    try {
      for (const mail of all) {
        if ((await api.inviteCompany(projectId, mail, [...picked])) === 'example') example = true
        sent.push(mail)
      }
      setDone({ emails: sent, example })
      onSent?.()
    } catch (err) {
      setError(`${sent.length ? `${sent.length} invitation${sent.length > 1 ? 's' : ''} envoyée${sent.length > 1 ? 's' : ''}, puis : ` : ''}${errorMessage(err)}`)
      if (sent.length) {
        setEmails(all.filter((m) => !sent.includes(m)))
        setDraft('')
        onSent?.()
      }
    }
    setBusy(false)
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-2 py-2 text-center">
        <span className="anim-pop grid size-11 place-items-center rounded-full bg-good-soft text-good">
          <Check size={24} strokeWidth={2.5} />
        </span>
        <p className="text-[1rem] font-semibold">{done.example ? 'Projet exemple : rien n’est envoyé' : `Invitation${done.emails.length > 1 ? 's' : ''} envoyée${done.emails.length > 1 ? 's' : ''}`}</p>
        <p className="text-[0.875rem] text-ink-2">
          {done.example
            ? 'Sur un vrai projet, l’entreprise reçoit un e-mail avec le lien pour répondre.'
            : `${done.emails.join(', ')} ${done.emails.length > 1 ? 'reçoivent' : 'reçoit'} un e-mail avec le lien pour se connecter et répondre. ${done.emails.length > 1 ? 'Elles apparaîtront' : 'Elle apparaîtra'} dans « Entreprises » dès ${done.emails.length > 1 ? 'leur' : 'sa'} connexion.`}
        </p>
        <div className="mt-2 flex gap-2">
          <Button
            icon={<MailPlus size={15} />}
            onClick={() => {
              setDone(null)
              setEmails([])
              setDraft('')
            }}
          >
            Inviter une autre entreprise
          </Button>
          <Button variant="primary" onClick={onClose}>
            Terminé
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={send} className="flex flex-col gap-3.5">
      <div>
        <label htmlFor="inv-email" className="mb-1 block text-[0.8438rem] font-medium">
          E-mail de l’entreprise
        </label>
        <div className="field flex h-auto min-h-10 flex-wrap items-center gap-1 px-1.5 py-1 focus-within:border-plan">
          {emails.map((m) => (
            <span key={m} className="anim-pop inline-flex max-w-full items-center gap-1 rounded-[5px] bg-plan-soft py-0.5 pr-0.5 pl-2 text-[0.8438rem] text-plan-dark">
              <span className="truncate">{m}</span>
              <button type="button" aria-label={`Retirer ${m}`} className="grid size-5 shrink-0 place-items-center rounded hover:bg-plan/15" onClick={() => setEmails(emails.filter((x) => x !== m))}>
                <X size={12} />
              </button>
            </span>
          ))}
          <input
            id="inv-email"
            type="email"
            inputMode="email"
            autoComplete="off"
            autoCapitalize="none"
            autoFocus
            multiple
            className="min-w-[9rem] flex-1 bg-transparent px-1 py-1 text-[0.9375rem] outline-none"
            placeholder={emails.length ? 'Ajouter une adresse' : 'contact@entreprise.fr'}
            value={draft}
            onChange={(e) => (/[\s,;]/.test(e.target.value) ? absorb(e.target.value, false) : setDraft(e.target.value))}
            onBlur={() => pending && EMAIL_RE.test(pending) && absorb(draft, true)}
            onKeyDown={(e) => {
              if (e.key === 'Backspace' && !draft && emails.length) setEmails(emails.slice(0, -1))
            }}
            onPaste={(e) => {
              const text = e.clipboardData.getData('text')
              if (/[\s,;]/.test(text.trim())) {
                e.preventDefault()
                absorb(`${draft} ${text}`, true)
              }
            }}
          />
        </div>
        <p className="mt-1 text-[0.7812rem] text-ink-3">Plusieurs adresses possibles : séparez-les par une virgule ou collez une liste.</p>
      </div>

      <fieldset>
        <legend className="mb-1 flex w-full items-baseline justify-between text-[0.8438rem] font-medium">
          <span>Lots à chiffrer</span>
          {lots.length > 2 && (
            <button type="button" className="text-[0.7812rem] font-normal text-plan hover:underline" onClick={() => setPicked(picked.size === lots.length ? new Set() : new Set(lots.map((l) => l.id)))}>
              {picked.size === lots.length ? 'Tout décocher' : 'Tout cocher'}
            </button>
          )}
        </legend>
        {lots.length === 0 ? (
          <p className="text-[0.875rem] text-ink-2">Créez d’abord un lot dans ce projet.</p>
        ) : (
          <ul className="flex max-h-[38vh] flex-wrap gap-1.5 overflow-y-auto">
            {lots.map((l) => {
              const on = picked.has(l.id)
              return (
                <li key={l.id} className="max-w-full">
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      const next = new Set(picked)
                      if (on) next.delete(l.id)
                      else next.add(l.id)
                      setPicked(next)
                    }}
                    className={cx(
                      'inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-left text-[0.8438rem] leading-tight transition-all duration-150 active:scale-95',
                      on ? 'border-plan bg-plan text-white shadow-[var(--shadow-1)]' : 'border-line bg-sheet text-ink-2 hover:border-plan/60',
                    )}
                  >
                    {on && <Check size={13} strokeWidth={3} className="anim-pop shrink-0" />}
                    <span className="truncate">{l.name || 'Lot sans nom'}</span>
                    {l.status === 'draft' ? (
                      <span className={cx('shrink-0 text-[0.7188rem]', on ? 'text-white/75' : 'text-ink-3')}>brouillon</span>
                    ) : (
                      l.due_date && <span className={cx('num shrink-0 text-[0.7188rem]', on ? 'text-white/75' : 'text-ink-3')}>{fmtDate(l.due_date)}</span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </fieldset>

      <p className="rounded-md bg-paper px-3 py-2 text-[0.8125rem] leading-snug text-ink-2">
        L’entreprise reçoit un e-mail avec le lien du projet. Elle se connecte (ou crée son compte) et accède directement à {picked.size > 1 ? 'ces lots' : 'ce lot'}, sans demande d’accès à valider.
        {hasDraft && ' Pour un lot en brouillon, elle sera prévenue par e-mail dès que vous le publierez.'}
      </p>

      {error && (
        <p className="text-[0.875rem] text-bad" role="alert">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          Annuler
        </Button>
        <Button type="submit" variant="primary" disabled={busy || !ready} icon={busy ? <Spinner /> : <Send size={15} />}>
          {all.length > 1 ? `Envoyer ${all.length} invitations` : 'Envoyer l’invitation'}
        </Button>
      </div>
    </form>
  )
}
