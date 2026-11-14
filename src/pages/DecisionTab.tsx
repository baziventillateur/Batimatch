import { useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Link } from 'react-router-dom'
import { Ban, FileText, Lock, MessageSquare, Plus, Send, Star, Trash2, Trophy, X } from 'lucide-react'
import { useC } from './ConsultationLayout'
import { useStore } from '../store'
import { addComment, deleteComment, saveReview } from '../data/sync'
import { errorMessage } from '../data'
import { analyze, companyKey, type Analysis } from '../lib/calc'
import { scoreOffers, strengthsAndWeaknesses, totalWeight, type ScoredOffer } from '../lib/decision'
import { confetti } from '../lib/confetti'
import { fmtEur, fmtNum, fmtPctSigned } from '../lib/format'
import { uid } from '../lib/id'
import type { Consultation, Criterion, Verdict } from '../lib/types'
import { AnimatedNumber, Button, CompanyLogo, EmptyState, IconButton, Spinner, cx } from '../components/ui'
import { ContactLine } from './OfferEditor'

const fmtScore = (v: number) => fmtNum(Math.round(v * 10) / 10)

export default function DecisionTab() {
  const c = useC()
  const reviews = useStore((s) => s.reviews)
  const a = useMemo(() => analyze(c), [c])
  const scored = useMemo(() => scoreOffers(a, c.settings.criteria, reviews), [a, c.settings.criteria, reviews])
  const companies = new Set(c.offers.map((o) => companyKey(o.company))).size

  if (companies < 2 || a.ranked.length < 2) {
    return (
      <EmptyState
        title="La décision se prépare dès deux offres"
        action={
          <Link to="../offres" relative="path" className="inline-flex h-10 items-center rounded-[5px] bg-plan px-3.5 font-medium text-white hover:bg-plan-dark">
            Voir les offres
          </Link>
        }
      >
        Ici, vous noterez les offres selon vos critères, les commenterez en interne et retiendrez la meilleure.
      </EmptyState>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <PodiumSection c={c} a={a} scored={scored} />
      <CriteriaEditor c={c} />
      <section aria-labelledby="cards-title" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="cards-title" className="font-title text-[26px] font-semibold">
              Fiches des entreprises
            </h2>
            <p className="text-[14px] text-ink-2">
              Notez les critères qualitatifs, donnez votre avis, commentez. <Lock size={13} className="inline -translate-y-px" /> Rien de cette page n’est visible des
              entreprises.
            </p>
          </div>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {scored.map((s) => (
            <OfferCard key={s.result.offer.id} c={c} a={a} s={s} />
          ))}
        </div>
      </section>
    </div>
  )
}

// ————————————————————————— Podium et recommandation —————————————————————————

function PodiumSection({ c, a, scored }: { c: Consultation; a: Analysis; scored: ScoredOffer[] }) {
  const update = useStore((s) => s.updateConsultation)
  const ranked = scored.filter((s) => s.rank != null)
  const top = ranked.slice(0, 3)
  const best = top[0]
  const awarded = scored.find((s) => s.result.offer.id === c.awardedOfferId)
  const btnRef = useRef<HTMLDivElement>(null)
  // Ordre visuel : 2e, 1er, 3e
  const order = [top[1], top[0], top[2]].filter(Boolean) as ScoredOffer[]
  const heights: Record<number, number> = { 1: 132, 2: 96, 3: 70 }
  const incomplete = ranked.some((s) => !s.complete)

  const award = (id: string | null) => {
    update(c.id, { awardedOfferId: id })
    if (id) {
      const r = btnRef.current?.getBoundingClientRect()
      confetti(r ? { x: r.left + r.width / 2, y: r.top } : undefined)
    }
  }

  return (
    <section className="panel grid gap-6 overflow-hidden p-5 sm:p-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-10" aria-label="Classement multicritère">
      <div className="flex flex-col">
        <p className="text-[14px] text-ink-2">Classement multicritère</p>
        <div className="mt-4 grid grid-cols-3 items-end gap-2 sm:gap-4">
          {order.map((s) => {
            const rank = s.rank!
            const isAwarded = c.awardedOfferId === s.result.offer.id
            return (
              <div key={s.result.offer.id} className="relative flex min-w-0 flex-col items-center gap-2 text-center">
                {isAwarded && (
                  <span className="anim-stamp absolute -top-3 right-0 z-10 rounded-[4px] border-2 border-good bg-sheet px-1.5 py-0.5 text-[11px] font-bold tracking-wide text-good uppercase">
                    Retenue
                  </span>
                )}
                <span className="anim-pop" style={{ animationDelay: `${0.5 + (3 - rank) * 0.12}s` }}>
                  <CompanyLogo name={s.result.offer.company || '?'} url={s.result.offer.logoUrl} size={rank === 1 ? 64 : 50} />
                </span>
                <span className={cx('line-clamp-2 w-full text-[13.5px] leading-tight sm:text-[15px]', rank === 1 && 'font-semibold')}>{s.result.label}</span>
                <span className="num text-[13px] text-ink-2">{fmtEur(s.result.total)}</span>
                <div
                  className={cx('anim-rise flex w-full flex-col items-center justify-start rounded-t-[6px] pt-2', rank === 1 ? 'bg-marker' : 'bg-line-2')}
                  style={{ height: heights[rank], animationDelay: `${(3 - rank) * 0.12}s` }}
                >
                  <span className="num font-title text-[30px] leading-none font-bold">{rank}</span>
                  <span className="num mt-1 text-[14px] font-semibold">
                    {s.global != null ? (
                      <>
                        <AnimatedNumber value={s.global} format={fmtScore} duration={1100} /> /20
                      </>
                    ) : (
                      '—'
                    )}
                  </span>
                  {!s.complete && <span className="text-[11px] text-ink-2">provisoire</span>}
                </div>
              </div>
            )
          })}
        </div>
        <div className="h-[3px] rounded-full bg-ink" aria-hidden="true" />
      </div>

      <div className="flex flex-col justify-center gap-3">
        {best && (
          <>
            <p className="text-[14px] text-ink-2">{awarded ? 'Offre retenue' : 'Meilleure note'}</p>
            <h2 className="font-title text-[32px] leading-[1.05] font-bold sm:text-[38px]">
              <span className="marker marker-strong anim-marker">{(awarded ?? best).result.label}</span>
            </h2>
            <p className="text-[15.5px] text-ink-2">
              {(awarded ?? best).global != null && (
                <>
                  Note globale <strong className="num text-ink">{fmtScore((awarded ?? best).global!)}/20</strong>,{' '}
                </>
              )}
              <strong className="num text-ink">{fmtEur((awarded ?? best).result.total)}</strong> HT
              {(awarded ?? best).result.vsBudget != null && (
                <span className={(awarded ?? best).result.vsBudget! > 0 ? 'text-bad' : 'text-good'}> ({fmtPctSigned((awarded ?? best).result.vsBudget)} par rapport au budget)</span>
              )}
              .{' '}
              {!awarded && best.result.rank !== 1 && a.best && <>Le moins-disant est {a.best.label} : la note technique fait la différence.</>}
            </p>
            {incomplete && !awarded && (
              <p className="rounded-md bg-warn-soft px-3 py-2 text-[13.5px] text-warn">Certaines offres n’ont pas encore toutes leurs notes : le classement peut encore bouger.</p>
            )}
            <div className="no-print mt-1 flex flex-wrap gap-2">
              {awarded ? (
                <Button variant="ghost" onClick={() => award(null)}>
                  Annuler la décision
                </Button>
              ) : (
                <AwardPicker scored={ranked} onAward={award} btnRef={btnRef} defaultId={best.result.offer.id} />
              )}
              <Link to="../synthese" relative="path" className="inline-flex h-10 items-center gap-2 rounded-[5px] border border-line bg-sheet px-3.5 font-medium hover:border-ink-3">
                <FileText size={17} /> Synthèse à présenter
              </Link>
            </div>
          </>
        )}
      </div>
    </section>
  )
}

function AwardPicker({
  scored,
  onAward,
  btnRef,
  defaultId,
}: {
  scored: ScoredOffer[]
  onAward: (id: string) => void
  btnRef: RefObject<HTMLDivElement | null>
  defaultId: string
}) {
  const [choice, setChoice] = useState(defaultId)
  return (
    <div ref={btnRef} className="flex flex-wrap items-center gap-2">
      <label htmlFor="award" className="sr-only">
        Offre à retenir
      </label>
      <select id="award" className="field h-10 w-auto max-w-full py-1 text-[14px]" value={choice} onChange={(e) => setChoice(e.target.value)}>
        {scored.map((s) => (
          <option key={s.result.offer.id} value={s.result.offer.id}>
            {s.rank}. {s.result.label}
          </option>
        ))}
      </select>
      <Button variant="primary" icon={<Trophy size={16} />} onClick={() => onAward(choice)}>
        Retenir cette offre
      </Button>
    </div>
  )
}

// ————————————————————————— Critères —————————————————————————

const KIND_LABEL: Record<Criterion['kind'], string> = { price: 'noté automatiquement', delay: 'noté automatiquement', manual: 'noté par vous' }
const WEIGHT_COLORS = ['var(--color-s1)', 'var(--color-s3)', 'var(--color-s2)', '#eda100', '#e87ba4', '#6250d6']

function CriteriaEditor({ c }: { c: Consultation }) {
  const update = useStore((s) => s.updateConsultation)
  const criteria = c.settings.criteria
  const total = totalWeight(criteria) || 1
  const set = (next: Criterion[]) => update(c.id, { settings: { ...c.settings, criteria: next } })
  const patch = (id: string, p: Partial<Criterion>) => set(criteria.map((cr) => (cr.id === id ? { ...cr, ...p } : cr)))

  return (
    <section className="panel flex flex-col gap-4 p-4 sm:p-5" aria-labelledby="crit-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="crit-title" className="font-title text-[22px] font-semibold">
            Critères de jugement
          </h2>
          <p className="text-[13.5px] text-ink-2">Prix : 20 × offre la plus basse ÷ offre. Délai : 20 × délai le plus court ÷ délai. Les poids sont ramenés à 100 %.</p>
        </div>
        <Button size="sm" icon={<Plus size={15} />} onClick={() => set([...criteria, { id: uid(), label: 'Nouveau critère', weight: 10, kind: 'manual' }])}>
          Ajouter un critère
        </Button>
      </div>
      <div className="flex h-3 gap-[2px] overflow-hidden rounded-full" aria-hidden="true">
        {criteria.map((cr, i) => (
          <span key={cr.id} className="h-full transition-[width] duration-300" style={{ width: `${(Math.max(0, cr.weight) / total) * 100}%`, background: WEIGHT_COLORS[i % WEIGHT_COLORS.length] }} />
        ))}
      </div>
      <ul className="grid gap-x-6 gap-y-3 md:grid-cols-2">
        {criteria.map((cr, i) => (
          <li key={cr.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-1">
            <span className="size-3 rounded-[3px]" style={{ background: WEIGHT_COLORS[i % WEIGHT_COLORS.length] }} aria-hidden="true" />
            {cr.kind === 'manual' ? (
              <input aria-label="Nom du critère" className="field-bare -ml-2 min-w-0 font-medium" value={cr.label} onChange={(e) => patch(cr.id, { label: e.target.value })} />
            ) : (
              <span className="font-medium">{cr.label}</span>
            )}
            <span className="flex items-center gap-1">
              <span className="num w-12 text-right font-semibold">{Math.round((Math.max(0, cr.weight) / total) * 100)} %</span>
              {cr.kind !== 'price' ? (
                <IconButton label={`Retirer le critère ${cr.label}`} className="size-7" onClick={() => set(criteria.filter((x) => x.id !== cr.id))}>
                  <X size={15} />
                </IconButton>
              ) : (
                <span className="size-7" />
              )}
            </span>
            <span />
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={cr.weight}
              aria-label={`Poids du critère ${cr.label}`}
              className="accent-plan"
              onChange={(e) => patch(cr.id, { weight: Number(e.target.value) })}
            />
            <span className="text-[12px] text-ink-3">{KIND_LABEL[cr.kind]}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

// ————————————————————————— Fiche d'une entreprise —————————————————————————

const VERDICTS: { v: Verdict; label: string; icon: ReactNode; on: string }[] = [
  { v: 'favori', label: 'Favori', icon: <Star size={14} />, on: 'border-marker bg-marker text-ink' },
  { v: 'negocier', label: 'À négocier', icon: <MessageSquare size={14} />, on: 'border-plan bg-plan text-white' },
  { v: 'ecarte', label: 'Écartée', icon: <Ban size={14} />, on: 'border-bad bg-bad text-white' },
]

function OfferCard({ c, a, s }: { c: Consultation; a: Analysis; s: ScoredOffer }) {
  const r = s.result
  const o = r.offer
  const { plus, minus } = useMemo(() => strengthsAndWeaknesses(a, r), [a, r])
  const total = totalWeight(c.settings.criteria) || 1
  const isAwarded = c.awardedOfferId === o.id

  return (
    <article className={cx('panel relative flex flex-col transition-opacity', s.verdict === 'ecarte' && 'opacity-60', isAwarded && 'border-good ring-2 ring-good/30')}>
      {isAwarded && (
        <span className="anim-stamp absolute top-3 right-3 rounded-[4px] border-2 border-good px-2 py-0.5 text-[12px] font-bold tracking-wide text-good uppercase">Retenue</span>
      )}
      <header className="flex items-start gap-3 border-b border-line-2 p-4">
        <span className={cx('num flex size-8 shrink-0 items-center justify-center rounded-full text-[15px] font-bold', s.rank === 1 ? 'bg-marker' : 'bg-line-2 text-ink-2')}>
          {s.rank ?? '–'}
        </span>
        <CompanyLogo name={o.company || '?'} url={o.logoUrl} size={48} />
        <div className="min-w-0 flex-1 pr-16">
          <h3 className="truncate text-[19px] leading-tight font-semibold">{r.label}</h3>
          <ContactLine offer={o} />
        </div>
      </header>

      <div className="grid gap-4 p-4 sm:grid-cols-[auto_1fr]">
        <ScoreRing value={s.global} complete={s.complete} />
        <div className="grid content-center gap-1 text-[14.5px]">
          <p>
            <span className="num text-[22px] font-semibold">{fmtEur(r.total)}</span> <span className="text-ink-2">HT comparé</span>
          </p>
          <p className="text-[13.5px] text-ink-2">
            {r.rank === 1 ? 'Moins-disant' : `${fmtPctSigned(r.vsBest)} par rapport au moins-disant`}
            {r.vsBudget != null && <span className={r.vsBudget > 0 ? 'text-bad' : 'text-good'}>, {fmtPctSigned(r.vsBudget)} par rapport au budget</span>}
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5" role="group" aria-label="Votre avis">
            {VERDICTS.map((v) => (
              <button
                key={v.v}
                type="button"
                aria-pressed={s.verdict === v.v}
                onClick={() => saveReview(c.id, o.id, { verdict: s.verdict === v.v ? null : v.v })}
                className={cx(
                  'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[13px] font-medium transition-all active:scale-95',
                  s.verdict === v.v ? v.on : 'border-line bg-sheet text-ink-2 hover:border-ink-3',
                )}
              >
                {v.icon} {v.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-3 border-t border-line-2 p-4">
        {s.scores.map((cs) => (
          <div key={cs.criterion.id} className="grid grid-cols-[minmax(0,1fr)_3.5rem] items-center gap-x-3 gap-y-1">
            <span className="text-[14px]">
              {cs.criterion.label} <span className="text-[12.5px] text-ink-3">{Math.round((Math.max(0, cs.criterion.weight) / total) * 100)} %</span>
            </span>
            <span className="num text-right text-[14px] font-semibold">{cs.score != null ? `${fmtScore(cs.score)}` : '—'}</span>
            {cs.auto ? (
              <span className="col-span-2 h-2 rounded-full bg-line-2">
                <span className="block h-full rounded-full bg-s1 transition-[width] duration-500" style={{ width: `${((cs.score ?? 0) / 20) * 100}%` }} />
              </span>
            ) : (
              <input
                type="range"
                min={0}
                max={20}
                step={0.5}
                value={cs.score ?? 0}
                aria-label={`Note ${cs.criterion.label} sur 20`}
                className={cx('col-span-2 accent-plan', cs.score == null && 'opacity-40')}
                onChange={(e) => saveReview(c.id, o.id, { scores: { [cs.criterion.id]: Number(e.target.value) } })}
              />
            )}
          </div>
        ))}
        {s.scores.some((x) => !x.auto && x.score == null) && <p className="text-[12.5px] text-warn">Faites glisser le curseur pour noter ce critère sur 20.</p>}
      </div>

      <div className="grid gap-4 border-t border-line-2 p-4 sm:grid-cols-2">
        <PointList title="Points forts" items={plus} tone="good" />
        <PointList title="Points de vigilance" items={minus} tone="bad" />
      </div>

      <Comments c={c} offerId={o.id} />

      <footer className="mt-auto flex justify-end border-t border-line-2 px-4 py-2.5">
        <Link to={`../offres/${o.id}`} relative="path" className="text-[14px] font-medium text-plan hover:underline">
          Voir l’offre détaillée
        </Link>
      </footer>
    </article>
  )
}

function ScoreRing({ value, complete }: { value: number | null; complete: boolean }) {
  const r = 30
  const circ = 2 * Math.PI * r
  const k = value != null ? Math.max(0, Math.min(1, value / 20)) : 0
  return (
    <div className="relative flex size-[84px] items-center justify-center" title={complete ? 'Toutes les notes sont saisies' : 'Notes incomplètes'}>
      <svg viewBox="0 0 72 72" className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle cx="36" cy="36" r={r} fill="none" stroke="var(--color-line-2)" strokeWidth="6" />
        <circle
          cx="36"
          cy="36"
          r={r}
          fill="none"
          stroke={complete ? 'var(--color-plan)' : 'var(--color-ink-3)'}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - k)}
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(.2,.8,.2,1)' }}
        />
      </svg>
      <span className="text-center leading-none">
        <span className="num block text-[22px] font-bold">{value != null ? <AnimatedNumber value={value} format={fmtScore} /> : '—'}</span>
        <span className="text-[11px] text-ink-3">sur 20</span>
      </span>
    </div>
  )
}

function PointList({ title, items, tone }: { title: string; items: string[]; tone: 'good' | 'bad' }) {
  return (
    <div>
      <p className={cx('mb-1.5 text-[13px] font-semibold', tone === 'good' ? 'text-good' : 'text-bad')}>{title}</p>
      {items.length ? (
        <ul className="grid gap-1 text-[14px] leading-snug">
          {items.map((t) => (
            <li key={t} className="grid grid-cols-[0.9rem_1fr] gap-1.5">
              <span className={cx('font-bold', tone === 'good' ? 'text-good' : 'text-bad')} aria-hidden="true">
                {tone === 'good' ? '+' : '−'}
              </span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13.5px] text-ink-3">Rien à signaler.</p>
      )}
    </div>
  )
}

function Comments({ c, offerId }: { c: Consultation; offerId: string }) {
  const list = useStore((s) => s.comments[offerId]) ?? []
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="grid gap-2 border-t border-line-2 bg-paper/50 p-4">
      <p className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-2">
        <Lock size={13} /> Commentaires internes
      </p>
      {list.length > 0 && (
        <ul className="grid gap-2">
          {list.map((cm) => (
            <li key={cm.id} className="group anim-pop grid grid-cols-[1fr_auto] gap-2 rounded-md border border-line bg-sheet px-3 py-2 text-[14px]">
              <div>
                <p className="whitespace-pre-line">{cm.body}</p>
                <p className="mt-0.5 text-[12px] text-ink-3">{new Date(cm.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
              </div>
              <IconButton
                label="Supprimer le commentaire"
                className="size-7 opacity-60 group-hover:opacity-100"
                onClick={async () => {
                  try {
                    await deleteComment(offerId, cm.id)
                  } catch (e) {
                    setError(errorMessage(e))
                  }
                }}
              >
                <Trash2 size={14} />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault()
          const body = text.trim()
          if (!body) return
          setBusy(true)
          setError(null)
          try {
            await addComment(c.id, offerId, body)
            setText('')
          } catch (err) {
            setError(errorMessage(err))
          } finally {
            setBusy(false)
          }
        }}
      >
        <input aria-label="Ajouter un commentaire interne" className="field h-9 py-1 text-[14px]" placeholder="Ajouter un commentaire…" value={text} onChange={(e) => setText(e.target.value)} />
        <IconButton label="Envoyer le commentaire" type="submit" disabled={busy || !text.trim()} className="border border-line bg-sheet">
          {busy ? <Spinner /> : <Send size={15} />}
        </IconButton>
      </form>
      {error && <p className="text-[13px] text-bad">{error}</p>}
    </div>
  )
}
