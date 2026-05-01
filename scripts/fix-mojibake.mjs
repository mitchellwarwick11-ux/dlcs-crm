import { readFileSync, writeFileSync } from 'node:fs'
import iconv from 'iconv-lite'

// Files known to contain double-encoded UTF-8 (UTF-8 read as cp1252, re-saved as UTF-8).
const files = [
  'src/app/field/page.tsx',
  'src/app/field/upcoming/page.tsx',
  'src/app/field/[entryId]/page.tsx',
  'src/app/field/[entryId]/notes/page.tsx',
  'src/app/field/[entryId]/photos/page.tsx',
  'src/app/field/[entryId]/safety/page.tsx',
  'src/app/field/[entryId]/time/page.tsx',
  'src/components/field/interactive-checklist.tsx',
  'src/components/field/jsa-form.tsx',
  'src/components/field/photo-upload.tsx',
  'src/components/field/risk-matrix-picker.tsx',
  'src/components/field/save-exit-button.tsx',
  'src/components/field/time-log-form.tsx',
]

// Match runs of characters that look like UTF-8-misread-as-cp1252:
//   leading byte 0xC2-0xF4 (i.e. Â-ô) followed by 1-3 cp1252 chars whose
//   codepoints originated from byte values 0x80-0xBF.
// cp1252 maps 0x80-0x9F to various Unicode codepoints (€, ‚, ƒ, „, …, †, ‡, ˆ, ‰,
//   Š, ‹, Œ, Ž, ‘, ’, “, ”, •, –, —, ˜, ™, š, ›, œ, ž, Ÿ); 0xA0-0xBF map 1:1 to U+00A0-U+00BF.
const trailers = new Set([
  // 0x80..0x9F cp1252 → Unicode
  0x20AC,0x201A,0x0192,0x201E,0x2026,0x2020,0x2021,0x02C6,0x2030,
  0x0160,0x2039,0x0152,0x017D,0x2018,0x2019,0x201C,0x201D,0x2022,
  0x2013,0x2014,0x02DC,0x2122,0x0161,0x203A,0x0153,0x017E,0x0178,
  // 0x90,0x9D - undefined in cp1252; some systems pass them through as U+0090/U+009D
  0x0090,0x009D,
])
for (let cp = 0xA0; cp <= 0xBF; cp++) trailers.add(cp)

// Inverse: cp1252 byte for a given Unicode codepoint (only in the 0x80-0xFF range).
const cp1252For = new Map()
const map80_9F = [
  0x20AC,0x0081,0x201A,0x0192,0x201E,0x2026,0x2020,0x2021,0x02C6,0x2030,
  0x0160,0x2039,0x0152,0x008D,0x017D,0x008F,0x0090,0x2018,0x2019,0x201C,
  0x201D,0x2022,0x2013,0x2014,0x02DC,0x2122,0x0161,0x203A,0x0153,0x009D,
  0x017E,0x0178,
]
for (let i = 0; i < 32; i++) cp1252For.set(map80_9F[i], 0x80 + i)
for (let cp = 0xA0; cp <= 0xFF; cp++) cp1252For.set(cp, cp)

function tryDecode(chars) {
  // Convert each char back to its cp1252 byte, then decode the byte run as UTF-8.
  const bytes = []
  for (const ch of chars) {
    const cp = ch.codePointAt(0)
    const b = cp1252For.get(cp)
    if (b === undefined) return null
    bytes.push(b)
  }
  const buf = Buffer.from(bytes)
  const decoded = iconv.decode(buf, 'utf-8')
  // Reject if decode produced replacement chars (decode failed silently).
  if (decoded.includes('�')) return null
  return decoded
}

function fixText(text) {
  let out = ''
  let i = 0
  let changes = 0
  while (i < text.length) {
    const cp = text.codePointAt(i)
    // UTF-8 leading byte range, when read as cp1252, lands at U+00C2-U+00F4.
    if (cp >= 0xC2 && cp <= 0xF4) {
      // Greedily collect 1..3 trailing chars that look like cp1252 trailing bytes.
      const maxTrail = cp <= 0xDF ? 1 : cp <= 0xEF ? 2 : 3
      let trail = 0
      let j = i + 1
      while (trail < maxTrail && j < text.length) {
        const tcp = text.codePointAt(j)
        if (!trailers.has(tcp)) break
        trail++
        j++
      }
      if (trail >= 1) {
        const candidate = text.slice(i, i + 1 + trail)
        const decoded = tryDecode(candidate)
        if (decoded !== null && decoded.length === 1) {
          out += decoded
          i += 1 + trail
          changes++
          continue
        }
      }
    }
    out += text[i]
    i++
  }
  return { text: out, changes }
}

let totalChanges = 0
for (const rel of files) {
  let text
  try {
    text = readFileSync(rel, 'utf8')
  } catch {
    console.log(`skip (not found): ${rel}`)
    continue
  }
  const { text: fixed, changes } = fixText(text)
  if (changes > 0) {
    writeFileSync(rel, fixed, 'utf8')
    console.log(`fixed: ${rel} (${changes} sequence(s))`)
    totalChanges += changes
  } else {
    console.log(`clean: ${rel}`)
  }
}
console.log(`\nTotal: ${totalChanges} sequence(s) repaired`)
