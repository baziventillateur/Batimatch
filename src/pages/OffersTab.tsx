import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CopyPlus, MoreHorizontal, Plus, Trash2 } from 'lucide-react'
import { useC } from './ConsultationLayout'
import { newOffer, useStore } from '../store'
import { companyKey, declaredBase, filledCount, linesOf } from '../lib/calc'
import { fmtDate, fmtEur, todayIso } from '../lib/format'
import type { Offer } from '../lib/types'
import { Button, Dialog, EmptyState, Field, Menu, MenuItem, Progress, Segmented, cx } from '../components/ui'

export default function OffersTab() {
  const c = useC()
  const nav = useNavigate()
  const removeOffer = useStore((s) => s.removeOffer)
  const newVersion = useStore((s) => s.newVersion)
  const [adding, setAdding] = useState(false)
  const lineCount = linesOf(c.items).length

  const groups = useMemo(() => {
    const map = new Map<string, Offer[]>()
    for (const o of c.offers) {
      const k = companyKey(o.company)
      map.set(k, [...(map.get(k) ?? []), o])
    }
    return [...map.values()].map((list) => [...list].sort((a, b) => b.version - a.version))
  }, [c.offers])

  if (!lineCount) {
    return (
      <EmptyState
        title="Le DPGF est vide"
        action={
          <Link to="../dpgf" relative="path" className="inline-flex h-10 items-center rounded-[5px] bg-plan px-3.5 font-medium text-white hover:bg-plan-dark">
            Saisir le DPGF
          </Link>
        }
      >
        Les offres se saisissent ligne à ligne sur le DPGF : commencez par lui.
      </EmptyState>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-[60ch] text-[14.5px] text-ink-2">
          Une offre par entreprise. Après une négociation, créez une nouvelle version : le comparatif retient la plus récente.
        </p>
        <Button variant="primary" icon={<Plus size={18} />} onClick={() => setAdding(true)}>
          Ajouter une offre
        </Button>
      </div>

      {groups.length === 0 ? (
        <EmptyState title="Aucune offre saisie" action={<Button variant="primary" onClick={() => setAdding(true)}>Saisir la première offre</Button>}>
          Ouvrez l’offre reçue à côté et tapez les prix unitaires, ou collez directement la colonne des prix depuis Excel.
        </EmptyState>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {groups.map((list) => {
            const latest = list[0]
            return (
              <article key={latest.id} className="panel flex flex-col">
                <header className="flex items-start justify-between gap-3 px-4 pt-3.5 pb-2 sm:px-5">
                  <div className="min-w-0">
                    <h3 className="truncate text-[18px] font-semibold">{latest.company || 'Entreprise sans nom'}</h3>
                    <p className="text-[13.5px] text-ink-3">
                      {list.length > 1 ? `${list.length} versions` : 'Offre initiale'}
                      {c.awardedOfferId && list.some((o) => o.id === c.awardedOfferId) && <span className="ml-2 font-medium text-good">Retenue</span>}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    icon={<CopyPlus size={15} />}
                    onClick={() => {
                      const id = newVersion(c.id, latest.id)
                      if (id) nav(id)
                    }}
                  >
                    Nouvelle version
                  </Button>
                </header>
                <ul className="flex flex-col">
                  {list.map((o) => {
                    const { filled, total } = filledCount(o, c.items)
                    const declared = declaredBase(o, c.items) * (1 - (o.discountPct || 0) / 100)
                    return (
                      <li key={o.id} className="flex items-center gap-2 border-t border-line-2 pr-2 pl-4 sm:pl-5">
                        <Link to={o.id} className="grid min-w-0 flex-1 grid-cols-[2.75rem_1fr_auto] items-center gap-3 py-3">
                          <span className={cx('num rounded-[4px] border px-1.5 py-0.5 text-center text-[13px] font-semibold', o === latest ? 'border-ink text-ink' : 'border-line text-ink-3')}>
                            V{o.version}
                          </span>
                          <span className="min-w-0">
                            <span className="num block font-semibold">{declared ? fmtEur(declared) : 'À chiffrer'}</span>
                            <span className="block text-[12.5px] text-ink-3">Reçue le {fmtDate(o.receivedAt)}</span>
                          </span>
                          <span className="w-24 sm:w-32">
                            <span className="num mb-1 block text-right text-[12.5px] text-ink-3">
                              {filled}/{total} lignes
                            </span>
                            <Progress value={total ? filled / total : 0} />
                          </span>
                        </Link>
                        <Menu label={`Actions sur ${o.company} V${o.version}`} icon={<MoreHorizontal size={17} />}>
                          {(close) => (
                            <MenuItem
                              icon={<Trash2 />}
                              danger
                              onClick={() => {
                                close()
                                if (confirm(`Supprimer l’offre ${o.company} V${o.version} ?`)) removeOffer(c.id, o.id)
                              }}
                            >
                              Supprimer cette version
                            </MenuItem>
                          )}
                        </Menu>
                      </li>
                    )
                  })}
                </ul>
              </article>
            )
          })}
        </div>
      )}

      {groups.length >= 2 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-plan/25 bg-plan-soft/60 px-4 py-3">
          <p className="text-[14.5px]">{groups.length} entreprises saisies : le comparatif est prêt.</p>
          <Link to="../comparatif" relative="path" className="inline-flex h-9 items-center rounded-[5px] bg-plan px-3.5 font-medium text-white hover:bg-plan-dark">
            Voir le comparatif
          </Link>
        </div>
      )}

      <AddOfferDialog open={adding} onClose={() => setAdding(false)} />
    </div>
  )
}

function AddOfferDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Nouvelle offre">
      {open && <AddOfferForm onClose={onClose} />}
    </Dialog>
  )
}

function AddOfferForm({ onClose }: { onClose: () => void }) {
  const c = useC()
  const nav = useNavigate()
  const addOffer = useStore((s) => s.addOffer)
  const newVersion = useStore((s) => s.newVersion)
  const [company, setCompany] = useState('')
  const [receivedAt, setReceivedAt] = useState(todayIso())
  const [copy, setCopy] = useState<'copy' | 'blank'>('copy')
  const companies = useMemo(() => [...new Map(c.offers.map((o) => [companyKey(o.company), o.company])).values()], [c.offers])
  const existing = useMemo(() => {
    const k = companyKey(company)
    return k ? c.offers.filter((o) => companyKey(o.company) === k).sort((a, b) => b.version - a.version)[0] : undefined
  }, [company, c.offers])

  const submit = () => {
    const name = company.trim()
    if (!name) return
    let id: string | null
    if (existing && copy === 'copy') {
      id = newVersion(c.id, existing.id)
    } else {
      const o = newOffer({ company: existing?.company ?? name, version: existing ? existing.version + 1 : 1, receivedAt })
      addOffer(c.id, o)
      id = o.id
    }
    onClose()
    if (id) nav(id)
  }

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <Field label="Entreprise" htmlFor="o-company">
        <input
          id="o-company"
          className="field"
          list="companies"
          autoFocus
          required
          placeholder="Raison sociale"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
        />
        <datalist id="companies">
          {companies.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </Field>
      {existing ? (
        <div className="grid gap-2 rounded-md border border-line bg-paper p-3">
          <p className="text-[14px]">
            {existing.company} a déjà une offre <span className="num font-semibold">V{existing.version}</span>. Celle-ci deviendra la{' '}
            <span className="num font-semibold">V{existing.version + 1}</span>.
          </p>
          <Segmented
            size="sm"
            label="Contenu de la nouvelle version"
            value={copy}
            onChange={setCopy}
            options={[
              { value: 'copy', label: `Reprendre les prix de la V${existing.version}` },
              { value: 'blank', label: 'Partir d’une grille vide' },
            ]}
          />
        </div>
      ) : (
        <Field label="Reçue le" htmlFor="o-date">
          <input id="o-date" type="date" className="field" value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} />
        </Field>
      )}
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onClose}>
          Annuler
        </Button>
        <Button variant="primary" type="submit" disabled={!company.trim()}>
          Saisir les prix
        </Button>
      </div>
    </form>
  )
}
