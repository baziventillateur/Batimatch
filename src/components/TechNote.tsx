// Notice technique d'une offre : un PDF facultatif joint par l'entreprise, consultable par l'acheteur.
import { useRef, useState } from 'react'
import { FileCheck2, FileText, FileX2, Paperclip, Trash2 } from 'lucide-react'
import { api, errorMessage } from '../data'
import { useStore } from '../store'
import { companyKey } from '../lib/calc'
import type { Consultation, Offer } from '../lib/types'
import { Button, Spinner, cx } from './ui'

const MAX_BYTES = 10 * 1024 * 1024

const fmtSize = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo` : `${Math.max(1, Math.round(n / 1024))} Ko`)

/** Le chemin doit désigner le dossier de cette entreprise sur ce lot : une offre ne peut pas pointer le fichier d'une autre */
function trustedPath(c: Consultation, offer: Offer): string | null {
  const path = offer.techNote?.path
  if (!path) return null
  const [lot, folder] = path.split('/')
  if (lot !== c.id) return null
  const ok = folder === 'manual' || c.offers.some((o) => o.companyId === folder && companyKey(o.company) === companyKey(offer.company))
  return ok ? path : null
}

function useOpenNote(c: Consultation, offer: Offer) {
  const [opening, setOpening] = useState(false)
  const open = async () => {
    const path = trustedPath(c, offer)
    if (!path) return alert('Ce fichier n’est pas rattaché à cette offre.')
    // La fenêtre est ouverte tout de suite, sinon le navigateur la bloque après l'attente du lien
    const win = window.open('', '_blank')
    setOpening(true)
    try {
      const url = await api.offerFileUrl(path)
      if (win) win.location.href = url
      else window.location.href = url
    } catch (e) {
      win?.close()
      alert(errorMessage(e))
    } finally {
      setOpening(false)
    }
  }
  return { open, opening }
}

/** Champ de dépôt (entreprise, ou acheteur sur une offre qu'il saisit) ; lecture seule sinon */
export function TechNoteField({ c, offer, editable, folder }: { c: Consultation; offer: Offer; editable: boolean; folder: string }) {
  const updateOffer = useStore((s) => s.updateOffer)
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { open, opening } = useOpenNote(c, offer)
  const note = offer.techNote ?? null

  const pick = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) return setError('Le fichier doit être un PDF.')
    if (file.size > MAX_BYTES) return setError(`Le fichier fait ${fmtSize(file.size)} : la limite est de 10 Mo.`)
    setBusy(true)
    try {
      const saved = await api.uploadOfferFile(c.id, folder, offer.id, file)
      updateOffer(c.id, offer.id, { techNote: saved })
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  const remove = async () => {
    if (!note || !confirm('Retirer la notice technique de cette offre ?')) return
    setBusy(true)
    try {
      // Une version négociée peut partager le fichier de l'offre d'origine : on ne le supprime que s'il n'est plus utilisé
      const shared = c.offers.some((o) => o.id !== offer.id && o.techNote?.path === note.path)
      if (!shared) await api.removeOfferFile(note.path).catch(() => undefined)
      updateOffer(c.id, offer.id, { techNote: null })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[0.875rem] font-medium text-ink-2">
        Notice technique <span className="font-normal text-ink-3">(facultatif)</span>
      </p>
      {note ? (
        <div className="anim-pop flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-good/30 bg-good-soft px-3 py-2">
          <FileCheck2 size={20} className="shrink-0 text-good" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.875rem] font-medium">{note.name}</p>
            <p className="text-[0.7812rem] text-ink-2">PDF, {fmtSize(note.size)}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <Button size="sm" disabled={opening} onClick={open}>
              Ouvrir
            </Button>
            {editable && (
              <>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => input.current?.click()}>
                  Remplacer
                </Button>
                <Button size="sm" variant="ghost" disabled={busy} aria-label="Retirer la notice technique" title="Retirer" onClick={remove}>
                  <Trash2 size={15} />
                </Button>
              </>
            )}
          </div>
        </div>
      ) : editable ? (
        <Button size="sm" className="self-start" disabled={busy} icon={busy ? <Spinner /> : <Paperclip size={15} />} onClick={() => input.current?.click()}>
          {busy ? 'Envoi du fichier…' : 'Joindre un PDF'}
        </Button>
      ) : (
        <p className="flex items-center gap-1.5 text-[0.875rem] text-ink-2">
          <FileX2 size={16} aria-hidden="true" /> Aucune notice technique jointe.
        </p>
      )}
      {editable && !note && <p className="text-[0.7812rem] text-ink-3">Fiche produit, mode opératoire, références : PDF de 10 Mo maximum, visible de l’acheteur.</p>}
      {error && (
        <p className="text-[0.8125rem] text-bad" role="alert">
          {error}
        </p>
      )}
      <input ref={input} type="file" accept="application/pdf,.pdf" className="hidden" aria-label="Notice technique (PDF)" onChange={(e) => pick(e.target.files?.[0])} />
    </div>
  )
}

/** Indication pour l'acheteur : notice fournie (ouvrable d'un clic) ou non */
export function TechNoteBadge({ c, offer, className }: { c: Consultation; offer: Offer; className?: string }) {
  const { open, opening } = useOpenNote(c, offer)
  if (!offer.techNote) {
    return (
      <span className={cx('inline-flex items-center gap-1 text-[0.8125rem] text-ink-2', className)}>
        <FileX2 size={14} aria-hidden="true" /> Notice non fournie
      </span>
    )
  }
  return (
    <button
      type="button"
      disabled={opening}
      onClick={open}
      title={`Ouvrir ${offer.techNote.name}`}
      className={cx('inline-flex items-center gap-1 rounded-[4px] bg-good-soft px-1.5 py-0.5 text-[0.8125rem] font-medium text-good hover:underline', className)}
    >
      <FileText size={14} aria-hidden="true" /> Notice fournie
    </button>
  )
}
