/**
 * The accent colours a user can choose between (docs/ui-spec.md). One choice is
 * kept by the Host and followed by the desktop panel, the pairing page and the
 * remote app, so every surface of the plugin shows the same colour.
 */
export type Accent = 'orange' | 'blue' | 'black'
export interface AccentColors { accent: string; hover: string; ink: string }

export const ACCENTS: Record<Accent, { name: string; light: AccentColors; dark: AccentColors }> = {
  orange: { name: '陶土橙', light: { accent: '#D97757', hover: '#C86748', ink: '#FFFFFF' }, dark: { accent: '#D97757', hover: '#C86748', ink: '#FFFFFF' } },
  blue: { name: '蓝色', light: { accent: '#3D63E6', hover: '#3354C8', ink: '#FFFFFF' }, dark: { accent: '#3D63E6', hover: '#3354C8', ink: '#FFFFFF' } },
  // Black would vanish on a dark surface, so it turns to the light ink colour there.
  black: { name: '黑色', light: { accent: '#1F1E1D', hover: '#3A3835', ink: '#FFFFFF' }, dark: { accent: '#F0EEE8', hover: '#D8D4CC', ink: '#242321' } },
}
export const ACCENT_IDS = Object.keys(ACCENTS) as Accent[]
export function isAccent(value: unknown): value is Accent { return typeof value === 'string' && value in ACCENTS }

const declarations = (colors: AccentColors) => `--rc-accent:${colors.accent};--rc-accent-hover:${colors.hover};--rc-accent-ink:${colors.ink}`

/**
 * CSS that sets the accent variables on `selector` from its `data-rc-accent`
 * attribute. `dark` is either a selector prefix that marks the dark theme, or
 * 'media' to follow the system setting.
 */
export function accentCSS(selector: string, dark: string): string {
  return ACCENT_IDS.map(id => {
    const light = `${selector}[data-rc-accent=${id}]{${declarations(ACCENTS[id].light)}}`
    const darkRule = `${selector}[data-rc-accent=${id}]{${declarations(ACCENTS[id].dark)}}`
    return light + (dark === 'media' ? `@media(prefers-color-scheme:dark){${darkRule}}` : `${dark}${darkRule}`)
  }).join('\n')
}
