import { useEffect, useRef, useState } from 'react'
import { Alert, Badge, Button, Card, Group, Modal, NumberInput, Pagination, Stack, Table, Tabs, Text, TextInput, Title } from '@mantine/core'
import { DateInput, TimeInput } from '@mantine/dates'
import { useDebouncedValue } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { IconCalendarPlus, IconChevronLeft, IconChevronRight, IconSearch, IconTrash } from '@tabler/icons-react'
import { extractErrorMessage } from '../../api/catalogApi'
import { bookingApi, type Availability, type Bill, type Booking, type BookingPage, type BookingView, type OutletServiceItem } from '../../api/outletApi'
import { BillDetailsModal, money, todayIso } from '../../components/BillDetailsModal'
import { CustomerPicker, emptyCustomer, type PickedCustomer } from '../../components/CustomerPicker'
import { ItemPicker } from '../../components/ItemPicker'
import { eventsOn } from '../../components/BookingDayList'
import { fmtDate } from '../../config/dateFormat'

type Tab = BookingView | 'DAY'
type ActionKind = 'handOver' | 'return' | 'complete'

const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T00:00:00`); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
/** Days charged for a rental: return date minus hand-over date, at least 1 (the server uses the same rule). */
const rentalDays = (from: string, to: string) => Math.max(1, Math.round((new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86400000))
const statusColor: Record<Booking['status'], string> = { BOOKED: 'blue', HANDED_OVER: 'orange', COMPLETED: 'teal', CANCELLED: 'gray' }
const statusLabel: Record<Booking['status'], string> = { BOOKED: 'Booked', HANDED_OVER: 'With customer', COMPLETED: 'Completed', CANCELLED: 'Cancelled' }
const kindLabel: Record<Booking['kind'], string> = { RENTAL: 'Rental', APPOINTMENT: 'Appointment', DELIVERY: 'Delivery' }
const itemsText = (b: Booking) => b.items.map((i) => (i.quantity > 1 ? `${i.name} × ${i.quantity}` : i.name)).join(', ')

export function BookingsPage() {
  const [tab, setTab] = useState<Tab>('UPCOMING')
  const [data, setData] = useState<BookingPage | null>(null)
  const [dayList, setDayList] = useState<Booking[]>([])
  const [day, setDay] = useState<string>(todayIso())
  const [search, setSearch] = useState('')
  const [debounced] = useDebouncedValue(search.trim(), 300)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [action, setAction] = useState<{ booking: Booking; kind: ActionKind } | null>(null)
  const [rescheduling, setRescheduling] = useState<Booking | null>(null)
  const [bill, setBill] = useState<Bill | null>(null)

  const fail = (title: string) => (e: unknown) => notifications.show({ color: 'red', title, message: extractErrorMessage(e) })
  // Only the newest request may update the screen, so a slow old response cannot overwrite a newer one.
  const latest = useRef(0)
  const load = () => {
    const id = ++latest.current
    const current = () => id === latest.current
    setLoading(true)
    const done = () => { if (current()) setLoading(false) }
    if (tab === 'DAY') void bookingApi.day(day).then((r) => { if (current()) setDayList(r) }).catch((e) => { if (current()) fail('Could not load the day')(e) }).finally(done)
    else void bookingApi.list({ view: tab, search: debounced, page }).then((r) => { if (current()) setData(r) }).catch((e) => { if (current()) fail('Could not load bookings')(e) }).finally(done)
  }
  useEffect(() => { setPage(0) }, [tab, debounced])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [tab, debounced, page, day])

  const cancel = async (b: Booking) => {
    if (!window.confirm(`Cancel the booking for ${b.customerName}?`)) return
    try { await bookingApi.cancel(b.id); notifications.show({ color: 'green', message: 'Booking cancelled' }); load() } catch (e) { fail('Could not cancel')(e) }
  }

  const rows = tab === 'DAY' ? dayList : data?.content ?? []
  const table = <BookingTable bookings={rows} day={tab === 'DAY' ? day : null} past={tab === 'PAST'} onAction={(booking, kind) => setAction({ booking, kind })} onCancel={(b) => void cancel(b)} onReschedule={setRescheduling} onBill={setBill} />

  return <Stack gap="lg">
    <Group justify="space-between"><div><Title order={2}>Bookings</Title><Text c="dimmed" size="sm">Pre-book jewellery rentals, parlour appointments, stitching deliveries and more.</Text></div><Button size="md" leftSection={<IconCalendarPlus size={18} />} onClick={() => setCreating(true)}>New booking</Button></Group>
    <Tabs value={tab} onChange={(v) => setTab((v ?? 'UPCOMING') as Tab)}><Tabs.List><Tabs.Tab value="DAY">By day</Tabs.Tab><Tabs.Tab value="UPCOMING">Upcoming</Tabs.Tab><Tabs.Tab value="ACTIVE">With customer</Tabs.Tab><Tabs.Tab value="PAST">Past</Tabs.Tab></Tabs.List></Tabs>
    <Card withBorder>
      {tab === 'DAY' ? <Group align="end" wrap="wrap">
        <Button variant="default" onClick={() => setDay(addDays(day, -1))} aria-label="Previous day"><IconChevronLeft size={16} /></Button>
        <DateInput label="Day" value={day} onChange={(v) => v && setDay(v)} />
        <Button variant="default" onClick={() => setDay(addDays(day, 1))} aria-label="Next day"><IconChevronRight size={16} /></Button>
        <Button variant="light" onClick={() => setDay(todayIso())}>Today</Button>
        <Text c="dimmed" size="sm">{dayList.length} on this day</Text>
      </Group> : <TextInput placeholder="Search by customer name or mobile" leftSection={<IconSearch size={16} />} value={search} onChange={(e) => setSearch(e.currentTarget.value)} />}
      {rows.length ? table : <Text c="dimmed" mt="md">{loading ? 'Loading bookings…' : tab === 'DAY' ? 'Nothing booked for this day.' : 'No bookings here.'}</Text>}
      {tab !== 'DAY' && data && data.totalPages > 1 && <Group justify="center" mt="md"><Pagination value={page + 1} total={data.totalPages} onChange={(n) => setPage(n - 1)} /></Group>}
    </Card>
    <NewBookingModal opened={creating} onClose={() => setCreating(false)} onSaved={(startDate) => { setCreating(false); setDay(startDate); setTab('DAY'); load() }} />
    <ActionModal state={action} onClose={() => setAction(null)} onDone={(b, kind) => { setAction(null); load(); setBill(kind === 'handOver' ? b.challan : b.bill) }} />
    <RescheduleModal booking={rescheduling} onClose={() => setRescheduling(null)} onDone={() => { setRescheduling(null); load() }} />
    <BillDetailsModal bill={bill} onClose={() => setBill(null)} />
  </Stack>
}

function BookingTable({ bookings, day, past, onAction, onCancel, onReschedule, onBill }: { bookings: Booking[]; day: string | null; past: boolean; onAction: (b: Booking, k: ActionKind) => void; onCancel: (b: Booking) => void; onReschedule: (b: Booking) => void; onBill: (b: Bill) => void }) {
  return <div style={{ overflowX: 'auto' }}><Table highlightOnHover mt="md"><Table.Thead><Table.Tr>{day && <Table.Th>What</Table.Th>}<Table.Th>Customer</Table.Th><Table.Th>Items</Table.Th><Table.Th>When</Table.Th><Table.Th>Status</Table.Th><Table.Th>{past ? 'Billed' : 'Estimate'}</Table.Th><Table.Th /></Table.Tr></Table.Thead><Table.Tbody>{bookings.map((b) => <Table.Tr key={b.id}>
    {day && <Table.Td>{eventsOn(b, day).map((e) => <Badge key={e} mr={4} variant="dot">{e}</Badge>)}</Table.Td>}
    <Table.Td><Text fw={600}>{b.customerName}</Text><Text size="xs" c="dimmed">{b.customerMobile}</Text></Table.Td>
    <Table.Td>{itemsText(b)}<Text size="xs" c="dimmed">{kindLabel[b.kind]}{b.items[0] ? ` · ${b.items[0].serviceName}` : ''}</Text></Table.Td>
    <Table.Td>{b.kind === 'RENTAL' ? <>{fmtDate(b.handedOverOn ?? b.startDate)} → {fmtDate(b.returnedOn ?? b.expectedReturnDate)}{b.status === 'HANDED_OVER' && <Text size="xs" c="dimmed">due back {fmtDate(b.expectedReturnDate)}</Text>}</> : <>{fmtDate(b.startDate)}{b.startTime ? ` ${b.startTime.slice(0, 5)}` : ''}</>}</Table.Td>
    <Table.Td><Badge variant="light" color={statusColor[b.status]}>{statusLabel[b.status]}</Badge></Table.Td>
    <Table.Td>{b.status === 'CANCELLED' ? '—' : money(b.bill?.total ?? b.estimatedAmount)}</Table.Td>
    <Table.Td><Group gap="xs" wrap="nowrap" justify="flex-end">
      {b.kind === 'RENTAL' && b.status === 'BOOKED' && <Button size="xs" onClick={() => onAction(b, 'handOver')}>Hand over</Button>}
      {b.kind === 'RENTAL' && b.status === 'HANDED_OVER' && <Button size="xs" color="teal" onClick={() => onAction(b, 'return')}>Return &amp; bill</Button>}
      {b.kind !== 'RENTAL' && b.status === 'BOOKED' && <Button size="xs" color="teal" onClick={() => onAction(b, 'complete')}>{b.kind === 'DELIVERY' ? 'Deliver & bill' : 'Complete & bill'}</Button>}
      {b.status === 'BOOKED' && <Button size="xs" variant="light" onClick={() => onReschedule(b)}>Reschedule</Button>}
      {b.status === 'BOOKED' && <Button size="xs" variant="subtle" color="red" onClick={() => onCancel(b)}>Cancel</Button>}
      {b.challan && <Button size="xs" variant="light" onClick={() => onBill(b.challan!)}>Challan</Button>}
      {b.bill && <Button size="xs" variant="light" onClick={() => onBill(b.bill!)}>Bill</Button>}
    </Group></Table.Td></Table.Tr>)}</Table.Tbody></Table></div>
}

function ActionModal({ state, onClose, onDone }: { state: { booking: Booking; kind: ActionKind } | null; onClose: () => void; onDone: (b: Booking, kind: ActionKind) => void }) {
  const [date, setDate] = useState<string | null>(todayIso())
  const [discount, setDiscount] = useState<number | string>(0)
  const [saving, setSaving] = useState(false)
  useEffect(() => { setDate(todayIso()); setDiscount(0) }, [state])
  const b = state?.booking
  if (!b || !state) return <Modal opened={false} onClose={onClose} title="" />
  const perDay = b.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
  const days = state.kind === 'return' && b.handedOverOn && date ? rentalDays(b.handedOverOn, date) : 0
  const subtotal = state.kind === 'return' ? perDay * days : perDay
  const title = state.kind === 'handOver' ? 'Hand over to customer' : state.kind === 'return' ? 'Return rental & bill' : b.kind === 'DELIVERY' ? 'Deliver order & bill' : 'Complete appointment & bill'
  const submit = async () => {
    setSaving(true)
    try {
      const result = state.kind === 'handOver' ? await bookingApi.handOver(b.id, date ?? undefined) : state.kind === 'return' ? await bookingApi.returnRental(b.id, date ?? undefined, Number(discount) || 0) : await bookingApi.complete(b.id, Number(discount) || 0)
      notifications.show({ color: 'green', message: state.kind === 'handOver' ? `Handed over · challan ${result.challan?.billNumber ?? ''}` : `Billed ${result.bill?.billNumber ?? ''}` }); onDone(result, state.kind)
    } catch (e) { notifications.show({ color: 'red', title: 'Could not save', message: extractErrorMessage(e) }) } finally { setSaving(false) }
  }
  return <Modal opened onClose={onClose} title={title} centered><Stack>
    <Text><b>{b.customerName}</b> · {itemsText(b)}</Text>
    {state.kind !== 'complete' && <DateInput label={state.kind === 'handOver' ? 'Hand-over date' : 'Return date'} value={date} onChange={setDate} minDate={state.kind === 'return' ? b.handedOverOn ?? undefined : undefined} maxDate={state.kind === 'return' ? todayIso() : b.expectedReturnDate ?? undefined} />}
    {state.kind === 'handOver' && <Alert variant="light">A delivery challan (no amount) is issued now and the stock goes out. The rental is billed when it is returned.</Alert>}
    {state.kind === 'return' && <Alert variant="light">Handed over {fmtDate(b.handedOverOn)} · returned {fmtDate(date)} = <b>{days} day{days === 1 ? '' : 's'}</b> × {money(perDay)} per day. The stock is added back.</Alert>}
    {state.kind !== 'handOver' && <><NumberInput label="Discount" min={0} max={subtotal} value={discount} onChange={setDiscount} prefix="₹" /><Group justify="space-between"><Text fw={700}>Total to bill</Text><Text fw={800} size="lg">{money(Math.max(0, subtotal - (Number(discount) || 0)))}</Text></Group></>}
    <Group justify="flex-end"><Button variant="default" onClick={onClose}>Back</Button><Button loading={saving} disabled={state.kind !== 'complete' && !date} onClick={() => void submit()}>{state.kind === 'handOver' ? 'Hand over & issue challan' : 'Generate bill'}</Button></Group>
  </Stack></Modal>
}

function RescheduleModal({ booking, onClose, onDone }: { booking: Booking | null; onClose: () => void; onDone: () => void }) {
  const [start, setStart] = useState<string | null>(null)
  const [end, setEnd] = useState<string | null>(null)
  const [time, setTime] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => { if (booking) { setStart(booking.startDate); setEnd(booking.expectedReturnDate); setTime(booking.startTime?.slice(0, 5) ?? '') } }, [booking])
  if (!booking) return <Modal opened={false} onClose={onClose} title="" />
  const save = async () => {
    setSaving(true)
    try { await bookingApi.reschedule(booking.id, { startDate: start!, startTime: booking.kind === 'APPOINTMENT' ? time : undefined, expectedReturnDate: booking.kind === 'RENTAL' ? end ?? undefined : undefined }); notifications.show({ color: 'green', message: 'Booking rescheduled' }); onDone() }
    catch (e) { notifications.show({ color: 'red', title: 'Could not reschedule', message: extractErrorMessage(e) }) } finally { setSaving(false) }
  }
  return <Modal opened onClose={onClose} title="Change booking date" centered><Stack>
    <Text><b>{booking.customerName}</b> · {itemsText(booking)}</Text>
    <DateInput label={booking.kind === 'RENTAL' ? 'Hand-over date' : booking.kind === 'DELIVERY' ? 'Delivery date' : 'Appointment date'} value={start} onChange={setStart} minDate={todayIso()} />
    {booking.kind === 'RENTAL' && <DateInput label="Return date" value={end} onChange={setEnd} minDate={start ?? todayIso()} />}
    {booking.kind === 'APPOINTMENT' && <TimeInput label="Time" value={time} onChange={(e) => setTime(e.currentTarget.value)} />}
    <Group justify="flex-end"><Button variant="default" onClick={onClose}>Back</Button><Button loading={saving} disabled={!start || (booking.kind === 'APPOINTMENT' && !time)} onClick={() => void save()}>Save</Button></Group>
  </Stack></Modal>
}

type Line = { item: OutletServiceItem; quantity: number }

function NewBookingModal({ opened, onClose, onSaved }: { opened: boolean; onClose: () => void; onSaved: (startDate: string) => void }) {
  const [customer, setCustomer] = useState<PickedCustomer>(emptyCustomer)
  const [lines, setLines] = useState<Line[]>([])
  const [start, setStart] = useState<string | null>(todayIso())
  const [end, setEnd] = useState<string | null>(null)
  const [time, setTime] = useState('')
  const [notes, setNotes] = useState('')
  const [availability, setAvailability] = useState<Record<number, Availability | 'error'>>({})
  const [saving, setSaving] = useState(false)

  const mode = lines[0]?.item.bookingMode
  const rental = mode === 'RENTAL'
  const reset = () => { setCustomer(emptyCustomer); setLines([]); setStart(todayIso()); setEnd(null); setTime(''); setNotes(''); setAvailability({}) }
  const close = () => { reset(); onClose() }

  // Live availability of every rental piece for the chosen dates and quantity.
  const key = lines.map((l) => `${l.item.id}x${l.quantity}`).join(',')
  useEffect(() => {
    if (!rental || !start || !end || end < start) { setAvailability({}); return }
    let cancelled = false
    void Promise.all(lines.map((l) => bookingApi.availability(l.item.id, start, end, l.quantity).then((a) => [l.item.id, a] as const).catch(() => [l.item.id, 'error' as const] as const))).then((pairs) => { if (!cancelled) setAvailability(Object.fromEntries(pairs)) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, start, end, rental])

  const add = (item: OutletServiceItem) => {
    if (item.bookingMode === 'NONE') { notifications.show({ color: 'orange', message: `${item.name} cannot be pre-booked` }); return }
    if (lines.length && lines[0].item.bookingMode !== item.bookingMode) { notifications.show({ color: 'orange', message: 'Rentals, appointments and deliveries must be booked separately' }); return }
    if (lines.some((l) => l.item.id === item.id)) { setLines(lines.map((l) => l.item.id === item.id ? { ...l, quantity: l.quantity + 1 } : l)); return }
    setLines([...lines, { item, quantity: 1 }])
  }
  const setQty = (id: number, q: number) => setLines(lines.map((l) => l.item.id === id ? { ...l, quantity: Math.max(1, Math.floor(q) || 1) } : l))

  const unavailable = Object.values(availability).some((a) => a === 'error' || !a.available)
  const rentalReady = Boolean(start && end && end >= start) && Object.keys(availability).length === lines.length && !unavailable
  const customerOk = /^\d{10}$/.test(customer.mobile) && customer.name.trim().length > 0
  const canSave = customerOk && lines.length > 0 && Boolean(start) && (rental ? rentalReady : mode === 'APPOINTMENT' ? Boolean(time) : true)
  const perDay = lines.reduce((s, l) => s + l.item.price * l.quantity, 0)
  const days = rental && start && end && end >= start ? rentalDays(start, end) : 1
  const estimate = rental ? perDay * days : perDay

  const save = async () => {
    setSaving(true)
    try {
      await bookingApi.create({ customerName: customer.name.trim(), customerMobile: customer.mobile, startDate: start!, startTime: mode === 'APPOINTMENT' ? time : undefined, expectedReturnDate: rental ? end! : undefined, items: lines.map((l) => ({ itemId: l.item.id, quantity: l.quantity })), notes: notes.trim() || undefined })
      notifications.show({ color: 'green', title: 'Booking saved', message: `${customer.name.trim()} · ${mode?.toLowerCase()}` }); const d = start!; reset(); onSaved(d)
    } catch (e) { notifications.show({ color: 'red', title: 'Could not save booking', message: extractErrorMessage(e) }) } finally { setSaving(false) }
  }

  return <Modal opened={opened} onClose={close} title="New booking" size="xl" centered><Stack>
    <Card withBorder padding="sm"><CustomerPicker value={customer} onChange={setCustomer} /></Card>
    <Card withBorder padding="sm">
      <ItemPicker label="Add jewellery or service" onPick={add} isDisabled={(i) => i.bookingMode === 'NONE'} />
      {lines.length > 0 && <Table mt="sm"><Table.Thead><Table.Tr><Table.Th>Item</Table.Th><Table.Th>Price</Table.Th><Table.Th>Qty</Table.Th>{rental && <Table.Th>Availability</Table.Th>}<Table.Th /></Table.Tr></Table.Thead><Table.Tbody>{lines.map(({ item, quantity }) => { const a = availability[item.id]; return <Table.Tr key={item.id}>
        <Table.Td><Text fw={500}>{item.name}</Text><Text size="xs" c="dimmed">{item.serviceName}</Text></Table.Td>
        <Table.Td>{money(item.price)} <Text span size="xs" c="dimmed">{item.priceUnitName}</Text></Table.Td>
        <Table.Td><NumberInput w={80} size="xs" min={1} max={1000} allowDecimal={false} clampBehavior="strict" value={quantity} onChange={(v) => setQty(item.id, Number(v))} /></Table.Td>
        {rental && <Table.Td>{a && (a === 'error' ? <Badge color="gray">Check failed</Badge> : a.available ? <Badge color="teal" variant="light">Available</Badge> : <Badge color="red" variant="light">Unavailable</Badge>)}{a && a !== 'error' && !a.available && <Text size="xs" c="red">{a.reason}</Text>}{!a && <Text size="xs" c="dimmed">Pick dates</Text>}</Table.Td>}
        <Table.Td><Button variant="subtle" color="red" size="xs" onClick={() => setLines(lines.filter((l) => l.item.id !== item.id))}><IconTrash size={15} /></Button></Table.Td></Table.Tr> })}</Table.Tbody></Table>}
    </Card>
    {lines.length > 0 && <Card withBorder padding="sm"><Group grow align="start">
      <DateInput label={rental ? 'Hand-over date' : mode === 'DELIVERY' ? 'Delivery date' : 'Appointment date'} value={start} onChange={setStart} minDate={todayIso()} />
      {rental && <DateInput label="Return date" placeholder="Pick return date" value={end} onChange={setEnd} minDate={start ?? todayIso()} />}
      {mode === 'APPOINTMENT' && <TimeInput label="Time" value={time} onChange={(e) => setTime(e.currentTarget.value)} />}
    </Group>
      {rental && <Text size="xs" c="dimmed" mt="xs">A delivery challan (no amount) is issued at hand-over. The rental is billed on return: price per day × quantity × days (return date − hand-over date, minimum 1).</Text>}
      <TextInput mt="sm" label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.currentTarget.value)} maxLength={500} />
      <Group justify="space-between" mt="sm"><Text>{rental ? `Estimated rental · ${days} day${days === 1 ? '' : 's'}` : 'Estimated total'}</Text><Text fw={700}>{money(estimate)}</Text></Group></Card>}
    <Group justify="flex-end"><Button variant="default" onClick={close}>Cancel</Button><Button loading={saving} disabled={!canSave} onClick={() => void save()}>Save booking</Button></Group>
  </Stack></Modal>
}
