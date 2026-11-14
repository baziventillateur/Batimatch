import { useMemo, type ReactNode } from 'react'
import type { Analysis, CompanyHistory } from '../lib/calc'
import { fmtEur, fmtEurCompact, fmtPct, fmtPctSigned } from '../lib/format'
import { useTip, cx } from './ui'

const S1 = 'var(--color-s1)'
const S2 = 'var(--color-s2)'
const S3 = 'var(--color-s3)'

function LegendKey({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-ink-2">
      <span className="h-2.5 w-3.5 rounded-[2px]" style={{ background: color }} />
      {children}
    </span>
  )
}

// ————————————————————————— Classement des offres —————————————————————————

/**
 * Barres horizontales partant de zéro, segmentées :
 * base chiffrée nette | remise à niveau des lignes non chiffrées | PSE, variantes et options retenues.
 * Le trait vertical marque le budget.
 */
export function RankingChart({ a, awardedId }: { a: Analysis; awardedId: string | null }) {
  const { bind, node } = useTip()
  const max = Math.max(a.budget ?? 0, ...a.ranked.map((r) => r.total)) * 1.04 || 1
  const pos = (v: number) => `${(Math.max(0, v) / max) * 100}%`
  const hasFill = a.ranked.some((r) => r.fill > 0)
  const hasExtra = a.ranked.some((r) => r.pse + r.extras !== 0)

  return (
    <figure className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-x-4 gap-y-1" aria-hidden={!hasFill && !hasExtra}>
        <LegendKey color={S1}>Base chiffrée nette</LegendKey>
        {hasFill && <LegendKey color={S2}>Lignes non chiffrées, remises à niveau</LegendKey>}
        {hasExtra && <LegendKey color={S3}>PSE, variantes et options retenues</LegendKey>}
      </div>
      <div>
        <ol className="flex flex-col gap-3.5">
          {a.ranked.map((r) => {
            const comp = r.pse + r.extras
            const base = r.baseComparable - r.fill + Math.min(0, comp)
            const isBest = r.rank === 1
            const awarded = awardedId === r.offer.id
            return (
              <li key={r.offer.id} className="grid gap-1">
                <div className="flex items-baseline justify-between gap-3 text-[14.5px]">
                  <span className={cx('min-w-0 truncate', isBest && 'font-semibold')}>
                    <span className="num mr-2 text-ink-3">{r.rank}</span>
                    {r.label}
                    {awarded && <span className="ml-2 text-[12.5px] font-semibold text-good">Retenue</span>}
                  </span>
                  <span className="flex shrink-0 items-baseline gap-2">
                    {!isBest && <span className="num text-[13px] text-ink-3">{fmtPctSigned(r.vsBest)}</span>}
                    <span className={cx('num font-semibold', isBest && 'marker')}>{fmtEur(r.total)}</span>
                  </span>
                </div>
                <div className="relative flex h-3.5 gap-[2px] rounded-[4px] bg-line-2/60">
                  {a.budget && (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute -top-1 -bottom-1 z-10 w-[2px] -translate-x-1/2 bg-ink"
                      style={{ left: pos(a.budget) }}
                    />
                  )}
                  <span
                    {...bind(<TipRows title={r.label} rows={[['Base chiffrée nette', base]]} />)}
                    className="h-full rounded-l-[4px] outline-none first:rounded-l-[4px] last:rounded-r-[4px]"
                    style={{ width: pos(base), background: S1, opacity: isBest ? 1 : 0.78 }}
                  />
                  {r.fill > 0 && (
                    <span
                      {...bind(<TipRows title={r.label} rows={[[`Remise à niveau (${r.missingCount} ligne${r.missingCount > 1 ? 's' : ''})`, r.fill]]} />)}
                      className="h-full outline-none last:rounded-r-[4px]"
                      style={{ width: pos(r.fill), background: S2 }}
                    />
                  )}
                  {comp > 0 && (
                    <span
                      {...bind(<TipRows title={r.label} rows={[['PSE retenues', r.pse], ['Variantes et options', r.extras]]} />)}
                      className="h-full rounded-r-[4px] outline-none"
                      style={{ width: pos(comp), background: S3 }}
                    />
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      </div>
      {a.budget && (
        <figcaption className="flex items-center gap-2 text-[13px] text-ink-2">
          <span className="h-3.5 w-[2px] bg-ink" aria-hidden="true" /> Budget objectif : <span className="num">{fmtEur(a.budget)}</span>
        </figcaption>
      )}
      {node}
    </figure>
  )
}

function TipRows({ title, rows }: { title: string; rows: [string, number][] }) {
  return (
    <div>
      <p className="mb-1 font-semibold">{title}</p>
      {rows.map(([l, v]) => (
        <p key={l} className="flex justify-between gap-4">
          <span className="text-white/75">{l}</span>
          <strong className="num">{fmtEur(v)}</strong>
        </p>
      ))}
    </div>
  )
}

// ————————————————————————— Postes qui pèsent (Pareto) —————————————————————————

export function ParetoList({ a, limit = 10 }: { a: Analysis; limit?: number }) {
  const { bind, node } = useTip()
  const rows = a.pareto.slice(0, limit)
  const maxShare = rows[0]?.share ?? 1
  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col">
        {rows.map((p, i) => (
          <li
            key={p.item.id}
            {...bind(
              <div>
                <p className="mb-1 font-semibold">{[p.item.ref, p.item.label].filter(Boolean).join(' ')}</p>
                <p>
                  Montant médian <strong className="num">{fmtEur(p.amount)}</strong>
                </p>
                <p>
                  Cumul <strong className="num">{fmtPct(p.cumulative)}</strong> du lot
                </p>
              </div>,
            )}
            className={cx(
              'grid grid-cols-[minmax(0,1fr)_minmax(80px,38%)_3.25rem] items-center gap-3 border-b border-line-2 py-2 outline-none last:border-0 focus-visible:bg-paper',
              i < a.paretoCount80 ? '' : 'text-ink-2',
            )}
          >
            <span className="min-w-0 truncate text-[14px]">
              <span className="num mr-1.5 text-ink-3">{p.item.ref}</span>
              {p.item.label}
            </span>
            <span className="h-2.5 rounded-r-[4px] bg-line-2/60">
              <span
                className="block h-full rounded-r-[4px]"
                style={{ width: `${(p.share / maxShare) * 100}%`, background: S1, opacity: i < a.paretoCount80 ? 1 : 0.45 }}
              />
            </span>
            <span className="num text-right text-[14px]">{fmtPct(p.share)}</span>
          </li>
        ))}
      </ol>
      {node}
    </div>
  )
}

// ————————————————————————— Évolution des versions —————————————————————————

export function VersionChart({ histories, colorOf }: { histories: CompanyHistory[]; colorOf: (company: string) => string }) {
  const { bind, node } = useTip()
  const W = 640
  const H = 240
  const pad = { l: 64, r: 150, t: 16, b: 34 }
  const maxV = Math.max(...histories.flatMap((h) => h.points.map((p) => p.version)))
  const vals = histories.flatMap((h) => h.points.map((p) => p.total))
  const lo = Math.min(...vals)
  const hi = Math.max(...vals)
  const span = hi - lo || hi * 0.1 || 1
  const y0 = lo - span * 0.25
  const y1 = hi + span * 0.25
  const x = (v: number) => pad.l + ((v - 1) / Math.max(1, maxV - 1)) * (W - pad.l - pad.r)
  const y = (t: number) => pad.t + (1 - (t - y0) / (y1 - y0)) * (H - pad.t - pad.b)
  const ticks = useMemo(() => {
    const n = 4
    return Array.from({ length: n + 1 }, (_, i) => y0 + ((y1 - y0) * i) / n)
  }, [y0, y1])

  return (
    <figure className="flex flex-col gap-2">
      {histories.length > 1 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {histories.map((h) => (
            <LegendKey key={h.company} color={colorOf(h.company)}>
              {h.company}
            </LegendKey>
          ))}
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Évolution du montant des offres selon les versions">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--color-line-2)" strokeWidth={1} />
            <text x={pad.l - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" className="num fill-ink-3 text-[12px]">
              {fmtEurCompact(t)}
            </text>
          </g>
        ))}
        {Array.from({ length: maxV }, (_, i) => i + 1).map((v) => (
          <text key={v} x={x(v)} y={H - 10} textAnchor="middle" className="num fill-ink-2 text-[13px]">
            V{v}
          </text>
        ))}
        {histories.map((h) => {
          const color = colorOf(h.company)
          const last = h.points[h.points.length - 1]
          return (
            <g key={h.company}>
              <polyline
                fill="none"
                stroke={color}
                strokeWidth={2}
                strokeLinejoin="round"
                points={h.points.map((p) => `${x(p.version)},${y(p.total)}`).join(' ')}
              />
              {h.points.map((p) => (
                <circle
                  key={p.offerId}
                  {...bind(
                    <div>
                      <p className="mb-1 font-semibold">
                        {h.company} V{p.version}
                      </p>
                      <p>
                        <strong className="num">{fmtEur(p.total)}</strong> base nette
                      </p>
                    </div>,
                  )}
                  cx={x(p.version)}
                  cy={y(p.total)}
                  r={5}
                  fill={color}
                  stroke="white"
                  strokeWidth={2}
                  className="cursor-default outline-none"
                />
              ))}
              <text x={x(last.version) + 12} y={y(last.total)} dominantBaseline="middle" className="text-[12.5px]">
                <tspan className="fill-ink font-semibold">{h.company.length > 18 ? h.company.slice(0, 17) + '…' : h.company}</tspan>
                <tspan x={x(last.version) + 12} dy="1.25em" className="num fill-ink-2">
                  {h.gain >= 0 ? '−' : '+'}
                  {fmtEurCompact(Math.abs(h.gain))} ({fmtPct(Math.abs(h.gainPct ?? 0))})
                </tspan>
              </text>
            </g>
          )
        })}
      </svg>
      {node}
    </figure>
  )
}
