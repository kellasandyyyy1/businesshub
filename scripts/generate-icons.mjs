import { mkdirSync, readFileSync } from 'node:fs'
import sharp from 'sharp'

/**
 * Renders every app icon from public/favicon.svg, so the mark on a home screen,
 * a taskbar and a browser tab is the same drawing.
 *
 * Two treatments come out of the one source:
 *
 * - "any" keeps a transparent ground. The logomark is already a rounded badge,
 *   so it reads as its own silhouette wherever a launcher puts it.
 * - "maskable" is cropped by the platform to a circle or squircle, and the
 *   artwork spans about 89% of the source width — the sides would be shaved
 *   off. So it sits on an opaque ground at 64%, inside the safe zone.
 */

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512]
const MASKABLE = [192, 512]

/** Light, because the mark is dark: on its own #0a0a0a it disappears. */
const MASKABLE_GROUND = '#ffffff'
/** Keeps the drawing within the circle a maskable icon is cropped to. */
const SAFE_SCALE = 0.64

const source = readFileSync('./public/favicon.svg')

mkdirSync('./public/icons', { recursive: true })

for (const size of SIZES) {
  await sharp(source, { density: 1024 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(`./public/icons/icon-${size}.png`)
  console.log(`Generated icon-${size}.png`)
}

for (const size of MASKABLE) {
  const inner = Math.round(size * SAFE_SCALE)
  const art = await sharp(source, { density: 1024 })
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()

  await sharp({
    create: { width: size, height: size, channels: 4, background: MASKABLE_GROUND },
  })
    .composite([{ input: art, gravity: 'centre' }])
    .png({ compressionLevel: 9 })
    .toFile(`./public/icons/icon-${size}-maskable.png`)
  console.log(`Generated icon-${size}-maskable.png`)
}

/* iOS does not honour transparency on a touch icon — it composites it onto
   black, which would lose the dark badge entirely. It gets the opaque one. */
await sharp(`./public/icons/icon-192-maskable.png`)
  .png({ compressionLevel: 9 })
  .toFile('./public/icons/apple-touch-icon.png')
console.log('Generated apple-touch-icon.png')

console.log('All icons generated.')
