import { apiClient } from './client'

export interface AuthResponse {
  accessToken: string
  username: string
  fullName: string
  role: 'FRANCHISOR' | 'FRANCHISE_OWNER' | 'STAFF' | 'OUTLET'
  mustChangePassword: boolean
}

export interface SetupStatusResponse {
  adminExists: boolean
}

export async function getSetupStatus(): Promise<SetupStatusResponse> {
  const { data } = await apiClient.get<SetupStatusResponse>('/auth/setup-status')
  return data
}

export async function setupAdmin(payload: {
  fullName: string
  username: string
  mobileNo: string
  password: string
}): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/setup', payload)
  return data
}

export async function login(payload: {
  mobileNo: string
  password: string
}): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/login', payload)
  return data
}

/** Persists the session so apiClient's interceptor picks it up on every request. */
export function storeSession(auth: AuthResponse) {
  localStorage.setItem('accessToken', auth.accessToken)
  localStorage.setItem('username', auth.username)
  localStorage.setItem('fullName', auth.fullName)
  localStorage.setItem('role', auth.role)
  localStorage.setItem('mustChangePassword', String(auth.mustChangePassword))
}

export function clearSession() {
  localStorage.removeItem('accessToken')
  localStorage.removeItem('username')
  localStorage.removeItem('fullName')
  localStorage.removeItem('role')
  localStorage.removeItem('mustChangePassword')
}

export async function changePassword(payload: {
  currentPassword: string
  newPassword: string
}): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/change-password', payload)
  return data
}

export interface OtpResponse {
  message: string
  /** Only present while the backend has no SMS provider (app.otp.expose-in-response). */
  otp: string | null
  validForMinutes: number
}

export interface Profile {
  fullName: string
  mobileNo: string
  username: string
  role: AuthResponse['role']
}

export async function getProfile(): Promise<Profile> {
  const { data } = await apiClient.get<Profile>('/auth/me')
  return data
}

export async function requestPasswordOtp(mobileNo: string): Promise<OtpResponse> {
  const { data } = await apiClient.post<OtpResponse>('/auth/forgot-password', { mobileNo })
  return data
}

export async function resetPassword(payload: {
  mobileNo: string
  otp: string
  newPassword: string
}): Promise<void> {
  await apiClient.post('/auth/reset-password', payload)
}
