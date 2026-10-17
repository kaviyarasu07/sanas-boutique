import type { PropsWithChildren } from 'react'
import { Navigate } from 'react-router-dom'

/**
 * Route guard. This only hides UI — it is NOT the security boundary.
 * The backend must independently reject any request whose JWT is missing,
 * expired, or scoped to a different franchise. Never trust this check
 * alone.
 */
export function RequireAuth({ children }: PropsWithChildren) {
  const token = localStorage.getItem('accessToken')

  if (!token) {
    return <Navigate to="/login" replace />
  }

  // A system-generated password must be replaced before anything else is usable.
  if (localStorage.getItem('mustChangePassword') === 'true') {
    return <Navigate to="/change-password" replace />
  }

  return <>{children}</>
}
