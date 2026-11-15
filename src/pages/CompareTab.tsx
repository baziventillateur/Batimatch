import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, CircleAlert, Download, Info, Printer, Trophy } from 'lucide-react'
import { useC } from './ConsultationLayout'
import { useStore } from '../store'
import { analyze, companyKey, qtyOf, type Analysis, type Insight, type LineStat, type OfferResult } from '../lib/calc'
import { companyColor, DIVERGING, divergingColor } from '../lib/colors'
import { fmtDate, fmtEur, fmtEurCompact, fmtEurSigned, fmtNum, fmtPct, fmtPctSigned, todayIso } from '../lib/format'
import { exportComparison } from '../lib/io'
import type { Consultation, FillMode } from '../lib/types'
import { Button, CompanyLogo, EmptyState, Segmented, Toggle, cx, useTip } from '../components/ui'
import { ParetoList, RankingChart, VersionChart } from '../components/charts'
import { TechNoteBadge } from '../components/TechNote'

export default function CompareTab() {
  const c = useC()
  const update = useStore((s) => s.updateConsultation)
  const a = useMemo(() => analyze(c), [c])
  const setSettings = (patch: Partial<Consultation['settings']>) => update(c.id, { settings: { ...c.settings, ...patch } })
  const colorOf = (company: string) => companyColor(c, company)
  const companies = new Set(c.offers.map((o) => companyKey(o.company))).size

  if (companies < 2 || a.ranked.length < 2) {
    return (
      <EmptyState
        title={c.offers.length ? 'Encore une offre et le comparatif s’affiche' : 'Le comparatif attend les offres'}
        action={
          <Link to="../offres" relative="path" className="inline-flex h-10 items-center rounded-[5px] bg-plan px-3.5 font-medium text-sheet hover:bg-plan-dark">
            {c.offers.length ? 'Ajouter une offre' : 'Saisir les offres'}
          </Link>
        }
      >
        Il faut au moins deux entreprises avec des prix saisis pour les classer et mesurer les écarts.
      </EmptyState>
    )
  }

  const awarded = a.offers.find((r) => r.offer.id === c.awardedOfferId)

  return (
    <div className="flex flex-col gap-5">
      <SettingsBar c={c} a={a} onChange={setSettings} />

      {/* Verdict */}
      <section className="panel grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-10" aria-label="Classement">
        <div className="flex flex-col gap-3">
          <p className="text-[0.875rem] text-ink-2">{awarded ? 'Offre retenue' : 'Moins-disant après remise à niveau'}</p>
          <h2 className="font-title text-[2.125rem] leading-[1.05] font-bold sm:text-[2.75rem]">
            <span className="marker marker-strong">{(awarded ?? a.best)!.label}</span>
          </h2>
          <p className="num text-[1.875rem] leading-none font-semibold sm:text-[2.125rem]">
            {fmtEur((awarded ?? a.best)!.total)} <span className="text-[1rem] font-normal text-ink-2">HT</span>
          </p>
          <Verdict a={a} awarded={awarded} />
          <Link to="../decision" relative="path" className="no-print mt-2 inline-flex w-fit items-center gap-2 rounded-[5px] bg-plan px-3.5 py-2 font-medium text-sheet hover:bg-plan-dark">
            <Trophy size={16} /> {awarded ? 'Voir la décision' : 'Passer à la décision'}
          </Link>
        </div>
        <RankingChart a={a} awardedId={c.awardedOfferId} />
      </section>

      {/* Indicateurs */}
      <section aria-label="Indicateurs clés" className="cartouche grid grid-cols-2 gap-px bg-ink/20 md:grid-cols-3 xl:grid-cols-6">
        <Kpi
          label="Écart 1er / 2e"
          value={fmtPct(a.gapBestSecond)}
          detail={a.second && a.best ? `${fmtEur(a.second.total - a.best.total)} entre les deux` : undefined}
        />
        <Kpi
          label="Moins-disant / budget"
          value={a.bestVsBudget != null ? fmtPctSigned(a.bestVsBudget) : '—'}
          tone={a.bestVsBudget == null ? undefined : a.bestVsBudget > 0 ? 'bad' : 'good'}
          detail={a.best && a.budget ? fmtEurSigned(a.best.total - a.budget) : 'Budget non renseigné'}
        />
        <Kpi label="Dispersion des offres" value={fmtPct(a.spread)} detail="Écart entre l’offre la plus basse et la plus haute" />
        <Kpi
          label="Potentiel de négociation"
          value={a.negotiationPotential != null ? fmtEurCompact(a.negotiationPotential) : '—'}
          detail="Moins-disant aligné sur le meilleur prix de chaque ligne"
        />
        <Kpi
          label="Lignes non chiffrées"
          value={String(a.ranked.reduce((s, r) => s + r.missingCount, 0))}
          tone={a.ranked.some((r) => r.missingCount) ? 'warn' : undefined}
          detail={
            a.ranked.some((r) => r.missingCount)
              ? `${a.ranked.filter((r) => r.missingCount).length} entreprise(s) concernée(s)`
              : 'Toutes les offres sont complètes'
          }
        />
        <Kpi
          label="Gain des négociations"
          value={a.histories.length ? fmtEurCompact(a.histories.reduce((s, h) => s + Math.max(0, h.gain), 0)) : '—'}
          tone={a.histories.some((h) => h.gain > 0) ? 'good' : undefined}
          detail={a.histories.length ? `Sur ${a.histories.length} entreprise(s) en V2 ou plus` : 'Aucune nouvelle version'}
        />
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <Section title="Points de vigilance" subtitle="Repérés automatiquement dans les offres.">
          <Insights items={a.insights} />
        </Section>
        <Section title="Postes qui pèsent le plus" subtitle={paretoSubtitle(a)}>
          <ParetoList a={a} />
        </Section>
      </div>

      <Section title="Synthèse par entreprise" subtitle="Les colonnes suivent le classement. Le total compare les offres sur la même base." flush>
        <SummaryTable c={c} a={a} colorOf={colorOf} />
      </Section>

      <Section title="Par chapitre" subtitle="Couleur selon l’écart à la médiane du chapitre : bleu moins cher, rouge plus cher." flush>
        <ChapterTable a={a} colorOf={colorOf} c={c} />
      </Section>

      <Section title="Détail ligne à ligne" subtitle="Le meilleur prix de chaque ligne est surligné." flush>
        <LineTable a={a} c={c} colorOf={colorOf} />
      </Section>

      <div className="grid gap-5 xl:grid-cols-2">
        {a.histories.length > 0 && (
          <Section title="Évolution des offres" subtitle="Base nette de chaque version, toutes versions confondues.">
            <VersionChart histories={a.histories} colorOf={colorOf} />
          </Section>
        )}
      </div>
    </div>
  )
}

const paretoSubtitle = (a: Analysis) =>
  `${a.paretoCount80} poste${a.paretoCount80 > 1 ? 's' : ''} sur ${a.baseLineCount} représentent 80 % du montant : c’est là que se joue la négociation.`

// ————————————————————————— Réglages —————————————————————————

function SettingsBar({ c, a, onChange }: { c: Consultation; a: Analysis; onChange: (p: Partial<Consultation['settings']>) => void }) {
  const s = c.settings
  const hasVersions = c.offers.length > new Set(c.offers.map((o) => companyKey(o.company))).size
  return (
    <section className="no-print panel flex flex-col gap-4 p-4" aria-label="Réglages du comparatif">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
        <div className="grid gap-1.5">
          <span className="text-[0.8125rem] text-ink-2">Compléter les lignes non chiffrées au</span>
          <Segmented<FillMode>
            size="sm"
            label="Remise à niveau des lignes non chiffrées"
            value={s.fillMode}
            onChange={(fillMode) => onChange({ fillMode })}
            options={[
              { value: 'median', label: 'Prix médian' },
              { value: 'max', label: 'Prix le plus haut' },
              { value: 'none', label: 'Ignorer' },
            ]}
          />
        </div>
        {hasVersions && (
          <div className="grid gap-1.5">
            <span className="text-[0.8125rem] text-ink-2">Versions</span>
            <Segmented
              size="sm"
              label="Versions comparées"
              value={s.latestOnly ? 'latest' : 'all'}
              onChange={(v) => onChange({ latestOnly: v === 'latest' })}
              options={[
                { value: 'latest', label: 'Dernière par entreprise' },
                { value: 'all', label: 'Toutes' },
              ]}
            />
          </div>
        )}
        <div className="ml-auto flex gap-2">
          <Button size="sm" icon={<Download size={15} />} onClick={() => exportComparison(c)}>
            Exporter (Excel)
          </Button>
          <Button size="sm" icon={<Printer size={15} />} onClick={() => window.print()}>
            Imprimer
          </Button>
        </div>
      </div>
      {a.pseLines.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line-2 pt-3">
          <span className="text-[0.8125rem] text-ink-2">PSE intégrées au comparatif</span>
          {a.pseLines.map((it) => (
            <Toggle
              key={it.id}
              checked={!!s.pseRetained[it.id]}
              onChange={(v) => onChange({ pseRetained: { ...s.pseRetained, [it.id]: v } })}
              label={<span className="text-[0.875rem]">{[it.ref, it.label].filter(Boolean).join(' ')}</span>}
            />
          ))}
        </div>
      )}
    </section>
  )
}

// ————————————————————————— Verdict et décision —————————————————————————

function Verdict({ a, awarded }: { a: Analysis; awarded?: OfferResult }) {
  const best = a.best!
  const parts: ReactNode[] = []
  if (awarded && awarded.offer.id !== best.offer.id) {
    parts.push(
      <>
        Classée {awarded.rank}e sur {a.ranked.length}, <span className="num">{fmtPctSigned(awarded.vsBest)}</span> par rapport au moins-disant (
        {best.label}).
      </>,
    )
  } else if (a.second && a.gapBestSecond != null) {
    parts.push(
      <>
        <span className="num font-medium">{fmtPct(a.gapBestSecond)}</span> sous {a.second.label}
        {a.average && a.ranked.length > 2 && (
          <>
            , <span className="num font-medium">{fmtPct(1 - best.total / a.average)}</span> sous la moyenne des offres
          </>
        )}
        .
      </>,
    )
  }
  const ref = awarded ?? best
  if (a.budget && ref.vsBudget != null) {
    parts.push(
      <span className={ref.vsBudget > 0 ? 'text-bad' : 'text-good'}>
        {ref.vsBudget > 0 ? 'Dépasse' : 'Tient'} le budget {ref.vsBudget > 0 ? 'de' : 'avec'}{' '}
        <span className="num font-medium">{fmtEur(Math.abs(ref.total - a.budget))}</span>
        {ref.vsBudget <= 0 && ' de marge'}.
      </span>,
    )
  }
  const lowestDeclared = [...a.ranked].sort((x, y) => x.declared - x.discount - (y.declared - y.discount))[0]
  if (lowestDeclared && lowestDeclared.offer.id !== best.offer.id && lowestDeclared.fill > 0) {
    parts.push(
      <>
        {lowestDeclared.label} paraît moins cher à la lecture, mais il manque {lowestDeclared.missingCount} ligne
        {lowestDeclared.missingCount > 1 ? 's' : ''} à son offre.
      </>,
    )
  }
  return (
    <div className="flex max-w-[52ch] flex-col gap-1.5 text-[0.9688rem] text-ink-2">
      {parts.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  )
}

// ————————————————————————— Briques de mise en page —————————————————————————

function Section({ title, subtitle, children, flush }: { title: string; subtitle?: string; children: ReactNode; flush?: boolean }) {
  return (
    <section className="panel flex min-w-0 flex-col">
      <header className="px-4 pt-4 pb-3 sm:px-5">
        <h3 className="font-title text-[1.375rem] leading-tight font-semibold">{title}</h3>
        {subtitle && <p className="mt-0.5 max-w-[80ch] text-[0.8438rem] text-ink-2">{subtitle}</p>}
      </header>
      <div className={cx('min-w-0', flush ? '' : 'px-4 pb-4 sm:px-5 sm:pb-5')}>{children}</div>
    </section>
  )
}

function Kpi({ label, value, detail, tone }: { label: string; value: string; detail?: string; tone?: 'good' | 'bad' | 'warn' }) {
  return (
    <div className="flex flex-col gap-0.5 bg-sheet px-4 py-3.5">
      <span className="cartouche-label">{label}</span>
      <span className={cx('num text-[1.625rem] leading-tight font-semibold', tone === 'good' && 'text-good', tone === 'bad' && 'text-bad', tone === 'warn' && 'text-warn')}>
        {value}
      </span>
      {detail && <span className="text-[0.7812rem] leading-snug text-ink-3">{detail}</span>}
    </div>
  )
}

const INSIGHT_ICON: Record<Insight['level'], ReactNode> = {
  critical: <CircleAlert size={17} className="text-bad" aria-label="Critique" />,
  warning: <AlertTriangle size={17} className="text-warn" aria-label="Attention" />,
  info: <Info size={17} className="text-plan" aria-label="Information" />,
  good: <CheckCircle2 size={17} className="text-good" aria-label="Positif" />,
}
const LEVEL_ORDER: Insight['level'][] = ['critical', 'warning', 'info', 'good']

function Insights({ items }: { items: Insight[] }) {
  const [all, setAll] = useState(false)
  const sorted = [...items].sort((x, y) => LEVEL_ORDER.indexOf(x.level) - LEVEL_ORDER.indexOf(y.level))
  const shown = all ? sorted : sorted.slice(0, 7)
  if (!items.length) return <p className="text-ink-2">Rien à signaler.</p>
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col">
        {shown.map((it, i) => (
          <li key={i} className="grid grid-cols-[1.25rem_1fr] gap-2.5 border-b border-line-2 py-2 text-[0.9062rem] leading-snug last:border-0">
            <span className="pt-0.5">{INSIGHT_ICON[it.level]}</span>
            <span>{it.text}</span>
          </li>
        ))}
      </ul>
      {sorted.length > 7 && (
        <Button size="sm" variant="ghost" className="no-print self-start" onClick={() => setAll((x) => !x)}>
          {all ? 'Réduire' : `Voir les ${sorted.length - 7} autres points`}
        </Button>
      )}
    </div>
  )
}

function CompanyHead({ r, color }: { r: OfferResult; color: string }) {
  return (
    <span className="flex items-center justify-end gap-1.5">
      <CompanyLogo name={r.offer.company || '?'} url={r.offer.logoUrl} size={22} />
      <span className={cx('truncate', r.rank === 1 && 'font-semibold text-ink')}>{r.label}</span>
      <span className="size-2 shrink-0 rounded-[2px]" style={{ background: color }} aria-hidden="true" />
    </span>
  )
}

// ————————————————————————— Tableau de synthèse —————————————————————————

function SummaryTable({ c, a, colorOf }: { c: Consultation; a: Analysis; colorOf: (n: string) => string }) {
  const cols = a.ranked
  const today = todayIso()
  type RowDef = { label: string; render: (r: OfferResult) => ReactNode; strong?: boolean; hint?: string; wrap?: boolean }
  const rows: RowDef[] = [
    { label: 'Base déclarée', render: (r) => fmtEur(r.declared) },
    { label: 'Remise commerciale', render: (r) => (r.discount ? `−${fmtEur(r.discount)}` : '—') },
    {
      label: 'Remise à niveau',
      hint: 'Lignes non chiffrées complétées selon le réglage choisi.',
      render: (r) => (r.fill ? <span className="text-warn">+{fmtEur(r.fill)}</span> : '—'),
    },
    { label: 'PSE retenues', render: (r) => (r.pse ? fmtEur(r.pse) : '—') },
    { label: 'Variantes et options retenues', render: (r) => (r.extras ? fmtEurSigned(r.extras) : '—') },
    {
      label: 'Total comparé HT',
      strong: true,
      render: (r) => <span className={cx(r.rank === 1 && 'marker')}>{fmtEur(r.total)}</span>,
    },
    { label: 'Écart au moins-disant', render: (r) => (r.rank === 1 ? '—' : fmtPctSigned(r.vsBest)) },
    {
      label: 'Écart au budget',
      render: (r) =>
        r.vsBudget == null ? '—' : <span className={r.vsBudget > 0 ? 'text-bad' : 'text-good'}>{fmtPctSigned(r.vsBudget)}</span>,
    },
    { label: 'Lignes renseignées', render: (r) => `${Math.round(r.completeness * 100)} %` },
    { label: 'Prix anormaux (±30 %)', render: (r) => (r.anomalies ? <span className="text-warn">{r.anomalies}</span> : '0') },
    { label: 'Surcoût vs médiane', hint: 'Somme des lignes plus chères que la médiane : levier de négociation.', render: (r) => fmtEur(r.overMedian) },
    { label: 'Délai d’exécution', render: (r) => (r.offer.durationWeeks != null ? `${fmtNum(r.offer.durationWeeks)} sem.` : '—') },
    {
      label: 'Validité',
      render: (r) =>
        r.offer.validUntil ? (
          <span className={r.offer.validUntil < today ? 'text-bad' : ''}>
            {r.offer.validUntil < today ? 'expirée ' : ''}
            {fmtDate(r.offer.validUntil)}
          </span>
        ) : (
          '—'
        ),
    },
    { label: 'Note prix', render: (r) => (r.priceScore != null ? `${fmtNum(Math.round(r.priceScore * 100) / 100)} / 20` : '—') },
    { label: 'Notice technique', hint: 'PDF facultatif joint par l’entreprise : un signe de sérieux à prendre en compte dans la note technique.', render: (r) => <TechNoteBadge c={c} offer={r.offer} /> },
    {
      label: 'Réserves',
      wrap: true,
      render: (r) =>
        r.offer.reserves.trim() ? (
          <span className="line-clamp-3 text-left text-[0.8125rem] whitespace-normal text-ink-2" title={r.offer.reserves}>
            {r.offer.reserves}
          </span>
        ) : (
          '—'
        ),
    },
  ]
  return (
    <div className="scroll-x border-t border-line">
      <table className="w-full min-w-[640px] border-collapse text-[0.875rem]">
        <thead>
          <tr className="border-b border-line bg-paper/70 text-[0.8125rem] text-ink-2">
            <th className="sticky left-0 z-10 bg-paper px-4 py-2 text-left font-normal sm:px-5">Rang</th>
            {cols.map((r) => (
              <th key={r.offer.id} className="min-w-[150px] px-3 py-2 text-right font-normal">
                <span className="num block text-[0.75rem] text-ink-3">{r.rank}</span>
                <CompanyHead r={r} color={colorOf(r.offer.company)} />
                <Link to={`../offres/${r.offer.id}`} relative="path" className="no-print text-[0.75rem] text-plan hover:underline">
                  Ouvrir l’offre
                </Link>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className={cx('border-b border-line-2', row.strong && 'bg-paper/50')}>
              <th scope="row" className={cx('sticky left-0 z-10 bg-sheet px-4 py-2 text-left font-normal text-ink-2 sm:px-5', row.strong && 'bg-paper font-semibold text-ink')}>
                <span title={row.hint}>{row.label}</span>
              </th>
              {cols.map((r) => (
                <td
                  key={r.offer.id}
                  className={cx(
                    'num px-3 py-2 text-right',
                    row.wrap ? 'max-w-[240px] align-top' : 'whitespace-nowrap',
                    row.strong && 'text-[1rem] font-semibold',
                  )}
                >
                  {row.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {c.settings.fillMode !== 'none' && a.ranked.some((r) => r.fill) && (
        <p className="px-4 py-2.5 text-[0.7812rem] text-ink-3 sm:px-5">
          Remise à niveau : chaque ligne non chiffrée est complétée au prix {c.settings.fillMode === 'max' ? 'le plus haut' : 'médian'} des autres
          offres, pour comparer des périmètres identiques.
        </p>
      )}
    </div>
  )
}

// ————————————————————————— Par chapitre —————————————————————————

function ChapterTable({ a, colorOf, c }: { a: Analysis; colorOf: (n: string) => string; c: Consultation }) {
  const { bind, node } = useTip()
  const cols = a.ranked
  return (
    <div className="border-t border-line">
      <div className="scroll-x">
        <table className="w-full min-w-[620px] border-collapse text-[0.875rem]">
          <thead>
            <tr className="border-b border-line bg-paper/70 text-[0.8125rem] text-ink-2">
              <th className="sticky left-0 z-10 bg-paper px-4 py-2 text-left font-normal sm:px-5">Chapitre</th>
              {cols.map((r) => (
                <th key={r.offer.id} className="min-w-[130px] px-3 py-2 text-right font-normal">
                  <CompanyHead r={r} color={colorOf(r.offer.company)} />
                </th>
              ))}
              <th className="min-w-[110px] px-3 py-2 text-right font-normal">Médiane</th>
            </tr>
          </thead>
          <tbody>
            {a.chapters.map((ch) => (
              <tr key={ch.id ?? '_'} className="border-b border-line-2">
                <th scope="row" className="sticky left-0 z-10 max-w-[260px] truncate bg-sheet px-4 py-2 text-left font-normal sm:px-5">
                  {ch.label}
                </th>
                {cols.map((r) => {
                  const v = ch.totals[r.offer.id] ?? 0
                  const dev = ch.median ? v / ch.median - 1 : null
                  return (
                    <td
                      key={r.offer.id}
                      {...bind(
                        <div>
                          <p className="mb-1 font-semibold">
                            {r.label}, {ch.label}
                          </p>
                          <p>
                            <strong className="num">{fmtEur(v)}</strong>, {fmtPctSigned(dev)} par rapport à la médiane
                          </p>
                        </div>,
                      )}
                      className="num border-l-2 border-sheet px-3 py-2 text-right outline-none"
                      style={{ background: divergingColor(dev) }}
                    >
                      {fmtEur(v)}
                    </td>
                  )
                })}
                <td className="num px-3 py-2 text-right text-ink-2">{fmtEur(ch.median)}</td>
              </tr>
            ))}
            <tr className="bg-paper/60 font-semibold">
              <th scope="row" className="sticky left-0 z-10 bg-paper px-4 py-2 text-left sm:px-5">
                Base comparée
              </th>
              {cols.map((r) => (
                <td key={r.offer.id} className="num px-3 py-2 text-right">
                  {fmtEur(r.declared + r.fill)}
                </td>
              ))}
              <td className="num px-3 py-2 text-right text-ink-2">—</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 text-[0.7812rem] text-ink-2 sm:px-5" aria-label="Légende des écarts">
        <span>Écart à la médiane</span>
        {DIVERGING.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1">
            <span className="h-3 w-4 rounded-[2px] border border-line" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
        {c.settings.fillMode !== 'none' && <span className="text-ink-3">Montants remis à niveau, avant remise.</span>}
      </div>
      {node}
    </div>
  )
}

// ————————————————————————— Ligne à ligne —————————————————————————

type LineFilter = 'all' | 'anomalies' | 'missing'

function LineTable({ a, c, colorOf }: { a: Analysis; c: Consultation; colorOf: (n: string) => string }) {
  const [filter, setFilter] = useState<LineFilter>('all')
  const [showAmounts, setShowAmounts] = useState(false)
  const cols = a.ranked
  const order = cols.map((r) => a.offers.indexOf(r))
  const byId = new Map(a.lines.map((l) => [l.item.id, l]))
  const keep = (l: LineStat) =>
    filter === 'all' ||
    (filter === 'anomalies' && l.cells.some((x) => x.flag === 'high' || x.flag === 'low')) ||
    (filter === 'missing' && l.cells.some((x) => x.flag === 'missing'))
  const counts = {
    anomalies: a.lines.filter((l) => l.cells.some((x) => x.flag === 'high' || x.flag === 'low')).length,
    missing: a.lines.filter((l) => l.cells.some((x) => x.flag === 'missing')).length,
  }

  // Lignes + chapitres (on masque les chapitres vides après filtrage)
  const rows: ({ kind: 'chapter'; label: string; id: string } | { kind: 'line'; l: LineStat })[] = []
  for (const it of c.items) {
    if (it.kind === 'chapter') rows.push({ kind: 'chapter', label: [it.ref, it.label].filter(Boolean).join(' '), id: it.id })
    else {
      const l = byId.get(it.id)
      if (l && keep(l)) rows.push({ kind: 'line', l })
    }
  }
  const visible = rows.filter((r, i) => r.kind === 'line' || rows[i + 1]?.kind === 'line')

  return (
    <div className="border-t border-line">
      <div className="no-print flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
        <Segmented<LineFilter>
          size="sm"
          label="Filtrer les lignes"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'Toutes' },
            { value: 'anomalies', label: `Prix anormaux (${counts.anomalies})` },
            { value: 'missing', label: `Non chiffrées (${counts.missing})` },
          ]}
        />
        <Toggle checked={showAmounts} onChange={setShowAmounts} label="Montants au lieu des PU" />
      </div>
      <div className="scroll-x max-h-[70vh] overflow-y-auto border-t border-line-2">
        <table className="w-full min-w-[720px] border-collapse text-[0.875rem]">
          <thead className="sticky top-0 z-20">
            <tr className="border-b border-line bg-paper text-[0.8125rem] text-ink-2">
              <th className="sticky left-0 z-20 min-w-[220px] bg-paper px-4 py-2 text-left font-normal sm:px-5">Désignation</th>
              <th className="px-2 py-2 text-right font-normal">Qté</th>
              <th className="px-3 py-2 text-right font-normal">{showAmounts ? 'Montant médian' : 'PU médian'}</th>
              {cols.map((r) => (
                <th key={r.offer.id} className="min-w-[120px] px-3 py-2 text-right font-normal">
                  <CompanyHead r={r} color={colorOf(r.offer.company)} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={3 + cols.length} className="px-5 py-6 text-ink-2">
                  Aucune ligne dans ce filtre.
                </td>
              </tr>
            )}
            {visible.map((row) =>
              row.kind === 'chapter' ? (
                <tr key={row.id} className="bg-paper/70">
                  <th colSpan={3 + cols.length} scope="rowgroup" className="sticky left-0 px-4 py-1.5 text-left font-title text-[1rem] font-semibold sm:px-5">
                    {row.label}
                  </th>
                </tr>
              ) : (
                <LineRow key={row.l.item.id} l={row.l} order={order} showAmounts={showAmounts} />
              ),
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function LineRow({ l, order, showAmounts }: { l: LineStat; order: number[]; showAmounts: boolean }) {
  const q = qtyOf(l.item)
  return (
    <tr className="border-b border-line-2 hover:bg-paper/40">
      <th scope="row" className="sticky left-0 z-10 max-w-[320px] bg-sheet px-4 py-1.5 text-left font-normal sm:px-5">
        <span className="line-clamp-2 leading-snug">
          <span className="num mr-1.5 text-ink-3">{l.item.ref}</span>
          {l.item.label}
          {l.item.scope === 'option' && <span className="ml-1.5 rounded-[3px] bg-plan-soft px-1 text-[0.6875rem] font-semibold text-plan-dark">PSE</span>}
        </span>
      </th>
      <td className="num px-2 py-1.5 text-right whitespace-nowrap text-ink-2">
        {fmtNum(l.item.qty)} <span className="text-ink-3">{l.item.unit}</span>
      </td>
      <td className="num px-3 py-1.5 text-right whitespace-nowrap text-ink-2">
        {l.median == null ? '—' : showAmounts ? fmtEur(l.median * q) : fmtNum(l.median)}
      </td>
      {order.map((i) => {
        const cell = l.cells[i]
        const strong = cell.flag === 'high' || cell.flag === 'low'
        return (
          <td key={cell.offerId} className="num px-3 py-1.5 text-right whitespace-nowrap">
            {cell.flag === 'missing' ? (
              <span className="text-[0.8125rem] text-warn italic">non chiffré</span>
            ) : cell.flag === 'included' ? (
              <span className="text-[0.8125rem] text-good italic">inclus</span>
            ) : (
              <span className="inline-flex flex-col items-end leading-tight">
                <span className={cx(cell.isMin && 'marker font-semibold')}>
                  {showAmounts ? fmtEur(cell.amount) : fmtNum(cell.price as number)}
                </span>
                {strong && (
                  <span className={cx('text-[0.7188rem] font-medium', cell.flag === 'high' ? 'text-bad' : 'text-plan-dark')}>
                    {cell.flag === 'high' ? '▲' : '▼'} {fmtPctSigned(cell.deviation)}
                  </span>
                )}
              </span>
            )}
          </td>
        )
      })}
    </tr>
  )
}
