import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Send, Bell as BellIcon, BellRing, Check, CircleSlash, KeyRound, ShieldCheck, UserPlus, X } from 'lucide-react'
import { api, errorMessage } from '../data'
import type { NotificationRow } from '../data/rows'
import { Button, IconButton, cx } from './ui'

/** Signal envoyé aux pages ouvertes quand une demande est traitée depuis la cloche */
export const REFRESH_EVENT = 'batimatch:refresh'

const ago = (iso: string) => {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (min < 1) return 'à l’instant'
  if (min < 60) return `il y a ${min} min`
  if (min < 60 * 24) return `il y a ${Math.round(min / 60)} h`
  const d = Math.round(min / 1440)
  return d === 1 ? 'hier' : `il y a ${d} j`
}

/** Une demande d'accès reste « à traiter » tant que l'acheteur n'a pas décidé */
const actionable = (n: NotificationRow) => n.kind === 'access_requested' && !n.read_at

export function Bell() {
  const nav = useNavigate()
  const ref = useRef<HTMLDivElement>(null)
  const [items, setItems] = useState<NotificationRow[]>([])
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setItems(await api.listNotifications())
    } catch {
      /* la cloche ne doit jamais gêner l'usage : on réessaiera au prochain passage */
    }
  }, [])

  // Relevé à l'arrivée, au retour sur l'onglet, puis toutes les minutes tant que l'onglet est visible
  useEffect(() => {
    load()
    const onVisible = () => document.visibilityState === 'visible' && load()
    const timer = window.setInterval(onVisible, 60000)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [load])

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

  const unread = items.filter((n) => !n.read_at).length

  const toggle = async () => {
    if (open) {
      // À la fermeture, les alertes d'information vues sont soldées ; les demandes à traiter restent
      const seen = items.filter((n) => !n.read_at && !actionable(n)).map((n) => n.id)
      setOpen(false)
      if (seen.length) {
        const at = new Date().toISOString()
        setItems((xs) => xs.map((n) => (seen.includes(n.id) ? { ...n, read_at: at } : n)))
        api.markNotificationsRead(seen).catch(() => {})
      }
    } else {
      setError(null)
      setOpen(true)
      load()
    }
  }

  const decide = async (n: NotificationRow, status: 'approved' | 'refused') => {
    if (!n.lot_id || !n.actor_id) return
    setBusy(n.id)
    setError(null)
    try {
      await api.decideLotAccess(n.lot_id, n.actor_id, status)
      await load()
      window.dispatchEvent(new Event(REFRESH_EVENT))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  const go = (n: NotificationRow) => {
    const sso = n.kind === 'sso_requested'
    if (!n.project_id && !sso) return
    setOpen(false)
    if (!n.read_at && !actionable(n)) {
      setItems((xs) => xs.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)))
      api.markNotificationsRead([n.id]).catch(() => {})
    }
    if (sso) return nav('/admin')
    nav((n.kind === 'access_approved' || n.kind === 'offer_reminder' || n.kind === 'lot_published') && n.lot_id ? `/p/${n.project_id}/l/${n.lot_id}` : `/p/${n.project_id}`)
  }

  return (
    <div ref={ref} className="relative">
      <IconButton label={unread ? `Notifications, ${unread} non lue${unread > 1 ? 's' : ''}` : 'Notifications'} aria-expanded={open} onClick={toggle}>
        <BellIcon size={18} className={cx(unread > 0 && !open && 'anim-ring')} />
        {unread > 0 && (
          <span key={unread} className="anim-pop num absolute -top-0.5 -right-0.5 grid h-[1.125rem] min-w-[1.125rem] place-items-center rounded-full bg-bad px-1 text-[0.6875rem] leading-none font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </IconButton>
      {open && (
        <div className="anim-fade fixed inset-x-2 top-14 z-40 flex max-h-[min(32rem,calc(100dvh-5rem))] flex-col rounded-lg border border-line bg-sheet shadow-xl sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:mt-1 sm:w-[24rem]">
          <div className="flex items-center justify-between border-b border-line-2 px-3.5 py-2.5">
            <h2 className="font-title text-[1.1875rem] leading-none font-bold">Notifications</h2>
            <IconButton label="Fermer" onClick={toggle}>
              <X size={16} />
            </IconButton>
          </div>
          {error && (
            <p className="bg-bad-soft px-3.5 py-2 text-[0.8125rem] text-bad" role="alert">
              {error}
            </p>
          )}
          {items.length === 0 ? (
            <p className="px-3.5 py-8 text-center text-[0.875rem] text-ink-2">Aucune notification pour l’instant. Les demandes d’accès et les réponses apparaîtront ici.</p>
          ) : (
            <ul className="overflow-y-auto">
              {items.map((n) => (
                <Item key={n.id} n={n} busy={busy === n.id} onOpen={() => go(n)} onDecide={(s) => decide(n, s)} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function Item({ n, busy, onOpen, onDecide }: { n: NotificationRow; busy: boolean; onOpen: () => void; onDecide: (s: 'approved' | 'refused') => void }) {
  const d = n.data
  const lot = d.lot || 'un lot'
  const company = d.company || 'Une entreprise'
  const view = {
    access_requested: { icon: <UserPlus size={16} />, tone: 'bg-warn-soft text-warn', text: <><strong className="font-semibold">{company}</strong> demande l’accès au lot <strong className="font-semibold">{lot}</strong></> },
    access_approved: { icon: <KeyRound size={16} />, tone: 'bg-good-soft text-good', text: <>Votre accès au lot <strong className="font-semibold">{lot}</strong> est accepté. Vous pouvez répondre.</> },
    access_refused: { icon: <X size={16} />, tone: 'bg-bad-soft text-bad', text: <>Votre demande d’accès au lot <strong className="font-semibold">{lot}</strong> n’a pas été retenue.</> },
    sso_requested: { icon: <ShieldCheck size={16} />, tone: 'bg-plan-soft text-plan', text: <><strong className="font-semibold">{company}</strong> demande la connexion SSO</> },
    offer_reminder: { icon: <BellRing size={16} />, tone: 'bg-warn-soft text-warn', text: <><strong className="font-semibold">{d.buyer || 'L’acheteur'}</strong> vous relance : votre offre est attendue pour le lot <strong className="font-semibold">{lot}</strong>{d.due ? <>, avant le {d.due}</> : null}</> },
    lot_published: { icon: <Send size={16} />, tone: 'bg-good-soft text-good', text: <>La DPGF du lot <strong className="font-semibold">{lot}</strong> est en ligne{d.due ? <>, à remettre avant le {d.due}</> : null}. Vous pouvez répondre.</> },
    lot_declined: { icon: <CircleSlash size={16} />, tone: 'bg-paper text-ink-2', text: <><strong className="font-semibold">{company}</strong> ne répondra pas au lot <strong className="font-semibold">{lot}</strong></> },
  }[n.kind]
  return (
    <li className={cx('border-b border-line-2 last:border-b-0', !n.read_at && 'bg-plan-soft/50')}>
      <button type="button" onClick={onOpen} className="flex w-full gap-2.5 px-3.5 pt-2.5 pb-2 text-left hover:bg-paper">
        <span className={cx('mt-0.5 grid size-7 shrink-0 place-items-center rounded-full', view.tone)}>{view.icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[0.875rem] leading-snug">{view.text}</span>
          {n.kind === 'lot_declined' && d.comment && <span className="mt-0.5 block text-[0.8125rem] leading-snug text-ink-2 italic">« {d.comment} »</span>}
          <span className="mt-0.5 block text-[0.75rem] text-ink-3">
            {[d.project, (n.kind === 'access_requested' || n.kind === 'sso_requested') && d.contact, ago(n.created_at)].filter(Boolean).join(', ')}
          </span>
        </span>
        {!n.read_at && <span className="mt-2 size-2 shrink-0 rounded-full bg-plan" aria-label="Non lue" />}
      </button>
      {actionable(n) && (
        <div className="flex justify-end gap-2 px-3.5 pb-2.5">
          <Button size="sm" disabled={busy} onClick={() => onDecide('refused')}>
            <X size={14} /> Refuser
          </Button>
          <Button size="sm" variant="primary" disabled={busy} onClick={() => onDecide('approved')}>
            <Check size={14} /> Accepter
          </Button>
        </div>
      )}
    </li>
  )
}
