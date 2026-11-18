import { useState } from 'react'
import { BellRing, Check, ChevronDown, Mail, Phone } from 'lucide-react'
import { api, errorMessage } from '../data'
import type { ProjectBundle } from '../data/backend'
import type { AccessStatus } from '../data/rows'
import { daysUntil, fmtDate } from '../lib/format'
import { Button, CompanyLogo, Dialog, Spinner, cx } from './ui'

const ACCESS: Record<AccessStatus, { label: string; cls: string }> = {
  pending: { label: 'Accès demandé', cls: 'bg-warn-soft text-warn' },
  approved: { label: 'En attente d’offre', cls: 'bg-warn-soft text-warn' },
  refused: { label: 'Accès refusé', cls: 'bg-line-2 text-ink-2' },
  declined: { label: 'Ne répond pas', cls: 'bg-line-2 text-ink-2' },
}

/**
 * Carte d'une entreprise sur un lot : récapitulatif, appel, e-mail et relance en un geste.
 * « Fiche complète » déplie sa situation sur tous les lots du projet.
 */
export function CompanyCard({
  b,
  lotId,
  userId,
  lastReminder,
  onReminded,
  onClose,
}: {
  b: ProjectBundle
  lotId: string
  userId: string | null
  /** Date de la dernière relance sur ce lot */
  lastReminder?: string | null
  onReminded?: () => void
  onClose: () => void
}) {
  return (
    <Dialog open={userId != null} onClose={onClose} title="Entreprise">
      {userId && <Body key={userId} b={b} lotId={lotId} userId={userId} lastReminder={lastReminder} onReminded={onReminded} />}
    </Dialog>
  )
}

function Body({ b, lotId, userId, lastReminder, onReminded }: { b: ProjectBundle; lotId: string; userId: string; lastReminder?: string | null; onReminded?: () => void }) {
  const [full, setFull] = useState(false)
  const [step, setStep] = useState<'idle' | 'confirm' | 'sending' | 'sent' | 'example'>('idle')
  const [error, setError] = useState<string | null>(null)
  const m = b.members.find((x) => x.user_id === userId)
  const p = m?.profile
  const lot = b.lots.find((l) => l.id === lotId)
  const name = p?.company_name || 'Entreprise'
  const contact = [p?.first_name, p?.last_name].filter(Boolean).join(' ')
  const access = b.access.find((a) => a.lot_id === lotId && a.user_id === userId)
  const sent = (id: string) => b.offers.some((o) => o.lot_id === id && o.company_id === userId && o.status === 'submitted')
  const days = daysUntil(lot?.due_date ?? null)
  const open = (lot?.status ?? 'published') === 'published' && (days == null || days >= 0)
  const canRemind = access?.status === 'approved' && !sent(lotId)
  const recent = !!lastReminder && Date.now() - new Date(lastReminder).getTime() < 86_400_000

  const remind = async () => {
    setStep('sending')
    setError(null)
    try {
      setStep((await api.remindCompany(lotId, userId)) === 'example' ? 'example' : 'sent')
      onReminded?.()
    } catch (e) {
      setError(errorMessage(e))
      setStep('idle')
    }
  }

  const quick = 'inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[5px] border border-line bg-sheet px-2 text-[0.875rem] font-medium btn-raised hover:border-ink-3'
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <CompanyLogo name={name} url={p?.logo_url} size={52} />
        <div className="min-w-0">
          <p className="truncate text-[1.1875rem] leading-tight font-semibold">{name}</p>
          {contact && <p className="truncate text-[0.9062rem] text-ink-2">{contact}</p>}
        </div>
      </div>

      <p className="rounded-md bg-paper px-3 py-2 text-[0.875rem] leading-snug">
        <span className={cx('mr-1.5 rounded-[3px] px-1.5 py-0.5 text-[0.75rem] font-semibold', sent(lotId) ? 'bg-good-soft text-good' : access ? ACCESS[access.status].cls : 'bg-line-2 text-ink-2')}>
          {sent(lotId) ? 'Offre envoyée' : access ? ACCESS[access.status].label : 'Aucune demande'}
        </span>
        <span className="font-medium">{lot?.name}</span>
        {lot?.due_date && (
          <span className="text-ink-2">
            , remise le <span className="num">{fmtDate(lot.due_date)}</span>
            {days != null && days >= 0 && <> ({days === 0 ? 'ce soir' : `J−${days}`})</>}
          </span>
        )}
        {lastReminder && (
          <span className="mt-0.5 block text-[0.8125rem] text-ink-3">
            Dernière relance le <span className="num">{fmtDate(lastReminder.slice(0, 10))}</span>
          </span>
        )}
      </p>

      {/* Actions rapides */}
      <div className="flex gap-2">
        {p?.phone && (
          <a href={`tel:${p.phone.replace(/\s/g, '')}`} className={quick}>
            <Phone size={15} /> Appeler
          </a>
        )}
        {p?.email && (
          <a href={`mailto:${p.email}`} className={quick}>
            <Mail size={15} /> E-mail
          </a>
        )}
        {canRemind && (
          <Button variant="primary" className="!h-9 flex-1 !px-2" icon={<BellRing size={15} />} disabled={step !== 'idle' || !open || recent} onClick={() => setStep('confirm')}>
            Relancer
          </Button>
        )}
      </div>
      <p className="-mt-1 flex flex-wrap gap-x-3 text-[0.8438rem] text-ink-2">
        {p?.phone && <span className="num">{p.phone}</span>}
        {p?.email && <span className="break-all">{p.email}</span>}
      </p>
      {canRemind && !open && step === 'idle' && <p className="text-[0.8438rem] text-ink-3">Relance impossible : le lot n’accepte plus d’offres. Repoussez la date de remise pour relancer.</p>}
      {canRemind && open && recent && step === 'idle' && <p className="text-[0.8438rem] text-ink-3">Déjà relancée il y a moins de 24 heures.</p>}

      {(step === 'confirm' || step === 'sending') && (
        <div className="anim-fade rounded-md border border-warn/30 bg-warn-soft/60 p-3">
          <p className="text-[0.9062rem] leading-snug">
            Envoyer une relance à <strong className="font-semibold">{contact || name}</strong>
            {p?.email && <> ({p.email})</>} ? Elle recevra un e-mail de votre part lui rappelant que son offre est attendue pour « {lot?.name} », avec un lien direct vers la DPGF.
          </p>
          <div className="mt-2 flex justify-end gap-2">
            <Button size="sm" variant="ghost" disabled={step === 'sending'} onClick={() => setStep('idle')}>
              Annuler
            </Button>
            <Button size="sm" variant="primary" disabled={step === 'sending'} icon={step === 'sending' ? <Spinner /> : <Check size={14} />} onClick={remind}>
              Envoyer la relance
            </Button>
          </div>
        </div>
      )}
      {step === 'sent' && (
        <p className="anim-pop flex items-center gap-1.5 rounded-md bg-good-soft px-3 py-2 text-[0.9062rem] font-medium text-good" role="status">
          <Check size={16} /> Relance envoyée à {contact || name}.
        </p>
      )}
      {step === 'example' && (
        <p className="anim-pop rounded-md bg-plan-soft px-3 py-2 text-[0.9062rem]" role="status">
          Projet exemple : l’entreprise est fictive, aucun e-mail n’est parti. Sur un vrai projet, elle reçoit la relance avec le lien vers la DPGF.
        </p>
      )}
      {error && (
        <p className="text-[0.875rem] text-bad" role="alert">
          {error}
        </p>
      )}

      {/* Fiche complète : situation sur tous les lots */}
      <button type="button" aria-expanded={full} onClick={() => setFull(!full)} className="flex items-center justify-center gap-1 border-t border-line-2 pt-2.5 text-[0.875rem] font-medium text-plan">
        {full ? 'Réduire la fiche' : 'Voir la fiche complète'} <ChevronDown size={15} className={cx('transition-transform', full && 'rotate-180')} />
      </button>
      {full && (
        <div className="anim-fade flex flex-col gap-2">
          {m && (
            <p className="text-[0.8438rem] text-ink-2">
              Inscrite au projet le <span className="num">{fmtDate(m.joined_at.slice(0, 10))}</span>
            </p>
          )}
          <ul className="rounded-md border border-line-2">
            {b.lots.map((l) => {
              const a = b.access.find((x) => x.lot_id === l.id && x.user_id === userId)
              const ok = sent(l.id)
              return (
                <li key={l.id} className={cx('border-b border-line-2 px-3 py-1.5 last:border-0', l.id === lotId && 'bg-paper')}>
                  <p className="flex items-center justify-between gap-2 text-[0.875rem]">
                    <span className="min-w-0 truncate">{l.name}</span>
                    <span className={cx('shrink-0 rounded-[3px] px-1.5 py-0.5 text-[0.75rem] font-semibold', ok ? 'bg-good-soft text-good' : a ? ACCESS[a.status].cls : 'text-ink-3')}>
                      {ok ? 'Offre envoyée' : a ? ACCESS[a.status].label : '—'}
                    </span>
                  </p>
                  {a?.status === 'declined' && a.comment && <p className="text-[0.8125rem] text-ink-2 italic">« {a.comment} »</p>}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
