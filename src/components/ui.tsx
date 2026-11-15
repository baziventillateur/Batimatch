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
import { ChevronDown, X } from 'lucide-react'
import { parseNumber } from '../lib/parse'
import { fmtNum } from '../lib/format'

export const cx = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(' ')

// ————————————————————————— Boutons —————————————————————————

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-plan text-sheet hover:bg-plan-dark border border-plan-dark/40',
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
        'inline-flex items-center justify-center gap-2 rounded-[5px] font-medium whitespace-nowrap transition-[color,background-color,border-color,transform] duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45',
        size === 'sm' ? 'h-8 px-2.5 text-[0.8438rem]' : 'h-10 px-3.5 text-[0.9375rem]',
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
        'inline-flex size-9 shrink-0 items-center justify-center rounded-[5px] text-ink-2 transition-[color,background-color,transform] duration-150 hover:bg-ink/6 hover:text-ink active:scale-90 disabled:opacity-35',
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
      <label htmlFor={htmlFor} className="text-[0.8438rem] font-medium text-ink-2">
        {label}
      </label>
      {children}
      {hint && <p className="text-[0.7812rem] leading-snug text-ink-3">{hint}</p>}
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
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[0.8438rem] text-ink-3">
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
            size === 'sm' ? 'px-2.5 py-1 text-[0.8125rem]' : 'px-3 py-1.5 text-[0.875rem]',
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
    <label htmlFor={id} className="inline-flex cursor-pointer items-center gap-2.5 text-[0.875rem] select-none">
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
            <h2 className="font-title text-[1.375rem] leading-tight font-semibold">{title}</h2>
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
      <h3 className="font-title text-[1.5rem] font-semibold">{title}</h3>
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
        'flex w-full items-center gap-2.5 px-3 py-2 text-left text-[0.875rem] hover:bg-paper',
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
  if (pct === 0) return <span className="num text-[0.7812rem] text-ink-3">= médiane</span>
  return (
    <span
      className={cx(
        'num inline-flex items-center gap-0.5 rounded-[3px] px-1 text-[0.7812rem] leading-[1.35] font-medium',
        strong ? (up ? 'bg-bad-soft text-bad' : 'bg-plan-soft text-plan-dark') : 'text-ink-3',
      )}
      title={`${up ? 'Plus cher' : 'Moins cher'} que la médiane des autres offres`}
    >
      {up ? '▲' : '▼'} {up ? '+' : '−'}
      {pct} %
    </span>
  )
}

// ————————————————————————— Logo d'entreprise —————————————————————————

const LOGO_TINTS = ['#dbe7f4', '#f9e3d6', '#d9f0e6', '#f6ecc9', '#f3dce6', '#e2e0f6']

/** Logo de l'entreprise, ou ses initiales sur une pastille si aucun logo n'est fourni */
export function CompanyLogo({ name, url, size = 36, className }: { name: string; url?: string | null; size?: number; className?: string }) {
  const [broken, setBroken] = useState(false)
  const initials =
    name
      .replace(/[^\p{L}\p{N}\s&-]/gu, '')
      .split(/[\s&-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('') || '?'
  const tint = LOGO_TINTS[[...name].reduce((s, ch) => s + ch.charCodeAt(0), 0) % LOGO_TINTS.length]
  const style = { width: size, height: size, minWidth: size }
  if (url && !broken) {
    return (
      <span className={cx('inline-flex items-center justify-center overflow-hidden rounded-[6px] border border-line bg-white', className)} style={style}>
        <img src={url} alt={`Logo ${name}`} className="h-full w-full object-contain p-[3px]" onError={() => setBroken(true)} />
      </span>
    )
  }
  return (
    <span
      aria-hidden="true"
      className={cx('inline-flex items-center justify-center rounded-[6px] font-title font-bold text-night/80', className)}
      style={{ ...style, background: tint, fontSize: Math.max(11, size * 0.38) }}
    >
      {initials}
    </span>
  )
}

// ————————————————————————— Nombre animé —————————————————————————

/** Compte jusqu'à la valeur en ~0,7 s (sauf si l'utilisateur préfère réduire les animations) */
export function AnimatedNumber({ value, format, duration = 700 }: { value: number; format: (v: number) => string; duration?: number }) {
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const start = from.current
    if (reduce || start === value) {
      from.current = value
      setShown(value)
      return
    }
    let raf = 0
    const t0 = performance.now()
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / duration)
      const eased = 1 - Math.pow(1 - k, 3)
      setShown(start + (value - start) * eased)
      if (k < 1) raf = requestAnimationFrame(step)
      else from.current = value
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])
  return <>{format(shown)}</>
}

// ————————————————————————— Divers —————————————————————————

export function Spinner({ className }: { className?: string }) {
  return <span className={cx('inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent', className)} aria-hidden="true" />
}

export function Loading({ label = 'Chargement' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-ink-2" role="status">
      <Spinner /> {label}…
    </div>
  )
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-bad/30 bg-bad-soft px-4 py-3 text-[0.9062rem] text-bad" role="alert">
      <span>{message}</span>
      {onRetry && (
        <Button size="sm" onClick={onRetry}>
          Réessayer
        </Button>
      )}
    </div>
  )
}

/** Petit texte de compte à rebours vers la date de rendu */
export function dueLabel(days: number | null): { text: string; tone: 'muted' | 'warn' | 'closed' } {
  if (days == null) return { text: 'sans date limite', tone: 'muted' }
  if (days < 0) return { text: `clôturé depuis ${-days} j`, tone: 'closed' }
  if (days === 0) return { text: 'clôture ce soir', tone: 'warn' }
  if (days === 1) return { text: 'clôture demain', tone: 'warn' }
  return { text: `J−${days}`, tone: days <= 3 ? 'warn' : 'muted' }
}

// ————————————————————————— Descriptif dépliable —————————————————————————

/**
 * Descriptif d'un poste : une ligne tronquée, qui se déplie au clic.
 * Avec onChange, le texte déplié est modifiable ; sinon il est en lecture seule.
 */
export function Descriptif({
  value,
  onChange,
  label = 'Descriptif',
  className,
}: {
  value: string
  onChange?: (v: string) => void
  label?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const area = useRef<HTMLTextAreaElement>(null)
  const prevH = useRef<number | null>(null)
  const editable = !!onChange

  const fit = () => {
    const el = area.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  // Déroulé : on anime la hauteur entre l'état replié et l'état déplié
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    if (open) fit()
    const from = prevH.current
    const to = el.offsetHeight
    prevH.current = to
    if (from == null || from === to || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    el.animate([{ height: `${from}px` }, { height: `${to}px` }], { duration: 200, easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)' })
  }, [open])

  if (!value && !editable) return null

  const toggle = () => {
    prevH.current = box.current?.offsetHeight ?? null
    setOpen((o) => !o)
  }
  const text = 'font-cond text-[0.75rem] leading-[1.35] text-ink-3'

  return (
    <div ref={box} className={cx('min-w-0 overflow-hidden', className)}>
      {open && editable ? (
        <textarea
          ref={area}
          autoFocus
          aria-label={label}
          rows={2}
          placeholder="Décrivez la prestation : matériaux, mise en œuvre, sujétions, localisation…"
          className={cx(text, 'block w-full resize-none rounded-[4px] border border-plan bg-sheet px-1.5 py-1 text-ink-2 placeholder:text-ink-3 focus:outline-none')}
          value={value}
          onChange={(e) => (onChange(e.target.value), fit())}
          onBlur={toggle}
          onKeyDown={(e) => e.key === 'Escape' && e.currentTarget.blur()}
        />
      ) : (
        <button
          type="button"
          aria-expanded={open}
          onClick={toggle}
          className={cx(text, 'flex w-full items-start gap-1 rounded-[4px] px-1.5 py-0.5 text-left hover:text-ink-2')}
        >
          <span className={cx('min-w-0 flex-1', open ? 'whitespace-pre-wrap text-ink-2' : 'truncate', !value && 'italic opacity-70')}>
            {value || 'Ajouter un descriptif'}
          </span>
          {value && <ChevronDown size={13} className={cx('mt-px shrink-0 transition-transform duration-200', open && 'rotate-180')} aria-hidden="true" />}
        </button>
      )}
    </div>
  )
}
