// Generates Webcase's app icons: a white Newsreader-italic "W" on cobalt.
//
//   bun -i scripts/generate-icons.mjs        (run in apps/webcase)
//
// `-i` lets Bun fetch the pinned tools below into its global cache, so
// none is a dependency in package.json. The glyph is read from the font file as
// an outline (wawoff2 + fontkit), so the icons never fall back to another font, and the
// installed Chrome rasterises the SVGs (puppeteer-core). Set CHROME_PATH to use
// a different Chrome.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as fontkit from 'fontkit@2.0.4'
import puppeteer from 'puppeteer-core@25.16.0'
import wawoff2 from 'wawoff2@2.0.1'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PUBLIC = join(ROOT, 'public')
const ICONS = join(PUBLIC, 'icons')
const FONT = join(
  ROOT,
  'node_modules/@fontsource-variable/newsreader/files/newsreader-latin-opsz-italic.woff2',
)
const CHROME =
  process.env.CHROME_PATH ??
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

// --primary and --primary-foreground in src/index.css.
const COBALT = '#1d3fd8'
const WHITE = '#ffffff'

// fontkit cannot instance a variable WOFF2, so the file is unpacked to TTF first.
const ttf = Buffer.from(await wawoff2.decompress(readFileSync(FONT)))
const base = fontkit.create(ttf)
const glyphId = base.glyphForCodePoint('W'.codePointAt(0)).id

const outlineOf = (axes) => {
  const glyph = base.getVariation(axes).getGlyph(glyphId)
  return { d: glyph.path.toSVG(), box: glyph.path.bbox }
}

// The display cut (opsz 72) for app icons; the caption cut (opsz 6), sturdier and
// heavier, for favicons, where the display cut's hairlines vanish at 16px.
const DISPLAY = outlineOf({ opsz: 72, wght: 600 })
const CAPTION = outlineOf({ opsz: 6, wght: 760 })

/**
 * One square icon in a 512 viewBox. The W is scaled to `glyphHeight` of the icon,
 * or less if that would make it wider than `maxWidth`; `radius` rounds the tile.
 */
const iconSvg = ({ outline, glyphHeight, maxWidth, radius }) => {
  const size = 512
  const { box, d } = outline
  const scale = Math.min(
    (size * glyphHeight) / (box.maxY - box.minY),
    (size * maxWidth) / (box.maxX - box.minX),
  )
  const width = (box.maxX - box.minX) * scale
  const height = (box.maxY - box.minY) * scale
  // Centre the outline's bounding box; font units point up, SVG points down.
  const tx = (size - width) / 2 - box.minX * scale
  const ty = (size + height) / 2 + box.minY * scale

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">`,
    `<rect width="${size}" height="${size}" rx="${radius}" fill="${COBALT}"/>`,
    `<path fill="${WHITE}" transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${scale.toFixed(5)} ${(-scale).toFixed(5)})" d="${d}"/>`,
    `</svg>`,
  ].join('')
}

// "any" icons show as drawn, so they get a rounded tile and a large glyph.
const ANY = iconSvg({
  outline: DISPLAY,
  glyphHeight: 0.5,
  maxWidth: 0.74,
  radius: 112,
})
// Maskable and Apple icons are cropped by the OS: full bleed, glyph inside the 80% safe circle.
const FULL_BLEED = iconSvg({
  outline: DISPLAY,
  glyphHeight: 0.42,
  maxWidth: 0.62,
  radius: 0,
})
// Favicons are tiny: the glyph fills most of the tile.
const FAVICON = iconSvg({
  outline: CAPTION,
  glyphHeight: 0.62,
  maxWidth: 0.8,
  radius: 104,
})

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
})

// `opaque` paints the page cobalt too, so the PNG has no transparent pixels (Apple's rule).
const render = async (svg, size, { opaque = false } = {}) => {
  const page = await browser.newPage()
  await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 })
  await page.setContent(
    `<!doctype html><html><body style="margin:0;background:${opaque ? COBALT : 'transparent'}">${svg.replace(
      '<svg ',
      `<svg width="${size}" height="${size}" style="display:block" `,
    )}</body></html>`,
  )
  const png = await page.screenshot({ type: 'png', omitBackground: !opaque })
  await page.close()
  return Buffer.from(png)
}

// An .ico holding PNG images (supported everywhere that matters).
const toIco = (pngs) => {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(pngs.length, 4)

  let offset = 6 + pngs.length * 16
  const entries = pngs.map(({ size, png }) => {
    const entry = Buffer.alloc(16)
    entry.writeUInt8(size >= 256 ? 0 : size, 0)
    entry.writeUInt8(size >= 256 ? 0 : size, 1)
    entry.writeUInt8(0, 2)
    entry.writeUInt8(0, 3)
    entry.writeUInt16LE(1, 4)
    entry.writeUInt16LE(32, 6)
    entry.writeUInt32LE(png.length, 8)
    entry.writeUInt32LE(offset, 12)
    offset += png.length
    return entry
  })

  return Buffer.concat([header, ...entries, ...pngs.map(({ png }) => png)])
}

mkdirSync(ICONS, { recursive: true })

const outputs = [
  ['icons/icon-192.png', ANY, 192],
  ['icons/icon-512.png', ANY, 512],
  ['icons/icon-maskable-512.png', FULL_BLEED, 512, { opaque: true }],
  ['icons/apple-touch-icon.png', FULL_BLEED, 180, { opaque: true }],
]

for (const [path, svg, size, options] of outputs) {
  writeFileSync(join(PUBLIC, path), await render(svg, size, options))
}

writeFileSync(join(PUBLIC, 'favicon.svg'), `${FAVICON}\n`)

const icoSizes = [16, 32, 48]
const icoImages = []
for (const size of icoSizes) {
  icoImages.push({ size, png: await render(FAVICON, size) })
}
writeFileSync(join(PUBLIC, 'favicon.ico'), toIco(icoImages))

await browser.close()

const written = [
  ...outputs.map(([path]) => path),
  'favicon.svg',
  `favicon.ico (${icoSizes.join(', ')})`,
]
console.log(`Wrote ${written.join(', ')} to public/`)
