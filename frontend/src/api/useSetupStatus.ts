import { useEffect, useState } from 'react'
import { getSetupStatus } from './authApi'

interface State {
  loading: boolean
  adminExists: boolean | null
}

/**
 * Used by both LoginPage and SetupPage to redirect into whichever one is
 * actually valid right now: SetupPage only makes sense before the first
 * FRANCHISOR account exists, LoginPage only after.
 */
export function useSetupStatus(): State {
  const [state, setState] = useState<State>({ loading: true, adminExists: null })

  useEffect(() => {
    let cancelled = false

    getSetupStatus()
      .then((res) => {
        if (!cancelled) setState({ loading: false, adminExists: res.adminExists })
      })
      .catch(() => {
        // Backend unreachable — don't strand the user on a blank screen;
        // let them see the login form and its own error handling take over.
        if (!cancelled) setState({ loading: false, adminExists: true })
      })

    return () => {
      cancelled = true
    }
  }, [])

  return state
}
