import { useState } from 'react'
import type { Consultation } from '../lib/types'
import { Button, Dialog, Field, NumberInput } from './ui'
import { fmtEur } from '../lib/format'

type Draft = Pick<Consultation, 'name' | 'affaire' | 'lot' | 'dueDate' | 'budget' | 'description'>

export function ConsultationForm({
  open,
  onClose,
  initial,
  onSubmit,
  title,
  submitLabel,
}: {
  open: boolean
  onClose: () => void
  initial?: Partial<Draft>
  onSubmit: (d: Draft) => void
  title: string
  submitLabel: string
}) {
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      {open && <FormBody initial={initial} onSubmit={onSubmit} onClose={onClose} submitLabel={submitLabel} />}
    </Dialog>
  )
}

function FormBody({
  initial,
  onSubmit,
  onClose,
  submitLabel,
}: {
  initial?: Partial<Draft>
  onSubmit: (d: Draft) => void
  onClose: () => void
  submitLabel: string
}) {
  const [d, setD] = useState<Draft>({
    name: initial?.name ?? '',
    affaire: initial?.affaire ?? '',
    lot: initial?.lot ?? '',
    dueDate: initial?.dueDate ?? null,
    budget: initial?.budget ?? null,
    description: initial?.description ?? '',
  })
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }))
  const valid = d.name.trim().length > 0
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) onSubmit({ ...d, name: d.name.trim() })
      }}
    >
      <Field label="Nom de la consultation" htmlFor="c-name">
        <input
          id="c-name"
          className="field"
          autoFocus
          required
          placeholder="Ex. Lot 04 Gros œuvre"
          value={d.name}
          onChange={(e) => set({ name: e.target.value })}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Affaire" htmlFor="c-affaire">
          <input id="c-affaire" className="field" placeholder="Ex. 24-017 – Paris 17e" value={d.affaire} onChange={(e) => set({ affaire: e.target.value })} />
        </Field>
        <Field label="Lot" htmlFor="c-lot">
          <input id="c-lot" className="field" placeholder="Ex. Lot 04 – GO" value={d.lot} onChange={(e) => set({ lot: e.target.value })} />
        </Field>
        <Field label="Remise des offres" htmlFor="c-due">
          <input id="c-due" type="date" className="field" value={d.dueDate ?? ''} onChange={(e) => set({ dueDate: e.target.value || null })} />
        </Field>
        <Field label="Budget objectif HT" htmlFor="c-budget" hint="Sert de référence dans le comparatif.">
          <NumberInput id="c-budget" value={d.budget} onCommit={(v) => set({ budget: v })} suffix="€" format={(v) => (v == null ? '' : fmtEur(v).replace(/\s?€/, ''))} />
        </Field>
      </div>
      <Field label="Notes" htmlFor="c-desc">
        <textarea id="c-desc" rows={2} className="field resize-y" value={d.description} onChange={(e) => set({ description: e.target.value })} />
      </Field>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onClose}>
          Annuler
        </Button>
        <Button variant="primary" type="submit" disabled={!valid}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
