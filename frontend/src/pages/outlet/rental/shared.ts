import { notifications } from '@mantine/notifications'
import { extractErrorMessage } from '../../../api/catalogApi'
import type { RentalBooking } from '../../../api/outletApi'

export const fail = (title: string) => (e: unknown) => notifications.show({ color: 'red', title, message: extractErrorMessage(e) })

/** Days charged: return date − take-away date, minimum 1 (take on 14th, return on 16th = 2 days). Same rule as the server. */
export function rentalDays(from: string, to: string): number {
  const ms = new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()
  return Math.max(1, Math.round(ms / 86400000))
}
export const daysText = (n: number) => `${n} day${n === 1 ? '' : 's'}`

export const statusLabel = (b: RentalBooking) => b.status === 'BOOKED' ? 'Booked' : b.status === 'WITH_CUSTOMER' ? 'With customer' : b.status === 'RETURNED' ? 'Returned' : b.autoCancelled ? 'Not collected' : 'Cancelled'
export const statusColor = (b: RentalBooking) => b.status === 'BOOKED' ? 'blue' : b.status === 'WITH_CUSTOMER' ? 'orange' : b.status === 'RETURNED' ? 'teal' : b.autoCancelled ? 'gray' : 'red'
export const piecesText = (b: { items: { name: string; quantity: number }[] }) => b.items.map((i) => (i.quantity > 1 ? `${i.name} × ${i.quantity}` : i.name)).join(', ')
export const pieceCount = (b: { items: { quantity: number }[] }) => b.items.reduce((s, i) => s + i.quantity, 0)

export const cancelReasons = ['Customer cancelled', 'Pieces not available', 'Other']
export const damageNotes = ['Broken clasp', 'Stone missing', 'Bent', 'Polish needed', 'Scratched']
