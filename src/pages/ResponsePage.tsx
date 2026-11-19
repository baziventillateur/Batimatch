import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CheckCircle2, ChevronLeft, Clock, Lock, Send } from 'lucide-react'
import { useConsultation, useStore, newOffer } from '../store'
import { errorMessage } from '../data'
import { useAuth } from '../data/auth'
import { loadLot, startLotSync, useSync } from '../data/sync'
import { confetti } from '../lib/confetti'
import { daysUntil, fmtDate, fmtEur, todayIso } from '../lib/format'
import type { Consultation, Offer } from '../lib/types'
import { Button, CompanyLogo, Dialog, ErrorBox, Field, Loading, NumberInput, Spinner, cx, dueLabel } from '../components/ui'
import { ExtrasEditor, MobileTotalBar, PriceGrid, Recap, useOfferTotals } from './OfferEditor'
import { SaveIndicator } from './ConsultationLayout'
import { TechNoteField } from '../components/TechNote'
import { StatusPill } from './ProjectPage'

/** Espace entreprise : répondre à un lot (DPGF), jusqu'à la date de rendu */
export default function ResponsePage() {
  const { cid = '', pid = '' } = useParams()
  const { userId, profile } = useAuth()
  const c = useConsultation(cid)
  const [error, setError] = useState<string | null>(null)
  const syncRef = useRef<ReturnType<typeof startLotSync> | null>(null)

  useEffect(() => {
    if (!userId || !profile) return
    let alive = true
    useSync.setState({ status: 'idle', error: null })
    loadLot(cid)
      .then(({ consultation }) => {
        if (!alive) return
        // Pas encore d'offre : brouillon local, enregistré à la première saisie
        if (!consultation.offers.some((o) => o.companyId === userId)) {
          useStore.getState().addOffer(
            cid,
            newOffer({
              companyId: userId,
              source: 'platform',
              status: 'draft',
              company: profile.companyName,
              contact: { firstName: profile.firstName, lastName: profile.lastName, email: profile.email, phone: profile.phone },
              logoUrl: profile.logoUrl,
              receivedAt: null,
            }),
          )
        }
        syncRef.current = startLotSync(cid, 'company', userId)
      })
      .catch((e) => alive && setError(errorMessage(e)))
    return () => {
      alive = false
      syncRef.current?.stop()
      syncRef.current = null
    }
  }, [cid, userId, profile])

  if (error) return <ErrorBox message={error} />
  const offer = c?.offers.find((o) => o.companyId === userId)
  if (!c || !offer) return <Loading label="Chargement de la DPGF" />
  return <Response c={c} offer={offer} pid={pid} flush={() => syncRef.current?.flushNow() ?? Promise.resolve()} />
}

function Response({ c, offer, pid, flush }: { c: Consultation; offer: Offer; pid: string; flush: () => Promise<void> }) {
  const updateOffer = useStore((s) => s.updateOffer)
  const { profile } = useAuth()
  const totals = useOfferTotals(c, offer)
  const days = daysUntil(c.dueDate)
  const suspended = c.status === 'suspended'
  const closed = suspended || !!c.locked || (days != null && days < 0)
  const due = dueLabel(days)
  const [confirming, setConfirming] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [justSent, setJustSent] = useState(false)
  const sent = offer.status === 'submitted'
  const missing = totals.total - totals.filled
  const contact = offer.contact
  const setContact = (p: Partial<Offer['contact']>) => updateOffer(c.id, offer.id, { contact: { ...contact, ...p } })
  const nothingYet = useMemo(() => Object.keys(offer.prices).length === 0, [offer.prices])

  const submit = async () => {
    setSending(true)
    setSendError(null)
    try {
      updateOffer(c.id, offer.id, {
        status: 'submitted',
        submittedAt: new Date().toISOString(),
        receivedAt: todayIso(),
        company: offer.company || profile?.companyName || '',
        logoUrl: offer.logoUrl ?? profile?.logoUrl ?? null,
      })
      await flush()
      setConfirming(false)
      setJustSent(true)
      confetti()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) {
      setSendError(errorMessage(e))
      updateOffer(c.id, offer.id, { status: offer.status, submittedAt: offer.submittedAt })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to={`/p/${pid}`} className="inline-flex items-center gap-1 text-[0.875rem] text-ink-2 hover:text-ink">
          <ChevronLeft size={16} /> {c.affaire}
        </Link>
        {!closed && <SaveIndicator />}
      </div>

      <section className="cartouche">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink/25 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="text-[0.8438rem] text-ink-3">{c.affaire}</p>
            <h1 className="font-title text-[1.875rem] leading-[1.05] font-bold sm:text-[2.25rem]">{c.name}</h1>
            {c.lot && <p className="text-[0.9062rem] text-ink-2">{c.lot}</p>}
          </div>
          <StatusPill status={sent ? 'sent' : nothingYet ? 'none' : 'draft'} />
        </div>
        <dl className="grid grid-cols-2 md:grid-cols-3">
          <div className="cartouche-cell border-r">
            <dt className="cartouche-label">Date de rendu</dt>
            <dd className="num font-medium">
              {fmtDate(c.dueDate)} <span className={cx('ml-1 text-[0.8125rem] font-normal', due.tone === 'warn' ? 'text-warn' : 'text-ink-3')}>{due.text}</span>
            </dd>
          </div>
          <div className="cartouche-cell md:border-r">
            <dt className="cartouche-label">Votre offre</dt>
            <dd className="num font-medium">{fmtEur(totals.net)} HT</dd>
          </div>
          <div className="cartouche-cell col-span-2 border-t md:col-span-1 md:border-t-0">
            <dt className="cartouche-label">Lignes chiffrées</dt>
            <dd className="num font-medium">
              {totals.filled}/{totals.total}
            </dd>
          </div>
        </dl>
      </section>

      {closed ? (
        <p className="flex items-center gap-2 rounded-md border border-line bg-paper px-4 py-3 text-[0.9062rem]">
          <Lock size={16} /> {c.locked ? 'L’acheteur a verrouillé ce projet' : suspended ? 'L’acheteur a suspendu cette consultation' : 'La date de rendu est passée'} : {sent ? 'votre offre a été transmise et ne peut plus être modifiée.' : suspended || c.locked ? 'les réponses sont gelées pour le moment.' : 'il n’est plus possible de déposer une offre sur ce lot.'}
        </p>
      ) : justSent || sent ? (
        <div className={cx('flex items-start gap-3 rounded-md border border-good/30 bg-good-soft px-4 py-3', justSent && 'anim-pop')}>
          <svg width="28" height="28" viewBox="0 0 28 28" className="mt-0.5 shrink-0" aria-hidden="true">
            <circle cx="14" cy="14" r="13" fill="var(--color-good)" />
            <path d="M8 14.5l4 4 8-9" fill="none" stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className={justSent ? 'anim-draw' : ''} />
          </svg>
          <div className="text-[0.9062rem]">
            <p className="font-semibold">Offre transmise{offer.submittedAt ? ` le ${fmtDate(offer.submittedAt.slice(0, 10))}` : ''}.</p>
            <p className="text-ink-2">Vous pouvez encore la modifier jusqu’au {fmtDate(c.dueDate)} : chaque modification est transmise automatiquement à l’acheteur.</p>
          </div>
        </div>
      ) : (
        <p className="flex items-center gap-2 rounded-md border border-plan/25 bg-plan-soft/60 px-4 py-3 text-[0.9062rem]">
          <Clock size={16} className="text-plan" /> Votre saisie est enregistrée au fur et à mesure, mais l’acheteur ne la voit qu’une fois l’offre envoyée.
        </p>
      )}

      {c.description && (
        <section className="panel px-4 py-3 text-[0.9062rem] sm:px-5">
          <p className="text-[0.8125rem] font-semibold text-ink-2">Consignes de l’acheteur</p>
          <p className="whitespace-pre-line">{c.description}</p>
        </section>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_330px]">
        <div className="flex min-w-0 flex-col gap-4">
          <section className="panel grid gap-3 p-4" aria-label="Vos coordonnées">
            <div className="flex items-center gap-3">
              <CompanyLogo name={offer.company || '?'} url={offer.logoUrl} size={48} />
              <div className="min-w-0 flex-1">
                <p className="text-[0.8125rem] text-ink-3">Offre de</p>
                <p className="truncate text-[1.125rem] font-semibold">{offer.company || 'Votre entreprise'}</p>
              </div>
              <Link to="/profil" className="text-[0.8438rem] text-plan hover:underline">
                Modifier le logo
              </Link>
            </div>
            <div className="grid gap-2 sm:grid-cols-4">
              <input aria-label="Prénom" disabled={closed} className="field h-9 py-1 text-[0.875rem] disabled:bg-paper" placeholder="Prénom" value={contact.firstName} onChange={(e) => setContact({ firstName: e.target.value })} />
              <input aria-label="Nom" disabled={closed} className="field h-9 py-1 text-[0.875rem] disabled:bg-paper" placeholder="Nom" value={contact.lastName} onChange={(e) => setContact({ lastName: e.target.value })} />
              <input aria-label="Email" type="email" disabled={closed} className="field h-9 py-1 text-[0.875rem] disabled:bg-paper" placeholder="Email" value={contact.email} onChange={(e) => setContact({ email: e.target.value })} />
              <input aria-label="Téléphone" type="tel" disabled={closed} className="field h-9 py-1 text-[0.875rem] disabled:bg-paper" placeholder="Téléphone" value={contact.phone} onChange={(e) => setContact({ phone: e.target.value })} />
            </div>
          </section>

          <PriceGrid c={c} offer={offer} readOnly={closed} showMedians={false} />
          <ExtrasEditor c={c} offer={offer} readOnly={closed} buyer={false} />

          <section className="panel grid gap-3 p-4" aria-label="Conditions">
            <h3 className="font-title text-[1.25rem] font-semibold">Conditions de votre offre</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Délai d’exécution" htmlFor="r-delay">
                <NumberInput id="r-delay" disabled={closed} className="h-9 py-1 disabled:bg-paper" suffix="sem." value={offer.durationWeeks} onCommit={(v) => updateOffer(c.id, offer.id, { durationWeeks: v })} />
              </Field>
              <Field label="Offre valable jusqu’au" htmlFor="r-valid">
                <input id="r-valid" type="date" disabled={closed} className="field h-9 py-1 disabled:bg-paper" value={offer.validUntil ?? ''} onChange={(e) => updateOffer(c.id, offer.id, { validUntil: e.target.value || null })} />
              </Field>
            </div>
            <Field label="Réserves et exclusions" htmlFor="r-res">
              <textarea id="r-res" rows={3} disabled={closed} className="field resize-y text-[0.875rem] disabled:bg-paper" value={offer.reserves} onChange={(e) => updateOffer(c.id, offer.id, { reserves: e.target.value })} />
            </Field>
            <Field label="Message à l’acheteur" htmlFor="r-msg">
              <textarea id="r-msg" rows={2} disabled={closed} className="field resize-y text-[0.875rem] disabled:bg-paper" placeholder="Moyens, références, disponibilité…" value={offer.message} onChange={(e) => updateOffer(c.id, offer.id, { message: e.target.value })} />
            </Field>
            <TechNoteField c={c} offer={offer} editable={!closed} folder={offer.companyId ?? ''} />
          </section>
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-4">
          <Recap c={c} offer={offer} totals={totals} readOnly={closed} />
          {!closed && !sent && (
            <Button variant="primary" className="hidden h-12 text-[1rem] lg:inline-flex" icon={<Send size={18} />} onClick={() => setConfirming(true)} disabled={nothingYet}>
              Envoyer mon offre
            </Button>
          )}
        </aside>
      </div>

      <MobileTotalBar net={totals.net} filled={totals.filled} total={totals.total}>
        {!closed && !sent ? (
          <Button variant="primary" icon={<Send size={16} />} onClick={() => setConfirming(true)} disabled={nothingYet}>
            Envoyer
          </Button>
        ) : sent ? (
          <span className="inline-flex items-center gap-1 text-[0.875rem] font-medium text-good">
            <CheckCircle2 size={16} /> Transmise
          </span>
        ) : undefined}
      </MobileTotalBar>

      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Envoyer votre offre"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Continuer la saisie
            </Button>
            <Button variant="primary" icon={sending ? <Spinner /> : <Send size={16} />} disabled={sending} onClick={submit}>
              Envoyer à l’acheteur
            </Button>
          </>
        }
      >
        <div className="grid gap-3 text-[0.9375rem]">
          <p>
            Montant de votre offre : <strong className="num">{fmtEur(totals.net)} HT</strong>
            {totals.pse > 0 && <> (+ {fmtEur(totals.pse)} de PSE)</>}.
          </p>
          {missing > 0 ? (
            <p className="rounded-md bg-warn-soft px-3 py-2 text-warn">
              {missing} ligne{missing > 1 ? 's ne sont pas chiffrées' : ' n’est pas chiffrée'}. Touchez « Incl. » pour une prestation incluse, ou laissez vide si vous ne la chiffrez pas.
            </p>
          ) : (
            <p className="text-good">Toutes les lignes de base sont renseignées.</p>
          )}
          <p className="text-ink-2">Vous pourrez encore la modifier jusqu’au {fmtDate(c.dueDate)}.</p>
          {sendError && <p className="text-bad">{sendError}</p>}
        </div>
      </Dialog>
    </div>
  )
}
