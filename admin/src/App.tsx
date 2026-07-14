import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { AdminLayout } from './components/shell/AdminLayout'
import { Assets } from './pages/Assets'
import { AuditLog } from './pages/AuditLog'
import { Dashboard } from './pages/Dashboard'
import { LiveMap } from './pages/LiveMap'
import { ProjectDetail } from './pages/ProjectDetail'
import { Projects } from './pages/Projects'
import { Settings } from './pages/Settings'
import { Tasks } from './pages/Tasks'
import { UserDetail } from './pages/UserDetail'
import { Users } from './pages/Users'

function Bootstrapping() {
  const { ready, error } = useAuth()
  if (error) {
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#04060B' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#F0F4FA', marginBottom: 8 }}>Cannot reach FieldOps backend</div>
          <div className="mono" style={{ fontSize: 11, color: '#FB7185' }}>{error}</div>
          <div className="mono" style={{ fontSize: 10, color: '#5A6B84', marginTop: 10 }}>Is the API running on :8000?</div>
        </div>
      </div>
    )
  }
  if (!ready) {
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#04060B' }}>
        <div className="mono" style={{ fontSize: 11, letterSpacing: '0.12em', color: '#5A6B84' }}>CONNECTING…</div>
      </div>
    )
  }
  return null
}

function Shell() {
  const { ready, error } = useAuth()
  if (!ready || error) return <Bootstrapping />
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/live-map" element={<LiveMap />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/users" element={<Users />} />
        <Route path="/users/:id" element={<UserDetail />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/:id" element={<ProjectDetail />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/assets" element={<Assets />} />
        <Route path="/audit" element={<AuditLog />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  )
}
