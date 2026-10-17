import axios from 'axios'

/**
 * Single axios instance for all backend calls.
 *
 * - baseURL '/api' is proxied to the Spring Boot backend in dev (see
 *   vite.config.ts) and should be routed the same way in prod (reverse
 *   proxy / load balancer), so the frontend never hardcodes a backend host.
 * - The JWT is attached here. franchise scoping is NOT a header/param we
 *   set client-side — the backend derives franchise_id from the token's
 *   claims. Never pass franchiseId as a request param.
 */
export const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired/invalid — drop the whole session and send the user to sign in again.
      // A 401 from the login call itself (wrong password) has no token and must not redirect.
      const hadSession = localStorage.getItem('accessToken') !== null
      for (const key of ['accessToken', 'username', 'fullName', 'role', 'mustChangePassword']) localStorage.removeItem(key)
      if (hadSession && window.location.pathname !== '/login') window.location.assign('/login')
    }
    if (error.response?.status === 403 && error.response?.data?.error === 'PASSWORD_CHANGE_REQUIRED') {
      localStorage.setItem('mustChangePassword', 'true')
      if (window.location.pathname !== '/change-password') window.location.assign('/change-password')
    }
    return Promise.reject(error)
  },
)
