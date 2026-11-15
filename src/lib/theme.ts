import { useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'
const KEY = 'batimatch:theme'

const systemTheme = (): Theme => (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')

function stored(): Theme | null {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'dark' || v === 'light' ? v : null
  } catch {
    return null
  }
}

function apply(t: Theme) {
  document.documentElement.dataset.theme = t
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#17212d' : '#ffffff')
}

/** Thème clair ou sombre : suit le réglage du téléphone tant que l'utilisateur n'a pas choisi. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => stored() ?? systemTheme())

  useEffect(() => apply(theme), [theme])

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!mq) return
    const onChange = () => {
      if (!stored()) setTheme(systemTheme())
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const toggle = () =>
    setTheme((t) => {
      const next: Theme = t === 'dark' ? 'light' : 'dark'
      try {
        localStorage.setItem(KEY, next)
      } catch {
        /* ignoré */
      }
      return next
    })

  return { theme, toggle }
}
