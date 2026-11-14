/**
 * Petite pluie de confettis aux couleurs de Batimatch (décision, offre envoyée).
 * Sans dépendance ; désactivée si l'utilisateur préfère réduire les animations.
 */
export function confetti(origin?: { x: number; y: number }) {
  if (typeof window === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  const canvas = document.createElement('canvas')
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  canvas.width = window.innerWidth * dpr
  canvas.height = window.innerHeight * dpr
  Object.assign(canvas.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '60' })
  document.body.appendChild(canvas)
  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)
  const colors = ['#f8e04e', '#2a5c8f', '#1baf7a', '#eb6834', '#1b2a3a', '#2a78d6']
  const ox = origin?.x ?? window.innerWidth / 2
  const oy = origin?.y ?? window.innerHeight / 3
  const parts = Array.from({ length: 140 }, () => {
    const angle = Math.random() * Math.PI * 2
    const speed = 4 + Math.random() * 9
    return {
      x: ox,
      y: oy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 6,
      w: 5 + Math.random() * 6,
      h: 3 + Math.random() * 5,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.4,
      c: colors[Math.floor(Math.random() * colors.length)],
    }
  })
  const t0 = performance.now()
  const frame = (t: number) => {
    const elapsed = t - t0
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
    for (const p of parts) {
      p.vy += 0.32
      p.vx *= 0.985
      p.x += p.vx
      p.y += p.vy
      p.r += p.vr
      ctx.save()
      ctx.globalAlpha = Math.max(0, 1 - elapsed / 2200)
      ctx.translate(p.x, p.y)
      ctx.rotate(p.r)
      ctx.fillStyle = p.c
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
      ctx.restore()
    }
    if (elapsed < 2200) requestAnimationFrame(frame)
    else canvas.remove()
  }
  requestAnimationFrame(frame)
}
