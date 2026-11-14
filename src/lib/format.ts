const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const eur2 = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const num = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 })
const pct1 = new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: 1, minimumFractionDigits: 1 })
const pct0 = new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: 0 })

/** 12 345 € */
export const fmtEur = (v: number | null | undefined) => (v == null || !isFinite(v) ? '—' : eur.format(v))
/** 12 345,67 € */
export const fmtEur2 = (v: number | null | undefined) => (v == null || !isFinite(v) ? '—' : eur2.format(v))
/** 1 234,5 */
export const fmtNum = (v: number | null | undefined) => (v == null || !isFinite(v) ? '—' : num.format(v))
/** 4,2 % */
export const fmtPct = (v: number | null | undefined) => (v == null || !isFinite(v) ? '—' : pct1.format(v))
export const fmtPct0 = (v: number | null | undefined) => (v == null || !isFinite(v) ? '—' : pct0.format(v))
/** +4,2 % / −3,1 % */
export const fmtPctSigned = (v: number | null | undefined) => {
  if (v == null || !isFinite(v)) return '—'
  if (Math.abs(v) < 0.0005) return '0,0 %'
  return (v > 0 ? '+' : '−') + pct1.format(Math.abs(v))
}
/** +12 345 € / −3 000 € */
export const fmtEurSigned = (v: number | null | undefined) => {
  if (v == null || !isFinite(v)) return '—'
  if (Math.abs(v) < 0.5) return '0 €'
  return (v > 0 ? '+' : '−') + eur.format(Math.abs(v))
}

/** Montant compact pour les tuiles : 845 k€, 1,25 M€ */
export const fmtEurCompact = (v: number | null | undefined) => {
  if (v == null || !isFinite(v)) return '—'
  const a = Math.abs(v)
  const sign = v < 0 ? '−' : ''
  if (a >= 1_000_000) return sign + new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(a / 1_000_000) + ' M€'
  if (a >= 10_000) return sign + new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(a / 1000) + ' k€'
  return sign + eur.format(a)
}

export const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return '—'
  const d = new Date(iso + (iso.length === 10 ? 'T12:00:00' : ''))
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** Nombre de jours entre aujourd'hui et une date AAAA-MM-JJ (positif = futur) */
export const daysUntil = (iso: string | null | undefined, today = new Date()) => {
  if (!iso) return null
  const d = new Date(iso + 'T12:00:00')
  if (isNaN(d.getTime())) return null
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12)
  return Math.round((d.getTime() - t.getTime()) / 86_400_000)
}

export const todayIso = () => {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export const versionLabel = (v: number) => `V${v}`
