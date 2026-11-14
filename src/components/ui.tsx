import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type FocusEvent as RFocusEvent,
  type InputHTMLAttributes,
  type PointerEvent as RPointerEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { parseNumber } from '../lib/parse'
import { fmtNum } from '../lib/format'

export const cx = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(' ')

// ————————————————————————— Boutons —————————————————————————

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-plan text-white hover:bg-plan-dark border border-plan-dark/40',
  secondary: 'bg-sheet text-ink border border-line hover:border-ink-3',
  ghost: 'text-ink-2 hover:bg-ink/5 hover:text-ink border border-transparent',
  danger: 'bg-sheet text-bad border border-bad/30 hover:bg-bad-soft',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md'; icon?: ReactNode }) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-[5px] font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-45',
        size === 'sm' ? 'h-8 px-2.5 text-[13.5px]' : 'h-10 px-3.5 text-[15px]',
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  )
}

export function IconButton({
  label,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex size-9 shrink-0 items-center justify-center rounded-[5px] text-ink-2 transition-colors hover:bg-ink/6 hover:text-ink disabled:opacity-35',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

// ————————————————————————— Champs —————————————————————————

/**
 * Sélectionne le contenu d'un champ dès qu'il reçoit le focus, de façon synchrone :
 * la frappe qui suit remplace la valeur (saisie rapide au clavier, Entrée → ligne suivante).
 */
export function useAutoSelect() {
  const ref = useRef<HTMLInputElement>(null)
  const pending = useRef(false)
  const justFocused = useRef(false)
  useLayoutEffect(() => {
    if (pending.current && ref.current && document.activeElement === ref.current) ref.current.select()
    pending.current = false
  })
  return {
    ref,
    request: () => {
      pending.current = true
      justFocused.current = true
      setTimeout(() => (justFocused.current = false), 300)
    },
    // Évite que le relâchement du clic ne désélectionne le texte
    onMouseUp: (e: { preventDefault: () => void }) => {
      if (justFocused.current) {
        e.preventDefault()
        justFocused.current = false
      }
    },
  }
}

export function Field({
  label,
  hint,
  children,
  className,
  htmlFor,
}: {
  label: string
  hint?: ReactNode
  children: ReactNode
  className?: string
  htmlFor?: string
}) {
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-[13.5px] font-medium text-ink-2">
        {label}
      </label>
      {children}
      {hint && <p className="text-[12.5px] leading-snug text-ink-3">{hint}</p>}
    </div>
  )
}

/** Champ numérique : saisie libre (virgule, espaces), valeur propre à la sortie du champ. */
export function NumberInput({
  value,
  onCommit,
  className,
  suffix,
  allowNegative = false,
  format = fmtNum,
  bare = false,
  onKeyDown,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: number | null
  onCommit: (v: number | null) => void
  suffix?: string
  allowNegative?: boolean
  format?: (v: number | null) => string
  bare?: boolean
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const sel = useAutoSelect()
  const display = draft ?? (value == null ? '' : format(value))
  const commit = () => {
    if (draft == null) return
    let v = parseNumber(draft)
    if (v != null && !allowNegative && v < 0) v = Math.abs(v)
    setDraft(null)
    if (v !== value) onCommit(v)
  }
  return (
    <div className="relative">
      <input
        ref={sel.ref}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className={cx(bare ? 'field-bare num' : 'field num', suffix && 'pr-10', className)}
        value={display}
        onFocus={() => {
          setDraft(value == null ? '' : String(value).replace('.', ','))
          sel.request()
        }}
        onMouseUp={sel.onMouseUp}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setDraft(null)
            ;(e.target as HTMLInputElement).blur()
            return
          }
          onKeyDown?.(e)
          if (e.key === 'Enter' && !e.defaultPrevented) (e.target as HTMLInputElement).blur()
        }}
        {...rest}
      />
      {suffix && (
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[13.5px] text-ink-3">
          {suffix}
        </span>
      )}
    </div>
  )
}

// ————————————————————————— Contrôle segmenté —————————————————————————

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  size = 'md',
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: ReactNode }[]
  label: string
  size?: 'sm' | 'md'
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex max-w-full overflow-x-auto rounded-[6px] border border-line bg-paper p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx(
            'rounded-[4px] font-medium whitespace-nowrap transition-colors',
            size === 'sm' ? 'px-2.5 py-1 text-[13px]' : 'px-3 py-1.5 text-[14px]',
            o.value === value ? 'bg-sheet text-ink shadow-[0_1px_2px_rgb(27_42_58/0.12)]' : 'text-ink-2 hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  const id = useId()
  return (
    <label htmlFor={id} className="inline-flex cursor-pointer items-center gap-2.5 text-[14px] select-none">
      <span className="relative inline-flex">
        <input id={id} type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="h-5 w-9 rounded-full bg-line transition-colors peer-checked:bg-plan peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-plan" />
        <span className="absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
      </span>
      {label}
    </label>
  )
}

// ————————————————————————— Dialogue —————————————————————————

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  wide = false,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      className={cx(
        'm-auto max-h-[92dvh] w-[calc(100%-1.5rem)] rounded-lg border border-line bg-sheet p-0 text-ink shadow-2xl',
        wide ? 'max-w-3xl' : 'max-w-lg',
      )}
    >
      {open && (
        <div className="flex max-h-[92dvh] flex-col">
          <header className="flex items-center justify-between gap-4 border-b border-line-2 px-5 py-3.5">
            <h2 className="font-title text-[22px] leading-tight font-semibold">{title}</h2>
            <IconButton label="Fermer" onClick={onClose}>
              <X size={18} />
            </IconButton>
          </header>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-line-2 px-5 py-3">{footer}</footer>}
        </div>
      )}
    </dialog>
  )
}

// ————————————————————————— Info-bulle de graphique —————————————————————————

interface TipState {
  x: number
  y: number
  content: ReactNode
  sticky: boolean
}

/** Info-bulle au survol (souris), au toucher (mobile) et au focus (clavier). */
export function useTip() {
  const [tip, setTip] = useState<TipState | null>(null)
  useEffect(() => {
    if (!tip?.sticky) return
    const close = () => setTip(null)
    const t = setTimeout(() => document.addEventListener('pointerdown', close, { once: true }), 0)
    return () => {
      clearTimeout(t)
      document.removeEventListener('pointerdown', close)
    }
  }, [tip?.sticky])
  const bind = (content: ReactNode) => ({
    tabIndex: 0,
    onPointerEnter: (e: RPointerEvent) => setTip({ x: e.clientX, y: e.clientY, content, sticky: e.pointerType === 'touch' }),
    onPointerMove: (e: RPointerEvent) =>
      e.pointerType !== 'touch' && setTip((t) => (t ? { ...t, x: e.clientX, y: e.clientY } : t)),
    onPointerLeave: (e: RPointerEvent) => e.pointerType !== 'touch' && setTip(null),
    onFocus: (e: RFocusEvent) => {
      const r = (e.currentTarget as Element).getBoundingClientRect()
      setTip({ x: r.left + r.width / 2, y: r.top, content, sticky: false })
    },
    onBlur: () => setTip(null),
  })
  const node =
    tip &&
    createPortal(
      <div
        className="tip"
        role="tooltip"
        style={{
          left: Math.min(tip.x + 14, window.innerWidth - 290),
          top: tip.y + 16 + 120 > window.innerHeight ? tip.y - 100 : tip.y + 16,
        }}
      >
        {tip.content}
      </div>,
      document.body,
    )
  return { bind, node }
}

// ————————————————————————— Divers —————————————————————————

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="panel flex flex-col items-start gap-3 px-6 py-10 sm:items-center sm:text-center">
      <h3 className="font-title text-[24px] font-semibold">{title}</h3>
      {children && <div className="max-w-[56ch] text-ink-2">{children}</div>}
      {action && <div className="mt-2 flex flex-wrap gap-2">{action}</div>}
    </div>
  )
}

export function Progress({ value, className }: { value: number; className?: string }) {
  const v = Math.max(0, Math.min(1, value))
  return (
    <div
      className={cx('h-1.5 w-full overflow-hidden rounded-full bg-line-2', className)}
      role="progressbar"
      aria-valuenow={Math.round(v * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={cx('h-full rounded-full', v >= 1 ? 'bg-good' : 'bg-plan')} style={{ width: `${v * 100}%` }} />
    </div>
  )
}

export function Menu({ label, icon, children }: { label: string; icon: ReactNode; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  return (
    <div ref={ref} className="relative">
      <IconButton label={label} aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((o) => !o)}>
        {icon}
      </IconButton>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-1 min-w-[220px] rounded-md border border-line bg-sheet py-1 shadow-xl">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}

export function MenuItem({
  onClick,
  icon,
  children,
  danger,
}: {
  onClick: () => void
  icon?: ReactNode
  children: ReactNode
  danger?: boolean
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cx(
        'flex w-full items-center gap-2.5 px-3 py-2 text-left text-[14px] hover:bg-paper',
        danger ? 'text-bad' : 'text-ink',
      )}
    >
      <span className="text-ink-3 [&>svg]:size-4">{icon}</span>
      {children}
    </button>
  )
}

/** Petit indicateur d'écart signé : ▲ +32 % (plus cher) / ▼ −18 % (moins cher) */
export function DeviationChip({ value, strong }: { value: number | null; strong?: boolean }) {
  if (value == null || !isFinite(value)) return null
  const up = value > 0
  const pct = Math.round(Math.abs(value) * 100)
  if (pct === 0) return <span className="num text-[12.5px] text-ink-3">= médiane</span>
  return (
    <span
      className={cx(
        'num inline-flex items-center gap-0.5 rounded-[3px] px-1 text-[12.5px] leading-[1.35] font-medium',
        strong ? (up ? 'bg-bad-soft text-bad' : 'bg-plan-soft text-plan-dark') : 'text-ink-3',
      )}
      title={`${up ? 'Plus cher' : 'Moins cher'} que la médiane des autres offres`}
    >
      {up ? '▲' : '▼'} {up ? '+' : '−'}
      {pct} %
    </span>
  )
}
