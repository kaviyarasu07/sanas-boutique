export function extractErrorMessage(error: unknown): string {
  const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message
  return typeof message === 'string' && message ? message : 'Something went wrong. Please try again.'
}

export const homeFor = (role: string | null) => (role === 'OUTLET' ? '/outlet' : '/dashboard')
