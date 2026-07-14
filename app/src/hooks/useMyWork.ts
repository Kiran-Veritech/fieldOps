import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { ProjectLite, Task } from '../types'
import { useAuth } from '../auth/AuthContext'

/** Shared fetch for the signed-in employee's tasks + projects. */
export function useMyWork(pollMs = 10_000) {
  const { me } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<ProjectLite[]>([])
  const [loaded, setLoaded] = useState(false)

  const reload = useCallback(async () => {
    if (!me) return
    try {
      const [t, p] = await Promise.all([
        api<Task[]>(`/tasks?assigneeId=${me.id}`),
        api<ProjectLite[]>('/projects/mine'),
      ])
      setTasks(t)
      setProjects(p)
    } catch {
      // keep previous
    } finally {
      setLoaded(true)
    }
  }, [me])

  useEffect(() => {
    reload()
    if (!pollMs) return
    const id = setInterval(reload, pollMs)
    return () => clearInterval(id)
  }, [reload, pollMs])

  const projectName = useCallback(
    (id: string) => projects.find((p) => p._id === id)?.name ?? '—',
    [projects],
  )

  return { me, tasks, projects, loaded, reload, projectName }
}
