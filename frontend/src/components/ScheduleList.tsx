import { Badge, Group, Text } from '@mantine/core'
import type { Booking, StitchOrder } from '../api/outletApi'
import { eventsOn, pendingEventsOn } from './BookingDayList'
import { todayIso } from './BillDetailsModal'
import { fmtDate } from '../config/dateFormat'

/** day: everything on that date; pendingDay: only what is still to be done on that date; overdue: past-due items with days late. */
export type ScheduleMode = { day: string } | { pendingDay: string } | 'overdue'

const bookingStatus: Record<Booking['status'], [string, string]> = { BOOKED: ['Booked', 'blue'], HANDED_OVER: ['With customer', 'orange'], COMPLETED: ['Completed', 'teal'], CANCELLED: ['Cancelled', 'gray'] }
const stitchStatus: Record<StitchOrder['status'], [string, string]> = { OPEN: ['Open', 'blue'], DELIVERED: ['Delivered', 'gray'], CANCELLED: ['Cancelled', 'gray'] }
/** Order status, or 'Ready' when some garments are finished and waiting. */
const stitchBadge = (o: StitchOrder): [string, string] => o.status === 'OPEN' && o.items.some((i) => i.status === 'FINISHED') ? ['Ready', 'teal'] : stitchStatus[o.status]
const kindColor: Record<Booking['kind'], string> = { APPOINTMENT: 'violet', RENTAL: 'orange', DELIVERY: 'blue' }
const daysLate = (due: string) => Math.max(1, Math.round((new Date(`${todayIso()}T00:00:00`).getTime() - new Date(`${due}T00:00:00`).getTime()) / 86400000))

interface Entry { key: string; date: string; time: string; tags: { label: string; color: string }[]; customer: string; mobile: string; what: string; sub: string; status: [string, string] }

function build(bookings: Booking[], stitch: StitchOrder[], mode: ScheduleMode): Entry[] {
  const rows: Entry[] = []
  for (const b of bookings) {
    const due = b.kind === 'RENTAL' ? b.expectedReturnDate ?? b.startDate : b.startDate
    let tags: { label: string; color: string }[]
    if (mode === 'overdue') tags = [{ label: `Return ${daysLate(due)}d late`, color: 'red' }]
    else tags = ('pendingDay' in mode ? pendingEventsOn(b, mode.pendingDay) : eventsOn(b, mode.day)).map((label) => ({ label, color: kindColor[b.kind] }))
    if (!tags.length) continue
    rows.push({ key: `b${b.id}`, date: mode === 'overdue' ? due : b.startDate, time: b.startTime?.slice(0, 5) ?? '', tags, customer: b.customerName, mobile: b.customerMobile, what: b.items.map((i) => (i.quantity > 1 ? `${i.name} × ${i.quantity}` : i.name)).join(', '), sub: b.items[0]?.serviceName ?? '', status: bookingStatus[b.status] })
  }
  for (const o of stitch) {
    if (typeof mode === 'object' && 'pendingDay' in mode && o.status !== 'OPEN') continue
    const tags = [{ label: mode === 'overdue' ? `Delivery ${daysLate(o.estimatedDeliveryDate)}d late` : 'Stitching delivery', color: mode === 'overdue' ? 'red' : 'grape' }]
    rows.push({ key: `s${o.id}`, date: o.estimatedDeliveryDate, time: '', tags, customer: o.customerName, mobile: o.customerMobile, what: o.items.filter((i) => i.status !== 'CANCELLED').map((i) => i.garment).join(', '), sub: o.orderNumber, status: stitchBadge(o) })
  }
  // oldest first for overdue; timed entries first within a day otherwise
  return rows.sort((a, b) => a.date.localeCompare(b.date) || (a.time || '99:99').localeCompare(b.time || '99:99'))
}

/** Number of entries a list would show (for headings), using the same filtering as the list itself. */
export const scheduleCount = (bookings: Booking[], stitch: StitchOrder[], mode: ScheduleMode) => build(bookings, stitch, mode).length

/** One list for everything scheduled: pre-bookings, rentals due back and stitching deliveries. */
export function ScheduleList({ bookings, stitch, mode, empty }: { bookings: Booking[]; stitch: StitchOrder[]; mode: ScheduleMode; empty: string }) {
  const rows = build(bookings, stitch, mode)
  if (!rows.length) return <Text c="dimmed" size="sm" py="sm">{empty}</Text>
  return <div>{rows.map((r, n) => <div key={r.key} style={{ padding: '10px 0', borderTop: n ? '1px solid var(--mantine-color-default-border)' : undefined }}>
    <Group justify="space-between" wrap="nowrap" align="flex-start" gap="sm">
      <div style={{ minWidth: 0 }}>
        <Group gap={6} mb={4}>{r.tags.map((t) => <Badge key={t.label} variant="light" color={t.color}>{t.label}</Badge>)}{mode === 'overdue' && <Text size="xs" c="dimmed">due {fmtDate(r.date)}</Text>}{r.time && mode !== 'overdue' && <Text size="xs" c="dimmed">{r.time}</Text>}</Group>
        <Text size="sm" fw={600}>{r.customer} <Text span size="xs" c="dimmed" fw={400}>{r.mobile}</Text></Text>
        <Text size="sm" c="dimmed" lineClamp={2}>{r.what}{r.sub ? ` · ${r.sub}` : ''}</Text>
      </div>
      <Badge variant="dot" color={r.status[1]} style={{ flexShrink: 0 }}>{r.status[0]}</Badge>
    </Group></div>)}</div>
}
