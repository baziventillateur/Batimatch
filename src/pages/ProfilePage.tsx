import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronLeft, ImageUp, Trash2 } from 'lucide-react'
import { api, errorMessage } from '../data'
import { useAuth } from '../data/auth'
import { toProfile } from '../data/rows'
import { resizeImage } from '../lib/image'
import { Button, CompanyLogo, Field, Spinner } from '../components/ui'

export default function ProfilePage() {
  const { profile, setProfile } = useAuth()
  const [form, setForm] = useState(() => ({
    firstName: profile?.firstName ?? '',
    lastName: profile?.lastName ?? '',
    companyName: profile?.companyName ?? '',
    phone: profile?.phone ?? '',
  }))
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  if (!profile) return null

  const save = async (patch: Parameters<typeof api.updateProfile>[1]) => {
    const row = await api.updateProfile(profile.id, patch)
    setProfile(toProfile(row))
  }

  const onLogo = async (file: File) => {
    setUploading(true)
    setError(null)
    try {
      const blob = await resizeImage(file)
      const url = await api.uploadImage(profile.id, `logo-${Date.now()}.webp`, blob)
      await save({ logo_url: url })
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setUploading(false)
    }
  }

  const name = form.companyName || [form.firstName, form.lastName].filter(Boolean).join(' ') || profile.email

  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-5">
      <Link to="/" className="inline-flex items-center gap-1 text-[0.875rem] text-ink-2 hover:text-ink">
        <ChevronLeft size={16} /> Accueil
      </Link>
      <h1 className="font-title text-[2.125rem] leading-none font-bold">Mon profil</h1>
      <p className="text-ink-2">
        {profile.role === 'company'
          ? 'Ces informations accompagnent vos offres : l’acheteur voit votre logo à côté du nom de votre entreprise, et vos coordonnées pour vous joindre.'
          : 'Ces informations sont visibles des entreprises que vous consultez.'}
      </p>

      <section className="panel flex flex-wrap items-center gap-5 p-5">
        <CompanyLogo name={name} url={profile.logoUrl} size={88} />
        <div className="flex flex-col gap-2">
          <p className="font-semibold">Logo de l’entreprise</p>
          <p className="text-[0.8438rem] text-ink-2">PNG, JPG ou WebP. Il est redimensionné automatiquement.</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" icon={uploading ? <Spinner /> : <ImageUp size={15} />} disabled={uploading} onClick={() => fileRef.current?.click()}>
              {profile.logoUrl ? 'Changer le logo' : 'Ajouter un logo'}
            </Button>
            {profile.logoUrl && (
              <Button size="sm" variant="ghost" icon={<Trash2 size={15} />} onClick={() => save({ logo_url: null })}>
                Retirer
              </Button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onLogo(f)
              e.target.value = ''
            }}
          />
        </div>
      </section>

      <form
        className="panel grid gap-4 p-5"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          setError(null)
          try {
            await save({ first_name: form.firstName, last_name: form.lastName, company_name: form.companyName, phone: form.phone })
            setSaved(true)
            setTimeout(() => setSaved(false), 2000)
          } catch (err) {
            setError(errorMessage(err))
          } finally {
            setBusy(false)
          }
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Prénom" htmlFor="p-first">
            <input id="p-first" className="field" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
          </Field>
          <Field label="Nom" htmlFor="p-last">
            <input id="p-last" className="field" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
          </Field>
          <Field label="Entreprise" htmlFor="p-company">
            <input id="p-company" className="field" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
          </Field>
          <Field label="Téléphone de l’entreprise" htmlFor="p-phone">
            <input id="p-phone" type="tel" className="field" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
        </div>
        <Field label="Email" htmlFor="p-email" hint="L’email sert à vous connecter ; il ne se modifie pas ici.">
          <input id="p-email" className="field bg-paper" value={profile.email} readOnly />
        </Field>
        {error && <p className="text-[0.875rem] text-bad">{error}</p>}
        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary" disabled={busy}>
            {busy && <Spinner />} Enregistrer
          </Button>
          {saved && (
            <span className="anim-pop inline-flex items-center gap-1 text-[0.875rem] font-medium text-good">
              <Check size={16} /> Enregistré
            </span>
          )}
        </div>
      </form>
    </div>
  )
}
