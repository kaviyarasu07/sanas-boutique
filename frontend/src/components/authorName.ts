// "Your name" for timelines (stitching orders, parlour bookings). One login per outlet today, so
// staff can sign their steps and comments; remembered on this device only (a convenience, so
// storage errors are ignored). Per-person names come automatically with staff logins.
const NAME_KEY = 'staff.authorName'

export function getAuthorName(): string | undefined {
  try { return localStorage.getItem(NAME_KEY)?.trim() || undefined } catch { return undefined }
}

export function setAuthorName(name: string) {
  try { if (name.trim()) localStorage.setItem(NAME_KEY, name.trim()); else localStorage.removeItem(NAME_KEY) } catch { /* not saved; fine */ }
}
