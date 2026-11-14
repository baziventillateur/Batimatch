import type { Backend } from './backend'
import { createMockBackend } from './mock'
import { createSupabaseBackend } from './supabase'

/**
 * Backend actif : Supabase en production.
 * Le mode démonstration (données dans le navigateur) s'active avec VITE_BACKEND=mock
 * ou en ajoutant ?demo à l'adresse.
 */
const useMock =
  import.meta.env.VITE_BACKEND === 'mock' ||
  (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('demo'))

export const api: Backend = useMock ? createMockBackend() : createSupabaseBackend()

export { errorMessage } from './backend'
