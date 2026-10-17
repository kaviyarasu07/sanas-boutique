import type { PropsWithChildren } from 'react'
import { Navigate } from 'react-router-dom'
import { RequireAuth } from './RequireAuth'

export const homeForRole = (role: string | null) => (role === 'OUTLET' ? '/outlet' : '/dashboard')

export function RequireRole({ role, children }: PropsWithChildren<{ role: string }>) {
  const current = localStorage.getItem('role')
  return (
    <RequireAuth>
      {current === role ? children : <Navigate to={homeForRole(current)} replace />}
    </RequireAuth>
  )
}
