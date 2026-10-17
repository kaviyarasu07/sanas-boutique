import { useEffect, useState } from 'react'
import { Alert, Badge, Button, Card, Divider, Group, Loader, Menu, Modal, Select, SimpleGrid, Stack, Text, TextInput, Textarea, ThemeIcon, Timeline, Title } from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { useMediaQuery } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { IconArrowBackUp, IconBan, IconCalendarEvent, IconCalendarRepeat, IconCash, IconCircleCheck, IconEdit, IconFileInvoice, IconHandFinger, IconMessage, IconPrinter, IconRobot, IconTool, IconX } from '@tabler/icons-react'
import { rentalApi, type Bill, type BookingLogEntry, type RentalBooking } from '../../../api/outletApi'
import { getAuthorName, setAuthorName } from '../../../components/authorName'
import { money, todayIso } from '../../../components/BillDetailsModal'
import { fmtDate, fmtDateTime } from '../../../config/dateFormat'
import type { RentalPaper } from './RentalPrint'
import { cancelReasons, daysText, fail, statusColor, statusLabel } from './shared'

/** Mantine popups default to layer 200; this window sits below them so the bill, papers and actions opened from it always show on top. */
const DETAILS_LAYER = 150
const logIcon: Record<BookingLogEntry['kind'], typeof IconCash> = { CREATED: IconCalendarEvent, EDIT: IconEdit, DONE: IconCircleCheck, CANCELLED: IconBan, RESCHEDULED: IconCalendarRepeat, AUTO_CANCELLED: IconRobot, COMMENT: IconMessage, HANDED_OVER: IconHandFinger, RETURNED: IconArrowBackUp, REPAIR: IconTool }
const logColor: Partial<Record<BookingLogEntry['kind'], string>> = { HANDED_OVER: 'orange', RETURNED: 'teal', CANCELLED: 'red', RESCHEDULED: 'violet', AUTO_CANCELLED: 'gray', COMMENT: 'yellow', REPAIR: 'grape' }

/** One rental: pieces, dates, status, papers, actions (hand over, return, cancel, cancel & reschedule) and the timeline with comments. */
export function RentalDetailsModal({ id, onClose, onChanged, onHandOver, onReturn, onOpenBill, onPrint, onOpen }: {
  id: number | null; onClose: () => void; onChanged: () => void
  onHandOver: (b: RentalBooking) => void; onReturn: (b: RentalBooking) => void; onOpenBill: (b: Bill) => void; onPrint: (p: RentalPaper) => void; onOpen: (id: number) => void
}) {
  const mobile = useMediaQuery('(max-width: 48em)')
  const [b, setB] = useState<RentalBooking | null>(null)
  const [log, setLog] = useState<BookingLogEntry[]>([])
  const [error, setError] = useState(false)
  const [action, setAction] = useState<null | 'cancel' | 'reschedule'>(null)
  const [comment, setComment] = useState('')
  const [author, setAuthor] = useState(getAuthorName() ?? '')
  const [posting, setPosting] = useState(false)

  const load = (bid: number) => { setError(false); Promise.all([rentalApi.get(bid), rentalApi.log(bid)]).then(([x, l]) => { setB(x); setLog(l) }).catch(() => setError(true)) }
  useEffect(() => { setB(null); setLog([]); setComment(''); if (id) load(id) }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const postComment = async () => {
    if (!b || !comment.trim()) return
    setPosting(true); setAuthorName(author)
    try { setLog(await rentalApi.comment(b.id, comment.trim(), author.trim() || undefined)); setComment(''); notifications.show({ color: 'green', message: 'Comment added' }) }
    catch (e) { fail('Could not add the comment')(e) } finally { setPosting(false) }
  }

  if (!id) return null
  const late = b?.status === 'WITH_CUSTOMER' && b.returnDate < todayIso()
  return <Modal opened onClose={onClose} title={b ? `Rental ${b.bookingNumber}` : 'Rental'} size="lg" fullScreen={mobile} centered zIndex={DETAILS_LAYER}>
    {error && <Alert color="red" title="Something went wrong">We could not open this rental. <Button size="xs" variant="light" ml="sm" onClick={() => load(id)}>Try again</Button></Alert>}
    {!b && !error && <Group justify="center" py="xl"><Loader size="sm" /><Text c="dimmed">Loading…</Text></Group>}
    {b && <Stack>
      <Group justify="space-between" align="flex-start">
        <div><Title order={3}>{b.customerName}</Title><Text c="dimmed">{b.customerMobile}</Text></div>
        <Stack gap={4} align="flex-end"><Badge size="lg" variant="light" color={statusColor(b)}>{statusLabel(b)}</Badge>{late && <Badge color="red" variant="light">Late</Badge>}</Stack>
      </Group>
      <Card withBorder radius="md" padding="md">
        <Text fw={800} size="lg">{fmtDate(b.handedOverOn ?? b.startDate)} → {fmtDate(b.returnedOn ?? b.returnDate)}</Text>
        <Text size="sm" c="dimmed">{daysText(b.days)} · {b.status === 'RETURNED' ? 'billed' : 'estimate'} {money(b.bill?.total ?? b.estimate)}{b.notes ? ` · Note: ${b.notes}` : ''}</Text>
        <Stack gap={4} mt="sm">{b.items.map((i) => <Group key={i.itemId} justify="space-between" wrap="nowrap">
          <Text>{i.name}{i.quantity > 1 ? ` × ${i.quantity}` : ''} {i.addedQty > 0 && <Badge size="xs" variant="light" color="violet">{i.addedQty === i.quantity ? 'added' : `${i.addedQty} added`}</Badge>}</Text>
          <Text size="sm" c="dimmed">{i.okQty != null ? [i.okQty && `${i.okQty} OK`, i.damagedQty && `${i.damagedQty} damaged${i.repairQty ? ` (${i.repairQty} to repair)` : ''}`, i.missingQty && `${i.missingQty} missing`].filter(Boolean).join(' · ') : `${money(i.pricePerDay)}/day`}</Text>
        </Group>)}</Stack>
        {b.cancelReason && <Text size="sm" c={b.autoCancelled ? 'gray' : 'red'} mt="sm">{b.autoCancelled ? 'Cancelled by the system: ' : 'Cancelled: '}{b.cancelReason}</Text>}
        {b.rescheduledTo && <Button variant="subtle" size="compact-sm" mt={4} onClick={() => void rentalApi.lookup(b.rescheduledTo!).then((n) => onOpen(n.id))}>Open the new booking {b.rescheduledTo}</Button>}
        {b.rescheduledFrom && <Text size="sm" c="dimmed" mt={4}>Rescheduled from {b.rescheduledFrom}</Text>}
        {b.bill && <Button variant="light" mt="sm" leftSection={<IconFileInvoice size={16} />} onClick={() => onOpenBill(b.bill!)}>Bill {b.bill.billNumber} · {money(b.bill.total)}</Button>}
      </Card>

      {b.status === 'BOOKED' && <Stack gap="xs">
        <Button size="lg" color="violet" leftSection={<IconHandFinger size={20} />} onClick={() => onHandOver(b)}>{b.startDate > todayIso() ? 'Customer came early → Hand over' : 'Hand over'}</Button>
        <Group grow>
          <Button variant="light" leftSection={<IconCalendarRepeat size={17} />} onClick={() => setAction('reschedule')}>Cancel &amp; reschedule</Button>
          <Button variant="light" color="red" leftSection={<IconX size={17} />} onClick={() => setAction('cancel')}>Cancel</Button>
        </Group>
      </Stack>}
      {b.status === 'WITH_CUSTOMER' && <Button size="lg" color="teal" leftSection={<IconArrowBackUp size={20} />} onClick={() => onReturn(b)}>Return &amp; bill</Button>}
      <Group justify="flex-end">
        <Menu position="bottom-end" withinPortal>
          <Menu.Target><Button variant="default" leftSection={<IconPrinter size={17} />}>Print</Button></Menu.Target>
          <Menu.Dropdown>
            <Menu.Item onClick={() => onPrint({ kind: 'slip', booking: b })}>Booking slip</Menu.Item>
            {b.challan && <Menu.Item onClick={() => onPrint({ kind: 'challan', booking: b })}>Delivery challan</Menu.Item>}
          </Menu.Dropdown>
        </Menu>
      </Group>

      <Card withBorder radius="md" padding="md">
        <Title order={4} mb="sm">Timeline</Title>
        {log.length === 0 ? <Text c="dimmed" size="sm">No history yet.</Text> : <Timeline bulletSize={28} lineWidth={2} active={log.length}>{log.map((l) => {
          const Icon = logIcon[l.kind]
          return <Timeline.Item key={l.id} color={logColor[l.kind] ?? 'gray'} bullet={<ThemeIcon size={28} radius="xl" variant="light" color={logColor[l.kind] ?? 'gray'}><Icon size={15} /></ThemeIcon>} title={<Text size="sm" fw={l.kind === 'COMMENT' ? 500 : 600} fs={l.kind === 'COMMENT' ? 'italic' : undefined}>{l.kind === 'COMMENT' ? `“${l.message}”` : l.message}</Text>}>
            <Text size="xs" c="dimmed">{fmtDateTime(l.createdAt)} · {l.authorName}</Text>
          </Timeline.Item>
        })}</Timeline>}
        <Divider my="md" label="Add a comment (not shown on bills)" labelPosition="left" />
        <Stack gap="xs">
          <Textarea placeholder="e.g. Customer will send her sister to return" autosize minRows={2} maxRows={5} value={comment} onChange={(e) => setComment(e.currentTarget.value)} maxLength={1000} />
          <Group align="flex-end" wrap="wrap">
            <TextInput style={{ flex: 1, minWidth: 180 }} label="Your name" placeholder="Optional, remembered on this device" value={author} onChange={(e) => setAuthor(e.currentTarget.value)} maxLength={150} />
            <Button leftSection={<IconMessage size={16} />} loading={posting} disabled={!comment.trim()} onClick={() => void postComment()}>Add comment</Button>
          </Group>
        </Stack>
      </Card>
    </Stack>}

    <CancelModal b={action === 'cancel' ? b : null} onClose={() => setAction(null)} onDone={(x) => { setAction(null); setB(x); rentalApi.log(x.id).then(setLog).catch(() => undefined); onChanged(); notifications.show({ color: 'green', message: 'Booking cancelled' }) }} />
    <RescheduleModal b={action === 'reschedule' ? b : null} onClose={() => setAction(null)} onDone={(next) => { setAction(null); onChanged(); notifications.show({ color: 'green', title: 'Rescheduled', message: `New booking ${next.bookingNumber}: ${fmtDate(next.startDate)} → ${fmtDate(next.returnDate)}` }); onOpen(next.id); onPrint({ kind: 'slip', booking: next }) }} />
  </Modal>
}

function CancelModal({ b, onClose, onDone }: { b: RentalBooking | null; onClose: () => void; onDone: (b: RentalBooking) => void }) {
  const [reason, setReason] = useState<string | null>(cancelReasons[0])
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => { setReason(cancelReasons[0]); setComment('') }, [b])
  if (!b) return null
  const save = async () => {
    setSaving(true)
    try { onDone(await rentalApi.cancel(b.id, { reason: reason!, comment: comment.trim() || undefined, authorName: getAuthorName() })) } catch (e) { fail('Could not cancel')(e) } finally { setSaving(false) }
  }
  return <Modal opened onClose={onClose} title={`Cancel ${b.bookingNumber}`} centered>
    <Stack>
      <Text>{b.customerName} · {fmtDate(b.startDate)} → {fmtDate(b.returnDate)}</Text>
      <Select label="Reason" data={cancelReasons} value={reason} onChange={setReason} allowDeselect={false} comboboxProps={{ withinPortal: true }} />
      <Textarea label="Comment" placeholder={reason === 'Other' ? 'Please explain' : 'Optional'} autosize minRows={2} value={comment} onChange={(e) => setComment(e.currentTarget.value)} maxLength={500} />
      <Group justify="flex-end"><Button variant="default" onClick={onClose}>Back</Button><Button color="red" loading={saving} disabled={!reason || (reason === 'Other' && !comment.trim())} onClick={() => void save()}>Cancel booking</Button></Group>
    </Stack>
  </Modal>
}

/** Cancels this pre-booking and books the same pieces for new dates (checked free again). */
function RescheduleModal({ b, onClose, onDone }: { b: RentalBooking | null; onClose: () => void; onDone: (next: RentalBooking) => void }) {
  const [start, setStart] = useState<string | null>(null)
  const [end, setEnd] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  useEffect(() => { setStart(null); setEnd(null) }, [b])
  if (!b) return null
  const save = async () => {
    setSaving(true)
    try { onDone(await rentalApi.cancelAndReschedule(b.id, { startDate: start!, returnDate: end!, authorName: getAuthorName() })) } catch (e) { fail('Could not reschedule')(e) } finally { setSaving(false) }
  }
  return <Modal opened onClose={onClose} title={`Cancel & reschedule ${b.bookingNumber}`} centered>
    <Stack>
      <Text size="sm" c="dimmed">This booking is cancelled and the same pieces are booked for the new dates (if they are free).</Text>
      <SimpleGrid cols={{ base: 1, xs: 2 }}>
        <DateInput label="New take-away date" value={start} onChange={setStart} minDate={todayIso()} />
        <DateInput label="New return date" value={end} onChange={setEnd} minDate={start ?? todayIso()} />
      </SimpleGrid>
      <Group justify="flex-end"><Button variant="default" onClick={onClose}>Back</Button><Button leftSection={<IconCalendarRepeat size={17} />} loading={saving} disabled={!start || !end || end < start} onClick={() => void save()}>Cancel &amp; reschedule</Button></Group>
    </Stack>
  </Modal>
}
