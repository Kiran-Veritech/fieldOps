import { Platform } from 'react-native'

// §6 design tokens — the exact palette used across the FieldOps Nexus surfaces.
// The app frames render on #070C16 (one notch lighter than the admin's #04060B).
export const C = {
  bg: '#070C16',
  bgDeep: '#04060B',
  panel: '#0B1220',
  panelAlt: '#152134',
  hairline: '#1E2A3D',
  hairlineSoft: '#10192A',
  line2: '#2A3A52',

  text: '#F0F4FA',
  textBody: '#C7D2E1',
  textDim: '#97A6BC',
  textMute: '#7C89A1',
  textFaint: '#5A6B84',
  textGhost: '#3C4E6A',

  teal: '#16C0AE',
  tealText: '#3DD5C6',
  tealBright: '#7BF0E2',

  green: '#3FD07E',
  greenText: '#5BE59A',
  amber: '#F4A521',
  amberBright: '#FBBF3B',
  blue: '#3B82F6',
  blueText: '#7DB0FF',
  red: '#F04438',
  redSoft: '#E5484D',
  redText: '#FF8F94',
  redBright: '#FF6A5E',
  grey: '#64748B',
} as const

// IBM Plex isn't bundled as a native font, so approximate the mono voice with
// the platform monospace face; sans falls back to the system UI font.
export const mono = Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' })

export const RADIUS = 2
