import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CopyPlus, Hourglass, MoreHorizontal, Plus, Trash2 } from 'lucide-react'
import { useC } from './ConsultationLayout'
import { newOffer, useStore } from '../store'
import { api } from '../data'
import type { ProjectBundle } from '../data/backend'
import { companyKey, declaredBase, filledCount, linesOf } from '../lib/calc'
import { fmtDate, fmtEur, todayIso } from '../lib/format'
import type { Offer } from '../lib/types'
import { Button, CompanyLogo, Dialog, EmptyState, Field, Menu, MenuItem, Progress, Segmented, cx } from '../components/ui'

export default function OffersTab() {
  const c = useC()
  const nav = useNavigate()
  const removeOffer = useStore((s) => s.removeOffer)
  const newVersion = useStore((s) => s.newVersion)
  const [adding, setAdding] = useState(false)
  const [members, setMembers] = useState<ProjectBundle['members']>([])
  const lineCount = linesOf(c.items).length

  useEffect(() => {
    api
      .getProject(c.projectId)
      .then((b) => setMembers(b.members))
      .catch(() => {})
  }, [c.projectId])

  const groups = useMemo(() => {
    const map = new Map<string, Offer[]>()
    for (const o of c.offers) {
      const k = companyKey(o.company)
      map.set(k, [...(map.get(k) ?? []), o])
    }
    return [...map.values()].map((list) => [...list].sort((a, b) => b.version - a.version))
  }, [c.offers])
  // Entreprises inscrites au projet qui n'ont pas (encore) envoyé d'offre sur ce lot
  const waiting = members.filter((m) => !c.offers.some((o) => o.companyId === m.user_id))

  if (!lineCount) {
    return (
      <EmptyState
        title="La DPGF est vide"
        action={
          <Link to="../dpgf" relative="path" className="inline-flex h-10 items-center rounded-[5px] bg-plan px-3.5 font-medium text-sheet hover:bg-plan-dark">
            Saisir la DPGF
          </Link>
        }
      >
        Les entreprises répondent ligne à ligne sur la DPGF : commencez par elle.
      </EmptyState>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-[64ch] text-[0.9062rem] text-ink-2">
          Les offres envoyées par les entreprises apparaissent ici automatiquement. Vous pouvez aussi saisir une offre reçue par mail, ou une version négociée.
        </p>
        <Button variant="primary" icon={<Plus size={18} />} onClick={() => setAdding(true)}>
          Saisir une offre
        </Button>
      </div>

      {groups.length === 0 ? (
        <EmptyState title="Aucune offre pour l’instant">
          Partagez le code du projet aux entreprises : leurs offres arriveront ici dès qu’elles les envoient. Rien ne leur est visible avant la date de rendu, à part leur
          propre offre.
        </EmptyState>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {groups.map((list) => {
            const latest = list[0]
            return (
              <article key={latest.id} className="panel anim-pop flex flex-col">
                <header className="flex items-start justify-between gap-3 px-4 pt-3.5 pb-2 sm:px-5">
                  <div className="flex min-w-0 items-center gap-3">
                    <CompanyLogo name={latest.company || '?'} url={latest.logoUrl} size={44} />
                    <div className="min-w-0">
                      <h3 className="truncate text-[1.125rem] font-semibold">{latest.company || 'Entreprise sans nom'}</h3>
                      <p className="truncate text-[0.8125rem] text-ink-3">
                        {[latest.contact.firstName, latest.contact.lastName].filter(Boolean).join(' ') || 'Contact non renseigné'}
                        {c.awardedOfferId && list.some((o) => o.id === c.awardedOfferId) && <span className="ml-2 font-semibold text-good">Retenue</span>}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    icon={<CopyPlus size={15} />}
                    title="Saisir une version négociée"
                    onClick={() => {
                      const id = newVersion(c.id, latest.id)
                      if (id) nav(id)
                    }}
                  >
                    <span className="hidden sm:inline">Version négociée</span>
                  </Button>
                </header>
                <ul className="flex flex-col">
                  {list.map((o) => {
                    const { filled, total } = filledCount(o, c.items)
                    const declared = declaredBase(o, c.items) * (1 - (o.discountPct || 0) / 100)
                    return (
                      <li key={o.id} className="flex items-center gap-2 border-t border-line-2 pr-2 pl-4 sm:pl-5">
                        <Link to={o.id} className="grid min-w-0 flex-1 grid-cols-[2.75rem_1fr_auto] items-center gap-3 py-3">
                          <span className={cx('num rounded-[4px] border px-1.5 py-0.5 text-center text-[0.8125rem] font-semibold', o === latest ? 'border-ink text-ink' : 'border-line text-ink-3')}>V{o.version}</span>
                          <span className="min-w-0">
                            <span className="num block font-semibold">{declared ? fmtEur(declared) : 'À chiffrer'}</span>
                            <span className="block text-[0.7812rem] text-ink-3">
                              {o.source === 'platform' ? `Envoyée en ligne le ${fmtDate((o.submittedAt ?? '').slice(0, 10) || null)}` : `Saisie par vous, reçue le ${fmtDate(o.receivedAt)}`}
                              {o.techNote ? ', notice technique jointe' : ''}
                            </span>
                          </span>
                          <span className="w-24 sm:w-32">
                            <span className="num mb-1 block text-right text-[0.7812rem] text-ink-3">
                              {filled}/{total} lignes
                            </span>
                            <Progress value={total ? filled / total : 0} />
                          </span>
                        </Link>
                        {o.source === 'manual' ? (
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
                        ) : (
                          <span className="w-9" />
                        )}
                      </li>
                    )
                  })}
                </ul>
              </article>
            )
          })}
        </div>
      )}

      {waiting.length > 0 && (
        <section className="panel flex flex-col gap-2 p-4" aria-label="Entreprises en attente">
          <h3 className="flex items-center gap-2 font-semibold">
            <Hourglass size={16} className="text-warn" /> En attente de réponse
          </h3>
          <ul className="flex flex-wrap gap-2">
            {waiting.map((m) => (
              <li key={m.user_id} className="inline-flex items-center gap-2 rounded-full border border-line py-1 pr-3 pl-1 text-[0.875rem]">
                <CompanyLogo name={m.profile?.company_name || '?'} url={m.profile?.logo_url} size={24} />
                {m.profile?.company_name || 'Entreprise'}
              </li>
            ))}
          </ul>
        </section>
      )}

      {groups.length >= 2 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-plan/25 bg-plan-soft/60 px-4 py-3">
          <p className="text-[0.9062rem]">{groups.length} entreprises ont répondu : place à la décision.</p>
          <Link to="../decision" relative="path" className="inline-flex h-9 items-center rounded-[5px] bg-plan px-3.5 font-medium text-sheet hover:bg-plan-dark">
            Aider à décider
          </Link>
        </div>
      )}

      <Dialog open={adding} onClose={() => setAdding(false)} title="Saisir une offre">
        {adding && <AddOfferForm onClose={() => setAdding(false)} />}
      </Dialog>
    </div>
  )
}

function AddOfferForm({ onClose }: { onClose: () => void }) {
  const c = useC()
  const nav = useNavigate()
  const addOffer = useStore((s) => s.addOffer)
  const newVersion = useStore((s) => s.newVersion)
  const [f, setF] = useState({ company: '', firstName: '', lastName: '', email: '', phone: '', receivedAt: todayIso() })
  const [copy, setCopy] = useState<'copy' | 'blank'>('copy')
  const companies = useMemo(() => [...new Map(c.offers.map((o) => [companyKey(o.company), o.company])).values()], [c.offers])
  const existing = useMemo(() => {
    const k = companyKey(f.company)
    return k ? c.offers.filter((o) => companyKey(o.company) === k).sort((a, b) => b.version - a.version)[0] : undefined
  }, [f.company, c.offers])

  const submit = () => {
    const name = f.company.trim()
    if (!name) return
    let id: string | null
    if (existing && copy === 'copy') id = newVersion(c.id, existing.id)
    else {
      const o = newOffer({
        company: existing?.company ?? name,
        version: existing ? existing.version + 1 : 1,
        receivedAt: f.receivedAt,
        contact: existing?.contact ?? { firstName: f.firstName, lastName: f.lastName, email: f.email, phone: f.phone },
        logoUrl: existing?.logoUrl ?? null,
      })
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
        <input id="o-company" className="field" list="companies" autoFocus required placeholder="Raison sociale" value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} />
        <datalist id="companies">
          {companies.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </Field>
      {existing ? (
        <div className="grid gap-2 rounded-md border border-line bg-paper p-3">
          <p className="text-[0.875rem]">
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
              { value: 'blank', label: 'Grille vide' },
            ]}
          />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prénom du contact" htmlFor="o-first">
              <input id="o-first" className="field" value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} />
            </Field>
            <Field label="Nom" htmlFor="o-last">
              <input id="o-last" className="field" value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} />
            </Field>
            <Field label="Email" htmlFor="o-email">
              <input id="o-email" type="email" className="field" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
            </Field>
            <Field label="Téléphone" htmlFor="o-phone">
              <input id="o-phone" type="tel" className="field" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
            </Field>
          </div>
          <Field label="Reçue le" htmlFor="o-date">
            <input id="o-date" type="date" className="field" value={f.receivedAt} onChange={(e) => setF({ ...f, receivedAt: e.target.value })} />
          </Field>
        </>
      )}
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onClose}>
          Annuler
        </Button>
        <Button variant="primary" type="submit" disabled={!f.company.trim()}>
          Saisir les prix
        </Button>
      </div>
    </form>
  )
}
