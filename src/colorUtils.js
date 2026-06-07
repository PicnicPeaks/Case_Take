/**
 * Returns true if the given hex color is light enough that dark text should be used.
 * Falls back to dark assumption (returns false) for any non-hex value.
 */
export function isLightColor(hex = '') {
  const clean = hex.replace('#', '')
  if (clean.length !== 6) return false
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  // Perceived luminance (ITU-R BT.601)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6
}

/**
 * Returns a set of CSS color values suited for content rendered ON TOP of `brandColor`.
 */
export function onBrand(brandColor) {
  const light = isLightColor(brandColor)
  return {
    text:        light ? '#111827'              : 'white',
    textMuted:   light ? 'rgba(0,0,0,0.45)'    : 'rgba(255,255,255,0.55)',
    btnBg:       light ? 'rgba(0,0,0,0.07)'    : 'rgba(255,255,255,0.12)',
    btnBgHover:  light ? 'rgba(0,0,0,0.13)'    : 'rgba(255,255,255,0.22)',
    btnText:     light ? '#374151'              : 'rgba(255,255,255,0.88)',
    btnBorder:   light ? 'rgba(0,0,0,0.15)'    : 'rgba(255,255,255,0.22)',
    btnPrimary:  light ? '#111827'              : 'white',
    btnPrimaryText: light ? 'white'            : brandColor,
  }
}
