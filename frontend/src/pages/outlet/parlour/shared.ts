import { notifications } from '@mantine/notifications'
import { extractErrorMessage } from '../../../api/catalogApi'
import type { ParlourAppointment } from '../../../api/outletApi'
import { todayIso } from '../../../components/BillDetailsModal'

export const fail = (title: string) => (e: unknown) => notifications.show({ color: 'red', title, message: extractErrorMessage(e) })

/** "11:00" / "11:00:00" → "11:00 am". */
export function timeLabel(t: string | null): string {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  return `${String(h % 12 || 12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`
}

/** Booking times in 15-minute steps, 7:00 am to 9:45 pm (picked, never typed). */
export const timeOptions = Array.from({ length: (22 - 7) * 4 }, (_, n) => {
  const h = 7 + Math.floor(n / 4), m = (n % 4) * 15
  const value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  return { value, label: timeLabel(value) }
})
export const quickTimes = ['10:00', '11:00', '12:00', '15:00', '16:00', '17:00']

export const statusLabel = (a: ParlourAppointment) => a.status === 'BOOKED' ? 'Booked' : a.status === 'DONE' ? 'Done' : a.autoCancelled ? 'Not done' : 'Cancelled'
export const statusColor = (a: ParlourAppointment) => a.status === 'BOOKED' ? 'blue' : a.status === 'DONE' ? 'teal' : a.autoCancelled ? 'orange' : 'red'
export const servicesText = (a: ParlourAppointment) => a.items.map((i) => (i.quantity > 1 ? `${i.name} × ${i.quantity}` : i.name)).join(', ')

/** Today's booking whose time has passed and is not done yet (shown so staff can act). */
export function isOverdueToday(a: ParlourAppointment): boolean {
  if (a.status !== 'BOOKED' || a.date !== todayIso() || !a.time) return false
  const now = new Date()
  return a.time.slice(0, 5) < `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}
export const canBillToday = (a: ParlourAppointment) => a.status === 'BOOKED' && a.date === todayIso()

export const cancelReasons = ['Customer cancelled', "Didn't come", 'Other']
