import { useEffect, useState } from 'react'
import { Alert, Badge, Button, Card, Chip, Divider, Group, Loader, Modal, Select, SimpleGrid, Stack, Text, TextInput, Textarea, ThemeIcon, Timeline, Title } from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { useMediaQuery } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { IconBan, IconCalendarEvent, IconCalendarRepeat, IconCash, IconCircleCheck, IconEdit, IconFileInvoice, IconMessage, IconPrinter, IconRobot, IconX } from '@tabler/icons-react'
import { parlourApi, type Bill, type BookingLogEntry, type ParlourAppointment } from '../../../api/outletApi'
import { getAuthorName, setAuthorName } from '../../../components/authorName'
import { money, todayIso } from '../../../components/BillDetailsModal'
import { fmtDate, fmtDateTime } from '../../../config/dateFormat'
import { canBillToday, cancelReasons, fail, isOverdueToday, quickTimes, servicesText, statusColor, statusLabel, timeLabel, timeOptions } from './shared'

/** Mantine popups default to layer 200; this window sits below them so the bill, slip and actions opened from it always show on top. */
const DETAILS_LAYER = 150
const logIcon: Record<BookingLogEntry['kind'], typeof IconCash> = { CREATED: IconCalendarEvent, EDIT: IconEdit, DONE: IconCircleCheck, CANCELLED: IconBan, RESCHEDULED: IconCalendarRepeat, AUTO_CANCELLED: IconRobot, COMMENT: IconMessage, HANDED_OVER: IconCircleCheck, RETURNED: IconCircleCheck, REPAIR: IconEdit }
const logColor: Partial<Record<BookingLogEntry['kind'], string>> = { DONE: 'teal', CANCELLED: 'red', RESCHEDULED: 'violet', AUTO_CANCELLED: 'orange', COMMENT: 'yellow' }

/** One booking: services, status, bill, actions (bill, cancel, cancel & reschedule), and its timeline with comments. */
export function AppointmentDetailsModal({ id, onClose, onChanged, onBill, onOpenBill, onPrintSlip, onOpen }: {
  id: number | null; onClose: () => void; onChanged: () => void
  onBill: (a: ParlourAppointment) => void; onOpenBill: (b: Bill) => void; onPrintSlip: (a: ParlourAppointment) => void; onOpen: (id: number) => void
}) {
  const mobile = useMediaQuery('(max-width: 48em)')
  const [a, setA] = useState<ParlourAppointment | null>(null)
  const [log, setLog] = useState<BookingLogEntry[]>([])
  const [error, setError] = useState(false)
  const [action, setAction] = useState<null | 'cancel' | 'reschedule'>(null)
  const [comment, setComment] = useState('')
  const [author, setAuthor] = useState(getAuthorName() ?? '')
  const [posting, setPosting] = useState(false)

  const load = (bid: number) => { setError(false); Promise.all([parlourApi.get(bid), parlourApi.log(bid)]).then(([x, l]) => { setA(x); setLog(l) }).catch(() => setError(true)) }
  useEffect(() => { setA(null); setLog([]); setComment(''); if (id) load(id) }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const postComment = async () => {
    if (!a || !comment.trim()) return
    setPosting(true); setAuthorName(author)
    try { setLog(await parlourApi.comment(a.id, comment.trim(), author.trim() || undefined)); setComment(''); notifications.show({ color: 'green', message: 'Comment added' }) }
    catch (e) { fail('Could not add the comment')(e) } finally { setPosting(false) }
  }

  if (!id) return null
  return <Modal opened onClose={onClose} title={a ? `Booking ${a.bookingNumber}` : 'Booking'} size="lg" fullScreen={mobile} centered zIndex={DETAILS_LAYER}>
    {error && <Alert color="red" title="Something went wrong">We could not open this booking. <Button size="xs" variant="light" ml="sm" onClick={() => load(id)}>Try again</Button></Alert>}
    {!a && !error && <Group justify="center" py="xl"><Loader size="sm" /><Text c="dimmed">Loading booking…</Text></Group>}
    {a && <Stack>
      <Group justify="space-between" align="flex-start">
        <div><Title order={3}>{a.customerName}</Title><Text c="dimmed">{a.customerMobile}</Text></div>
        <Badge size="lg" variant="light" color={statusColor(a)}>{statusLabel(a)}</Badge>
      </Group>
      <Card withBorder radius="md" padding="md">
        <Text fw={800} size="lg">{fmtDate(a.date)} · {timeLabel(a.time)}{isOverdueToday(a) && <Badge ml="sm" color="orange" variant="light">Not done yet</Badge>}</Text>
        <Text mt={4}>{servicesText(a)}</Text>
        <Text size="sm" c="dimmed">Estimated amount {money(a.estimate)}{a.notes ? ` · Note: ${a.notes}` : ''}</Text>
        {a.cancelReason && <Text size="sm" c={a.autoCancelled ? 'orange' : 'red'} mt={4}>{a.autoCancelled ? 'Cancelled by the system: ' : 'Cancelled: '}{a.cancelReason}</Text>}
        {a.rescheduledTo && <Button variant="subtle" size="compact-sm" mt={4} onClick={() => void parlourApi.lookup(a.rescheduledTo!).then((n) => onOpen(n.id))}>Open the new booking {a.rescheduledTo}</Button>}
        {a.rescheduledFrom && <Text size="sm" c="dimmed" mt={4}>Rescheduled from {a.rescheduledFrom}</Text>}
        {a.bill && <Button variant="light" mt="sm" leftSection={<IconFileInvoice size={16} />} onClick={() => onOpenBill(a.bill!)}>Bill {a.bill.billNumber} · {money(a.bill.total)}</Button>}
      </Card>

      {a.status === 'BOOKED' && <Stack gap="xs">
        {canBillToday(a)
          ? <Button size="lg" color="teal" leftSection={<IconCash size={20} />} onClick={() => onBill(a)}>Customer arrived → Bill</Button>
          : a.date > todayIso() && <Text size="sm" c="dimmed">This booking can be billed on {fmtDate(a.date)}.</Text>}
        <Group grow>
          <Button variant="light" leftSection={<IconCalendarRepeat size={17} />} onClick={() => setAction('reschedule')}>Cancel &amp; reschedule</Button>
          <Button variant="light" color="red" leftSection={<IconX size={17} />} onClick={() => setAction('cancel')}>Cancel</Button>
        </Group>
      </Stack>}
      <Group justify="flex-end"><Button variant="default" leftSection={<IconPrinter size={17} />} onClick={() => onPrintSlip(a)}>Print slip</Button></Group>

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
          <Textarea placeholder="e.g. Customer prefers the same beautician" autosize minRows={2} maxRows={5} value={comment} onChange={(e) => setComment(e.currentTarget.value)} maxLength={1000} />
          <Group align="flex-end" wrap="wrap">
            <TextInput style={{ flex: 1, minWidth: 180 }} label="Your name" placeholder="Optional, remembered on this device" value={author} onChange={(e) => setAuthor(e.currentTarget.value)} maxLength={150} />
            <Button leftSection={<IconMessage size={16} />} loading={posting} disabled={!comment.trim()} onClick={() => void postComment()}>Add comment</Button>
          </Group>
        </Stack>
      </Card>
    </Stack>}

    <CancelModal a={action === 'cancel' ? a : null} onClose={() => setAction(null)} onDone={(x) => { setAction(null); setA(x); parlourApi.log(x.id).then(setLog).catch(() => undefined); onChanged(); notifications.show({ color: 'green', message: 'Booking cancelled' }) }} />
    <RescheduleModal a={action === 'reschedule' ? a : null} onClose={() => setAction(null)} onDone={(next) => { setAction(null); onChanged(); notifications.show({ color: 'green', title: 'Rescheduled', message: `New booking ${next.bookingNumber} on ${fmtDate(next.date)} ${timeLabel(next.time)}` }); onOpen(next.id); onPrintSlip(next) }} />
  </Modal>
}

function CancelModal({ a, onClose, onDone }: { a: ParlourAppointment | null; onClose: () => void; onDone: (a: ParlourAppointment) => void }) {
  const [reason, setReason] = useState<string | null>(cancelReasons[0])
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => { setReason(cancelReasons[0]); setComment('') }, [a])
  if (!a) return null
  const save = async () => {
    setSaving(true)
    try { onDone(await parlourApi.cancel(a.id, { reason: reason!, comment: comment.trim() || undefined, authorName: getAuthorName() })) } catch (e) { fail('Could not cancel')(e) } finally { setSaving(false) }
  }
  return <Modal opened onClose={onClose} title={`Cancel ${a.bookingNumber}`} centered>
    <Stack>
      <Text>{a.customerName} · {fmtDate(a.date)} {timeLabel(a.time)}</Text>
      <Select label="Reason" data={cancelReasons} value={reason} onChange={setReason} allowDeselect={false} comboboxProps={{ withinPortal: true }} />
      <Textarea label="Comment" placeholder={reason === 'Other' ? 'Please explain' : 'Optional'} autosize minRows={2} value={comment} onChange={(e) => setComment(e.currentTarget.value)} maxLength={500} />
      <Group justify="flex-end"><Button variant="default" onClick={onClose}>Back</Button><Button color="red" loading={saving} disabled={!reason || (reason === 'Other' && !comment.trim())} onClick={() => void save()}>Cancel booking</Button></Group>
    </Stack>
  </Modal>
}

/** Cancels this booking and books the same services for the new day and time. */
function RescheduleModal({ a, onClose, onDone }: { a: ParlourAppointment | null; onClose: () => void; onDone: (next: ParlourAppointment) => void }) {
  const [date, setDate] = useState<string | null>(null)
  const [time, setTime] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  useEffect(() => { setDate(a ? (a.date < todayIso() ? todayIso() : a.date) : null); setTime(a?.time?.slice(0, 5) ?? null) }, [a])
  if (!a) return null
  const save = async () => {
    setSaving(true)
    try { onDone(await parlourApi.cancelAndReschedule(a.id, { date: date!, time: time!, authorName: getAuthorName() })) } catch (e) { fail('Could not reschedule')(e) } finally { setSaving(false) }
  }
  return <Modal opened onClose={onClose} title={`Cancel & reschedule ${a.bookingNumber}`} centered>
    <Stack>
      <Text>{a.customerName} · {servicesText(a)}</Text>
      <Text size="sm" c="dimmed">This booking is cancelled and a new booking with the same services is made for the new day and time.</Text>
      <SimpleGrid cols={{ base: 1, xs: 2 }}>
        <DateInput label="New date" value={date} onChange={setDate} minDate={todayIso()} />
        <Select label="New time" data={timeOptions} value={time} onChange={setTime} searchable comboboxProps={{ withinPortal: true }} />
      </SimpleGrid>
      <Chip.Group value={time ?? ''} onChange={(v) => setTime(typeof v === 'string' ? v : null)}><Group gap="xs">{quickTimes.map((t) => <Chip key={t} value={t}>{timeLabel(t)}</Chip>)}</Group></Chip.Group>
      <Group justify="flex-end"><Button variant="default" onClick={onClose}>Back</Button><Button leftSection={<IconCalendarRepeat size={17} />} loading={saving} disabled={!date || !time} onClick={() => void save()}>Cancel &amp; reschedule</Button></Group>
    </Stack>
  </Modal>
}
