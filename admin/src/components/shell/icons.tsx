// Nav + chrome icons — SVG paths lifted verbatim from the design reference
// (16x16, lucide-style strokes at 1.4). `stroke` is passed by the caller.

type IconProps = { stroke?: string; size?: number }

function base({ size = 16 }: IconProps) {
  return { width: size, height: size, viewBox: '0 0 16 16', fill: 'none' as const }
}

export function DashboardIcon({ stroke = '#5A6B84', size }: IconProps) {
  return (
    <svg {...base({ size })} stroke={stroke} strokeWidth={1.4}>
      <rect x="1.5" y="1.5" width="5" height="5" />
      <rect x="9.5" y="1.5" width="5" height="5" />
      <rect x="1.5" y="9.5" width="5" height="5" />
      <rect x="9.5" y="9.5" width="5" height="5" />
    </svg>
  )
}

export function LiveMapIcon({ stroke = '#5A6B84', size }: IconProps) {
  return (
    <svg {...base({ size })} stroke={stroke} strokeWidth={1.4}>
      <circle cx="8" cy="8" r="6.2" />
      <circle cx="8" cy="8" r="1.6" fill={stroke} stroke="none" />
      <path d="M8 1.8v2M8 12.2v2M1.8 8h2M12.2 8h2" />
    </svg>
  )
}

export function UsersIcon({ stroke = '#5A6B84', size }: IconProps) {
  return (
    <svg {...base({ size })} stroke={stroke} strokeWidth={1.4}>
      <circle cx="5.5" cy="5.5" r="2.4" />
      <circle cx="11" cy="6.5" r="1.8" />
      <path d="M1.5 13c0-2.2 1.8-3.6 4-3.6s4 1.4 4 3.6M9.6 12.4c.2-1.6 1.4-2.6 3-2.6 1.3 0 2.4.7 2.8 1.9" />
    </svg>
  )
}

export function ProjectsIcon({ stroke = '#5A6B84', size }: IconProps) {
  return (
    <svg {...base({ size })} stroke={stroke} strokeWidth={1.4}>
      <rect x="1.6" y="2.5" width="12.8" height="11" rx="1" />
      <path d="M1.6 5.6h12.8M5 2.5v3.1" />
    </svg>
  )
}

export function TasksIcon({ stroke = '#5A6B84', size }: IconProps) {
  return (
    <svg {...base({ size })} stroke={stroke} strokeWidth={1.4}>
      <path d="M2 3.5l1.6 1.6L6 2.8M2 8.5l1.6 1.6L6 7.8M2 13.5l1.6 1.6" />
      <path d="M8 4h6M8 9h6M8 14h6" />
    </svg>
  )
}

export function AssetsIcon({ stroke = '#5A6B84', size }: IconProps) {
  return (
    <svg {...base({ size })} stroke={stroke} strokeWidth={1.4}>
      <path d="M8 1.6L14.4 5v6L8 14.4 1.6 11V5z" />
      <path d="M1.6 5L8 8.4 14.4 5M8 8.4v6" />
    </svg>
  )
}

export function AuditIcon({ stroke = '#5A6B84', size }: IconProps) {
  return (
    <svg {...base({ size })} stroke={stroke} strokeWidth={1.4}>
      <rect x="2.5" y="1.6" width="11" height="12.8" rx="1" />
      <path d="M5 5h6M5 8h6M5 11h3.5" />
    </svg>
  )
}

export function SettingsIcon({ stroke = '#5A6B84', size }: IconProps) {
  return (
    <svg {...base({ size })} stroke={stroke} strokeWidth={1.4}>
      <circle cx="8" cy="8" r="2.6" />
      <path d="M8 1.4v2.2M8 12.4v2.2M1.4 8h2.2M12.4 8h2.2M3.5 3.5l1.6 1.6M10.9 10.9l1.6 1.6M12.5 3.5l-1.6 1.6M5.1 10.9l-1.6 1.6" />
    </svg>
  )
}

export function SearchIcon({ stroke = '#5A6B84', size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={stroke} strokeWidth={1.5}>
      <circle cx="7" cy="7" r="5" />
      <path d="M11 11l3.5 3.5" />
    </svg>
  )
}
