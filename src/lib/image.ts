/** Redimensionne une image (logo) côté navigateur avant envoi : carré de 256 px max, format WebP. */
export async function resizeImage(file: File, max = 256): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('Choisissez une image (PNG, JPG ou WebP).')
  if (file.size > 8 * 1024 * 1024) throw new Error('Image trop lourde (8 Mo maximum).')
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('Image illisible.'))
      i.src = url
    })
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
    const w = Math.max(1, Math.round(img.naturalWidth * scale))
    const h = Math.max(1, Math.round(img.naturalHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/webp', 0.9))
    if (blob) return blob
    const png = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'))
    if (!png) throw new Error('Conversion de l’image impossible.')
    return png
  } finally {
    URL.revokeObjectURL(url)
  }
}
