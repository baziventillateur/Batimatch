import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from '.'
import { toProfile } from './rows'
import type { Profile } from '../lib/types'

interface AuthState {
  /** undefined = chargement en cours */
  userId: string | null | undefined
  profile: Profile | null
  refreshProfile: () => Promise<void>
  setProfile: (p: Profile) => void
}

const Ctx = createContext<AuthState>({ userId: undefined, profile: null, refreshProfile: async () => {}, setProfile: () => {} })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null | undefined>(undefined)
  const [profile, setProfile] = useState<Profile | null>(null)

  const loadProfile = useCallback(async (id: string | null) => {
    if (!id) {
      setProfile(null)
      return
    }
    try {
      const row = await api.getProfile(id)
      setProfile(row ? toProfile(row) : null)
    } catch {
      setProfile(null)
    }
  }, [])

  useEffect(() => {
    let alive = true
    api.getUserId().then(async (id) => {
      if (!alive) return
      await loadProfile(id)
      setUserId(id)
    })
    const off = api.onAuthChange(async (id) => {
      await loadProfile(id)
      setUserId(id)
    })
    return () => {
      alive = false
      off()
    }
  }, [loadProfile])

  const refreshProfile = useCallback(() => loadProfile(userId ?? null), [loadProfile, userId])

  return <Ctx.Provider value={{ userId, profile, refreshProfile, setProfile }}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)

/** Code projet mémorisé quand une entreprise arrive par un lien d'invitation avant d'être connectée */
const PENDING = 'batimatch:pending-code'
export const pendingCode = {
  get: () => {
    try {
      return sessionStorage.getItem(PENDING)
    } catch {
      return null
    }
  },
  set: (c: string) => {
    try {
      sessionStorage.setItem(PENDING, c)
    } catch {
      /* ignoré */
    }
  },
  clear: () => {
    try {
      sessionStorage.removeItem(PENDING)
    } catch {
      /* ignoré */
    }
  },
}
