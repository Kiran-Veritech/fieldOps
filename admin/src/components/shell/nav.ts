import type { ComponentType } from 'react'
import {
  AssetsIcon,
  AuditIcon,
  DashboardIcon,
  LiveMapIcon,
  ProjectsIcon,
  SettingsIcon,
  TasksIcon,
  UsersIcon,
} from './icons'

export type NavItem = {
  to: string
  label: string
  icon: ComponentType<{ stroke?: string; size?: number }>
  subtitle?: string
}

export const NAV: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: DashboardIcon },
  { to: '/live-map', label: 'Live Map', icon: LiveMapIcon, subtitle: 'GURUGRAM · DELHI NCR' },
  { to: '/users', label: 'Users', icon: UsersIcon },
  { to: '/projects', label: 'Projects', icon: ProjectsIcon },
  { to: '/tasks', label: 'Tasks', icon: TasksIcon },
  { to: '/assets', label: 'Assets', icon: AssetsIcon },
  { to: '/audit', label: 'Audit Log', icon: AuditIcon },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
]
