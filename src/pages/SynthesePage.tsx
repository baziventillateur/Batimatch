import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, Printer } from 'lucide-react'
import { useC } from './ConsultationLayout'
import { useStore } from '../store'
import { useAuth } from '../data/auth'
import { analyze } from '../lib/calc'
import { scoreOffers, strengthsAndWeaknesses, totalWeight } from '../lib/decision'
import { fmtDate, fmtEur, fmtNum, fmtPctSigned, todayIso } from '../lib/format'
import { Button, CompanyLogo, cx } from '../components/ui'
import { RankingChart } from '../components/charts'

const VERDICT_LABEL = { favori: 'Favori', negocier: 'À négocier', ecarte: 'Écartée' } as const
const fmtScore = (v: number | null) => (v == null ? '—' : fmtNum(Math.round(v * 10) / 10))

/** Note de synthèse imprimable, à présenter pour valider le choix de l'entreprise */
export default function SynthesePage() {
  const c = useC()
  const { profile } = useAuth()
  const reviews = useStore((s) => s.reviews)
  const comments = useStore((s) => s.comments)
  const a = useMemo(() => analyze(c), [c])
  const scored = useMemo(() => scoreOffers(a, c.settings.criteria, reviews), [a, c.settings.criteria, reviews])
  const total = totalWeight(c.settings.criteria) || 1
  const awarded = scored.find((s) => s.result.offer.id === c.awardedOfferId)
  const reco = awarded ?? scored.find((s) => s.rank === 1)
  const author = profile ? [profile.firstName, profile.lastName].filter(Boolean).join(' ') : ''

  return (
    <div className="flex flex-col gap-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link to="../decision" relative="path" className="inline-flex items-center gap-1 text-[0.875rem] text-ink-2 hover:text-ink">
          <ChevronLeft size={16} /> Retour à la décision
        </Link>
        <Button variant="primary" icon={<Printer size={16} />} onClick={() => window.print()}>
          Imprimer ou enregistrer en PDF
        </Button>
      </div>

      <article className="mx-auto w-full max-w-[900px] bg-sheet p-6 shadow-[0_1px_3px_rgb(27_42_58/0.12)] sm:p-10 print:p-0 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-ink pb-4">
          <div>
            <p className="text-[0.8125rem] text-ink-3">Note de synthèse, choix de l’entreprise</p>
            <h1 className="font-title text-[2.125rem] leading-tight font-bold">{c.name}</h1>
            <p className="text-ink-2">{[c.affaire, c.lot].filter(Boolean).join(', ')}</p>
          </div>
          <div className="flex items-center gap-3 text-right text-[0.8438rem]">
            <div>
              <p className="font-semibold">{profile?.companyName}</p>
              <p className="text-ink-2">{author}</p>
              <p className="text-ink-3">Le {fmtDate(todayIso())}</p>
            </div>
            {profile && <CompanyLogo name={profile.companyName || author || '?'} url={profile.logoUrl} size={48} />}
          </div>
        </header>

        {reco && (
          <section className="mt-6 grid gap-4 rounded-md border-2 border-ink p-5 sm:grid-cols-[auto_1fr]">
            <CompanyLogo name={reco.result.offer.company || '?'} url={reco.result.offer.logoUrl} size={64} />
            <div>
              <p className="text-[0.8125rem] text-ink-3">{awarded ? 'Entreprise retenue' : 'Entreprise proposée'}</p>
              <h2 className="font-title text-[1.75rem] leading-tight font-bold">
                <span className="marker marker-strong">{reco.result.label}</span>
              </h2>
              <p className="mt-1 text-[0.9375rem]">
                <strong className="num">{fmtEur(reco.result.total)} HT</strong>
                {reco.global != null && (
                  <>
                    , note globale <strong className="num">{fmtScore(reco.global)}/20</strong>
                  </>
                )}
                {reco.result.vsBudget != null && (
                  <span className={reco.result.vsBudget > 0 ? 'text-bad' : 'text-good'}>
                    , {fmtPctSigned(reco.result.vsBudget)} par rapport au budget de {fmtEur(c.budget)}
                  </span>
                )}
                .
              </p>
              <ul className="mt-2 grid gap-0.5 text-[0.875rem]">
                {strengthsAndWeaknesses(a, reco.result).plus.slice(0, 4).map((t) => (
                  <li key={t}>+ {t}</li>
                ))}
              </ul>
            </div>
          </section>
        )}

        <section className="mt-7">
          <h3 className="mb-2 font-title text-[1.25rem] font-semibold">Classement des offres</h3>
          <div className="scroll-x">
            <table className="w-full min-w-[620px] border-collapse text-[0.8438rem]">
              <thead>
                <tr className="border-b-2 border-ink text-left text-[0.7812rem] text-ink-2">
                  <th className="py-1.5 pr-2 font-normal">Rang</th>
                  <th className="py-1.5 pr-2 font-normal">Entreprise</th>
                  <th className="py-1.5 pr-2 text-right font-normal">Montant comparé HT</th>
                  <th className="py-1.5 pr-2 text-right font-normal">Écart budget</th>
                  <th className="py-1.5 pr-2 text-right font-normal">Délai</th>
                  {c.settings.criteria.map((cr) => (
                    <th key={cr.id} className="py-1.5 pr-2 text-right font-normal">
                      {cr.label} <span className="text-ink-3">({Math.round((Math.max(0, cr.weight) / total) * 100)} %)</span>
                    </th>
                  ))}
                  <th className="py-1.5 pr-2 text-right font-normal">Note /20</th>
                  <th className="py-1.5 font-normal">Avis</th>
                </tr>
              </thead>
              <tbody>
                {scored.map((s) => (
                  <tr key={s.result.offer.id} className={cx('border-b border-line', s.result.offer.id === reco?.result.offer.id && 'font-semibold')}>
                    <td className="num py-1.5 pr-2">{s.rank ?? '–'}</td>
                    <td className="py-1.5 pr-2">
                      <span className="flex items-center gap-2">
                        <CompanyLogo name={s.result.offer.company || '?'} url={s.result.offer.logoUrl} size={22} />
                        {s.result.label}
                      </span>
                    </td>
                    <td className="num py-1.5 pr-2 text-right">{fmtEur(s.result.total)}</td>
                    <td className={cx('num py-1.5 pr-2 text-right', s.result.vsBudget != null && (s.result.vsBudget > 0 ? 'text-bad' : 'text-good'))}>{fmtPctSigned(s.result.vsBudget)}</td>
                    <td className="num py-1.5 pr-2 text-right">{s.result.offer.durationWeeks != null ? `${fmtNum(s.result.offer.durationWeeks)} sem.` : '—'}</td>
                    {s.scores.map((cs) => (
                      <td key={cs.criterion.id} className="num py-1.5 pr-2 text-right">
                        {fmtScore(cs.score)}
                      </td>
                    ))}
                    <td className="num py-1.5 pr-2 text-right">{fmtScore(s.global)}</td>
                    <td className="py-1.5">{s.verdict ? VERDICT_LABEL[s.verdict] : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-7 break-inside-avoid">
          <h3 className="mb-3 font-title text-[1.25rem] font-semibold">Montants comparés</h3>
          <RankingChart a={a} awardedId={c.awardedOfferId} />
        </section>

        <section className="mt-7">
          <h3 className="mb-3 font-title text-[1.25rem] font-semibold">Analyse par entreprise</h3>
          <div className="grid gap-4">
            {scored.map((s) => {
              const sw = strengthsAndWeaknesses(a, s.result)
              const cms = comments[s.result.offer.id] ?? []
              return (
                <div key={s.result.offer.id} className="break-inside-avoid rounded-md border border-line p-4">
                  <p className="flex items-center gap-2 font-semibold">
                    <CompanyLogo name={s.result.offer.company || '?'} url={s.result.offer.logoUrl} size={26} />
                    {s.result.label}
                    <span className="num ml-auto text-[0.875rem] font-normal text-ink-2">{fmtEur(s.result.total)}</span>
                  </p>
                  <div className="mt-2 grid gap-3 text-[0.8438rem] sm:grid-cols-2">
                    <ul className="grid gap-0.5">
                      {sw.plus.map((t) => (
                        <li key={t} className="text-good">
                          + <span className="text-ink">{t}</span>
                        </li>
                      ))}
                    </ul>
                    <ul className="grid gap-0.5">
                      {sw.minus.map((t) => (
                        <li key={t} className="text-bad">
                          − <span className="text-ink">{t}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {s.result.offer.reserves && <p className="mt-2 text-[0.8125rem] text-ink-2">Réserves : {s.result.offer.reserves}</p>}
                  {cms.length > 0 && (
                    <div className="mt-2 border-t border-line-2 pt-2 text-[0.8438rem]">
                      {cms.map((cm) => (
                        <p key={cm.id} className="text-ink-2">
                          « {cm.body} »
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {a.insights.length > 0 && (
          <section className="mt-7 break-inside-avoid">
            <h3 className="mb-2 font-title text-[1.25rem] font-semibold">Points de vigilance</h3>
            <ul className="grid gap-1 text-[0.8438rem]">
              {a.insights
                .filter((i) => i.level !== 'good')
                .slice(0, 8)
                .map((i) => (
                  <li key={i.text}>• {i.text}</li>
                ))}
            </ul>
          </section>
        )}

        <footer className="mt-10 grid grid-cols-2 gap-6 border-t-2 border-ink pt-4 text-[0.8438rem]">
          <div>
            <p className="text-ink-3">Établi par</p>
            <p className="font-medium">{author || '…'}</p>
          </div>
          <div>
            <p className="text-ink-3">Validé par</p>
            <p className="mt-6 border-b border-ink-3" />
          </div>
        </footer>
      </article>
    </div>
  )
}
