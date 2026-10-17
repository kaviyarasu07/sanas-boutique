import { Badge, Table, Text } from '@mantine/core'
import type { Booking } from '../api/outletApi'
import { fmtDate } from '../config/dateFormat'

export const bookingItemsText = (b: Booking) => b.items.map((i) => (i.quantity > 1 ? `${i.name} × ${i.quantity}` : i.name)).join(', ')

/** What happens to this booking on the given calendar day (yyyy-MM-dd). */
export function eventsOn(b: Booking, day: string): string[] {
  const out: string[] = []
  if (b.kind === 'RENTAL') {
    if (b.handedOverOn === day) out.push('Handed over'); else if (b.startDate === day && b.status === 'BOOKED') out.push('Hand-over')
    if (b.returnedOn === day) out.push('Returned'); else if (b.expectedReturnDate === day && b.status !== 'COMPLETED') out.push('Return due')
  } else if (b.startDate === day) out.push(b.kind === 'APPOINTMENT' ? `Appointment${b.startTime ? ' ' + b.startTime.slice(0, 5) : ''}` : 'Delivery')
  return out
}

/** Events still to be done on the day: hand-over of a booked rental, return of a rental due back, an appointment or delivery not yet completed. */
export function pendingEventsOn(b: Booking, day: string): string[] {
  if (b.kind === 'RENTAL') {
    if (b.status === 'BOOKED' && b.startDate <= day) return ['Hand-over']
    if (b.status === 'HANDED_OVER' && b.expectedReturnDate === day) return ['Return due']
    return []
  }
  if (b.status === 'BOOKED' && b.startDate === day) return [b.kind === 'APPOINTMENT' ? `Appointment${b.startTime ? ' ' + b.startTime.slice(0, 5) : ''}` : 'Delivery']
  return []
}

/** Compact read-only list of a day's bookings (dashboard). */
export function BookingDayList({ bookings, day }: { bookings: Booking[]; day: string }) {
  if (!bookings.length) return <Text c="dimmed" size="sm">Nothing booked for this day.</Text>
  return <div style={{ overflowX: 'auto' }}><Table><Table.Thead><Table.Tr><Table.Th>What</Table.Th><Table.Th>Customer</Table.Th><Table.Th>Items</Table.Th><Table.Th>Rental period</Table.Th></Table.Tr></Table.Thead><Table.Tbody>{bookings.map((b) => <Table.Tr key={b.id}>
    <Table.Td>{eventsOn(b, day).map((e) => <Badge key={e} mr={4} variant="dot">{e}</Badge>)}</Table.Td>
    <Table.Td><Text fw={600} size="sm">{b.customerName}</Text><Text size="xs" c="dimmed">{b.customerMobile}</Text></Table.Td>
    <Table.Td><Text size="sm">{bookingItemsText(b)}</Text><Text size="xs" c="dimmed">{b.items[0]?.serviceName}</Text></Table.Td>
    <Table.Td>{b.kind === 'RENTAL' ? <Text size="sm">{fmtDate(b.handedOverOn ?? b.startDate)} → {fmtDate(b.returnedOn ?? b.expectedReturnDate)}</Text> : '—'}</Table.Td></Table.Tr>)}</Table.Tbody></Table></div>
}
