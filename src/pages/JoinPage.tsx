import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, errorMessage } from '../data'
import { pendingCode, useAuth } from '../data/auth'
import { Button, EmptyState, Loading } from '../components/ui'
import AuthPage from './AuthPage'

/** Lien d'invitation : …/#/rejoindre/K7M4QX */
export default function JoinPage() {
  const { code = '' } = useParams()
  const { userId, profile } = useAuth()
  const nav = useNavigate()
  const [error, setError] = useState<string | null>(null)

  if (!userId) pendingCode.set(code)

  useEffect(() => {
    if (!userId || !profile || profile.role !== 'company') return
    let alive = true
    api
      .joinProject(code)
      .then((pid) => {
        pendingCode.clear()
        if (alive) nav(`/p/${pid}`, { replace: true })
      })
      .catch((e) => alive && setError(errorMessage(e)))
    return () => {
      alive = false
    }
  }, [userId, profile, code, nav])

  if (!userId) return <AuthPage />
  if (profile?.role === 'buyer') {
    return (
      <EmptyState title="Lien réservé aux entreprises" action={<Button onClick={() => nav('/')}>Revenir à mes projets</Button>}>
        Ce lien permet aux entreprises de rejoindre un projet. Vous êtes connecté avec un compte acheteur.
      </EmptyState>
    )
  }
  if (error) {
    return (
      <EmptyState title="Impossible de rejoindre ce projet" action={<Button onClick={() => nav('/')}>Saisir un autre code</Button>}>
        {error}
      </EmptyState>
    )
  }
  return <Loading label="Accès au projet" />
}
