import { useEffect, useState } from 'react'
import { ActionIcon, Alert, Badge, Button, Card, Checkbox, Divider, Group, Loader, Menu, Modal, Select, SimpleGrid, Spoiler, Stack, Text, TextInput, Textarea, ThemeIcon, Timeline, Title } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { IconBan, IconCalendarEvent, IconCash, IconCircleCheck, IconEdit, IconFileInvoice, IconMessage, IconPencil, IconPlus, IconPrinter, IconProgress, IconReceiptRefund, IconScissors, IconTruckDelivery, IconX } from '@tabler/icons-react'
import { stitchApi, type Bill, type StitchItem, type StitchItemStatus, type StitchLogEntry, type StitchMeasurement, type StitchOrder } from '../../../api/outletApi'
import { BillDetailsModal, money, todayIso } from '../../../components/BillDetailsModal'
import { fmtDate, fmtDateTime } from '../../../config/dateFormat'
import { AdvanceModal, CancelModal, DeliverModal, GarmentModal, RefundModal } from './ActionModals'
import type { PrintJob } from './StitchPrint'
import { fabricLabel, fail, getAuthorName, isDueToday, isLate, isOpen, itemStatusColor, itemStatusLabel, openItems, progressOptions, progressText, setAuthorName } from './shared'

/** Mantine popups default to layer 200. Popups open in the order the page mounts them, so a later window could cover the bill or print preview; the order window sits below them instead. */
const ORDER_LAYER = 150
const logIcon: Record<StitchLogEntry['kind'], typeof IconCash> = { CREATED: IconScissors, STATUS: IconProgress, EDIT: IconEdit, ADVANCE: IconCash, DATE: IconCalendarEvent, DELIVERED: IconTruckDelivery, CANCELLED: IconBan, REFUND: IconReceiptRefund, COMMENT: IconMessage }
const logColor: Partial<Record<StitchLogEntry['kind'], string>> = { ADVANCE: 'teal', DELIVERED: 'violet', CANCELLED: 'red', REFUND: 'orange', COMMENT: 'yellow' }

/** One order: garments with their own status and date, money, bills, and the timeline with staff comments. */
export function OrderDetailsModal({ orderId, onClose, onChanged, onPrint }: { orderId: number | null; onClose: () => void; onChanged: () => void; onPrint: (job: PrintJob) => void }) {
  const mobile = useMediaQuery('(max-width: 48em)')
  const [order, setOrder] = useState<StitchOrder | null>(null)
  const [log, setLog] = useState<StitchLogEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [previous, setPrevious] = useState<StitchMeasurement[]>([])
  const [ticked, setTicked] = useState<number[]>([])
  const [busyItem, setBusyItem] = useState<number | null>(null)
  const [modal, setModal] = useState<null | 'advance' | 'deliver' | 'cancel' | 'refund'>(null)
  const [garment, setGarment] = useState<{ order: StitchOrder; item: StitchItem | null } | null>(null)
  const [bill, setBill] = useState<Bill | null>(null)
  const [comment, setComment] = useState('')
  const [author, setAuthor] = useState(getAuthorName() ?? '')
  const [posting, setPosting] = useState(false)
  // After a final delivery with advance left: ask about the refund once the bill window is closed (one print area at a time).
  const [refundAfterBill, setRefundAfterBill] = useState(false)

  const load = (id: number) => {
    setError(null)
    Promise.all([stitchApi.get(id), stitchApi.log(id)])
      .then(([o, l]) => { setOrder(o); setLog(l); setTicked(o.items.filter((i) => i.status === 'FINISHED' && i.deliveryDate <= todayIso()).map((i) => i.id)) })
      .catch(() => setError('We could not open this order. Please try again.'))
  }
  useEffect(() => { setOrder(null); setLog([]); setComment(''); if (orderId) load(orderId) }, [orderId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (order) stitchApi.measurements(order.customerMobile).then(setPrevious).catch(() => setPrevious([])) }, [order?.customerMobile]) // eslint-disable-line react-hooks/exhaustive-deps

  /** After any change: show the fresh order, reload its timeline, refresh the list behind. */
  const applied = (o: StitchOrder) => { setOrder(o); setTicked((t) => t.filter((id) => o.items.some((i) => i.id === id && i.status === 'FINISHED'))); stitchApi.log(o.id).then(setLog).catch(() => undefined); onChanged() }

  const setStatus = async (item: StitchItem, status: StitchItemStatus) => {
    if (!order || status === item.status) return
    setBusyItem(item.id)
    try {
      const o = await stitchApi.setStatus(order.id, item.id, status, getAuthorName())
      applied(o)
      if (status === 'FINISHED') setTicked((t) => [...new Set([...t, item.id])])
    } catch (e) { fail('Could not change the status')(e) } finally { setBusyItem(null) }
  }
  const postComment = async () => {
    if (!order || !comment.trim()) return
    setPosting(true)
    setAuthorName(author)
    try { setLog(await stitchApi.comment(order.id, comment.trim(), author.trim() || undefined)); setComment(''); notifications.show({ color: 'green', message: 'Comment added' }) }
    catch (e) { fail('Could not add the comment')(e) } finally { setPosting(false) }
  }
  const comments = log.filter((l) => l.kind === 'COMMENT')

  if (!orderId) return null
  const o = order
  const finished = o ? o.items.filter((i) => i.status === 'FINISHED') : []
  const canRefund = o ? o.advanceAvailable > 0 && (o.status !== 'OPEN' || o.items.some((i) => i.status === 'CANCELLED')) : false

  // Kept one layer below other popups, so anything opened from here (bill, print preview, actions) always shows on top.
  return <Modal opened onClose={onClose} title={o ? `Order ${o.orderNumber}` : 'Order'} size="xl" fullScreen={mobile} centered zIndex={ORDER_LAYER}>
    {error && <Alert color="red" title="Something went wrong">{error} <Button size="xs" variant="light" ml="sm" onClick={() => load(orderId)}>Try again</Button></Alert>}
    {!o && !error && <Group justify="center" py="xl"><Loader /><Text c="dimmed">Loading order…</Text></Group>}
    {o && <Stack gap="md">
      {/* Header */}
      <Group justify="space-between" align="flex-start">
        <div><Title order={3}>{o.customerName}</Title><Text c="dimmed">{o.customerMobile} · ordered {fmtDate(o.createdAt)}</Text><Text size="sm" mt={4}>{progressText(o)}</Text></div>
        <Stack gap={6} align="flex-end">
          <Badge size="lg" variant="light" color={o.status === 'OPEN' ? 'blue' : o.status === 'DELIVERED' ? 'violet' : 'red'}>{o.status === 'OPEN' ? 'Open' : o.status === 'DELIVERED' ? 'Delivered' : 'Cancelled'}</Badge>
          <Menu position="bottom-end" withinPortal>
            <Menu.Target><Button variant="default" leftSection={<IconPrinter size={17} />}>Print</Button></Menu.Target>
            <Menu.Dropdown>
              <Menu.Item onClick={() => onPrint({ kind: 'receipt', order: o })}>Customer receipt</Menu.Item>
              <Menu.Item onClick={() => onPrint({ kind: 'workslip', order: o, comments })}>Work slip (tailor)</Menu.Item>
              <Menu.Item onClick={() => onPrint({ kind: 'both', order: o, comments })}>Both</Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Stack>
      </Group>

      {/* Garments */}
      <Stack gap="sm">
        <Group justify="space-between"><Title order={4}>Garments</Title>{o.status === 'OPEN' && <Button variant="light" leftSection={<IconPlus size={16} />} onClick={() => setGarment({ order: o, item: null })}>Add garment</Button>}</Group>
        {o.items.map((i) => <Card key={i.id} withBorder padding="md" radius="md" style={isLate(i) ? { borderColor: 'var(--mantine-color-red-5)' } : undefined}>
          <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
            <Group align="flex-start" gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
              {i.status === 'FINISHED' && <Checkbox size="lg" mt={2} checked={ticked.includes(i.id)} onChange={(e) => { const on = e.currentTarget.checked; setTicked((t) => (on ? [...t, i.id] : t.filter((x) => x !== i.id))) }} aria-label={`Deliver ${i.garment} now`} />}
              <div style={{ minWidth: 0 }}>
                <Text fw={700} size="lg">{i.garment}</Text>
                <Group gap={6} mt={2}>
                  <Text size="sm">Delivery {fmtDate(i.deliveryDate)}</Text>
                  {isLate(i) && <Badge color="red" variant="light">Late</Badge>}
                  {isDueToday(i) && <Badge color="orange" variant="light">Today</Badge>}
                </Group>
                <Text size="sm" mt={2}>{i.amount != null ? <b>{money(i.amount)}</b> : <Text span c="orange" fw={600}>Price not added</Text>}</Text>
                {i.measurements && <Spoiler maxHeight={22} showLabel="Show measurements" hideLabel="Hide" mt={4}><Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{i.measurements}</Text>{i.measuredOn && <Text size="xs" c="dimmed">Measured {fmtDate(i.measuredOn)}</Text>}</Spoiler>}
                {i.notes && <Text size="sm" c="dimmed">Note: {i.notes}</Text>}
                {i.status === 'DELIVERED' && <Text size="sm" c="violet">Delivered {i.deliveredAt ? fmtDate(i.deliveredAt) : ''} · bill {i.billNumber}</Text>}
                {i.status === 'CANCELLED' && <Text size="sm" c="red">Cancelled: {i.cancelReason}</Text>}
              </div>
            </Group>
            <Stack gap={6} align="flex-end" style={{ flexShrink: 0 }}>
              {isOpen(i) && o.status === 'OPEN'
                ? <Select w={150} data={progressOptions} value={i.status} onChange={(v) => v && void setStatus(i, v as StitchItemStatus)} allowDeselect={false} disabled={busyItem === i.id} aria-label={`Status of ${i.garment}`} comboboxProps={{ withinPortal: true }} styles={{ input: { fontWeight: 600, color: `var(--mantine-color-${itemStatusColor[i.status]}-7)` } }} />
                : <Badge size="lg" variant="light" color={itemStatusColor[i.status]}>{itemStatusLabel[i.status]}</Badge>}
              {isOpen(i) && <ActionIcon variant="subtle" size="lg" onClick={() => setGarment({ order: o, item: i })} aria-label={`Edit ${i.garment}`}><IconPencil size={18} /></ActionIcon>}
            </Stack>
          </Group>
          {isOpen(i) && i.status !== 'FINISHED' && i.deliveryDate <= todayIso() && <Alert mt="sm" variant="light" color="orange" p="xs">Not finished yet. <Button size="compact-sm" variant="subtle" onClick={() => setGarment({ order: o, item: i })}>Change delivery date</Button></Alert>}
        </Card>)}
      </Stack>

      {o.status === 'OPEN' && <Group grow>
        <Button size="lg" color="teal" leftSection={<IconTruckDelivery size={20} />} disabled={!ticked.length} onClick={() => setModal('deliver')}>{ticked.length ? `Deliver ${ticked.length} & bill` : finished.length ? 'Tick garments to deliver' : 'Nothing finished yet'}</Button>
      </Group>}

      {/* Money */}
      <Card withBorder padding="md" radius="md">
        <Group justify="space-between" mb="xs"><Title order={4}>Money</Title>
          <Group gap="xs">{o.status === 'OPEN' && <Button variant="light" leftSection={<IconCash size={16} />} onClick={() => setModal('advance')}>Add advance</Button>}{canRefund && <Button variant="light" color="orange" leftSection={<IconReceiptRefund size={16} />} onClick={() => setModal('refund')}>Return advance</Button>}</Group>
        </Group>
        <SimpleGrid cols={{ base: 2, sm: 4 }}>
          <div><Text size="xs" c="dimmed">{o.unpricedCount ? 'Total so far' : 'Total'}</Text><Text fw={700}>{money(o.total)}</Text></div>
          <div><Text size="xs" c="dimmed">Advance paid</Text><Text fw={700}>{money(o.advancePaid)}</Text></div>
          <div><Text size="xs" c="dimmed">Used on bills</Text><Text fw={700}>{money(o.advanceUsed)}</Text></div>
          <div><Text size="xs" c="dimmed">Advance left</Text><Text fw={700} c={o.advanceAvailable > 0 ? 'teal' : undefined}>{money(o.advanceAvailable)}</Text></div>
        </SimpleGrid>
        {o.unpricedCount > 0 && <Text size="sm" c="orange" mt="xs">{o.unpricedCount} garment{o.unpricedCount === 1 ? '' : 's'} without a price. Add it before billing.</Text>}
        {(o.payments.length > 0 || o.bills.length > 0) && <><Divider my="sm" /><Stack gap={6}>
          {o.payments.map((p) => <Group key={p.id} justify="space-between" wrap="nowrap">
            <Text size="sm">{p.kind === 'ADVANCE' ? `Advance ${money(p.amount)}` : `Refund ${money(p.amount)} · kept ${money(p.keptAmount ?? 0)} · ${p.refundNumber}`} <Text span size="xs" c="dimmed">{fmtDateTime(p.createdAt)} · {p.authorName}</Text></Text>
            <ActionIcon variant="subtle" onClick={() => onPrint(p.kind === 'ADVANCE' ? { kind: 'advance', order: o, payment: p } : { kind: 'refund', order: o, payment: p })} aria-label="Print"><IconPrinter size={17} /></ActionIcon>
          </Group>)}
          {o.bills.map((b) => <Group key={b.id} justify="space-between" wrap="nowrap">
            <Text size="sm">Bill {b.billNumber} · {money(b.total)}{b.advancePaid > 0 ? ` · advance ${money(b.advancePaid)} · paid ${money(b.balance)}` : ''} <Text span size="xs" c="dimmed">{fmtDateTime(b.createdAt)}</Text></Text>
            <ActionIcon variant="subtle" onClick={() => setBill(b)} aria-label="Open bill"><IconFileInvoice size={17} /></ActionIcon>
          </Group>)}
        </Stack></>}
        <Text size="sm" c="dimmed" mt="sm">Fabric: {fabricLabel(o)}{o.notes ? ` · Note: ${o.notes}` : ''}</Text>
      </Card>

      {o.status === 'OPEN' && openItems(o).length > 0 && <Group justify="flex-end"><Button variant="subtle" color="red" leftSection={<IconX size={16} />} onClick={() => setModal('cancel')}>Cancel garments…</Button></Group>}

      {/* Timeline */}
      <Card withBorder padding="md" radius="md">
        <Title order={4} mb="sm">Timeline</Title>
        {log.length === 0 ? <Text c="dimmed" size="sm">No history yet.</Text> : <Timeline bulletSize={28} lineWidth={2} active={log.length}>{log.map((l) => {
          const Icon = logIcon[l.kind]
          return <Timeline.Item key={l.id} color={logColor[l.kind] ?? 'gray'} bullet={<ThemeIcon size={28} radius="xl" color={logColor[l.kind] ?? 'gray'} variant="light"><Icon size={15} /></ThemeIcon>} title={<Text size="sm" fw={l.kind === 'COMMENT' ? 500 : 600} fs={l.kind === 'COMMENT' ? 'italic' : undefined}>{l.kind === 'COMMENT' ? `“${l.message}”` : l.message}</Text>}>
            <Text size="xs" c="dimmed">{fmtDateTime(l.createdAt)} · {l.authorName}</Text>
          </Timeline.Item>
        })}</Timeline>}
        <Divider my="md" label="Add a comment (not shown on bills)" labelPosition="left" />
        <Stack gap="xs">
          <Textarea placeholder="e.g. Customer wants extra lining, no charge" autosize minRows={2} maxRows={5} value={comment} onChange={(e) => setComment(e.currentTarget.value)} maxLength={1000} />
          <Group align="flex-end" wrap="wrap">
            <TextInput style={{ flex: 1, minWidth: 180 }} label="Your name" placeholder="Optional, remembered on this device" value={author} onChange={(e) => setAuthor(e.currentTarget.value)} maxLength={150} />
            <Button leftSection={<IconMessage size={16} />} loading={posting} disabled={!comment.trim()} onClick={() => void postComment()}>Add comment</Button>
          </Group>
        </Stack>
      </Card>
    </Stack>}

    <AdvanceModal order={modal === 'advance' ? o : null} onClose={() => setModal(null)} onDone={(n) => { setModal(null); applied(n); const p = n.payments.filter((x) => x.kind === 'ADVANCE').at(-1); notifications.show({ color: 'green', message: 'Advance saved' }); if (p) onPrint({ kind: 'advance', order: n, payment: p }) }} />
    <DeliverModal order={modal === 'deliver' ? o : null} itemIds={ticked} onClose={() => setModal(null)} onDone={(n) => {
      setModal(null); applied(n)
      const b = n.bills.at(-1); notifications.show({ color: 'green', icon: <IconCircleCheck size={18} />, title: 'Delivered', message: b ? `Bill ${b.billNumber}` : '' })
      const askRefund = n.status !== 'OPEN' && n.advanceAvailable > 0
      if (b) { setBill(b); setRefundAfterBill(askRefund) } else if (askRefund) setModal('refund')
    }} />
    <CancelModal order={modal === 'cancel' ? o : null} onClose={() => setModal(null)} onDone={(n) => { setModal(null); applied(n); notifications.show({ color: 'green', message: 'Cancelled' }); if (n.advanceAvailable > 0) setModal('refund') }} />
    <RefundModal order={modal === 'refund' ? o : null} onClose={() => setModal(null)} onDone={(n) => { setModal(null); applied(n); const p = n.payments.filter((x) => x.kind === 'REFUND').at(-1); notifications.show({ color: 'green', message: 'Refund saved' }); if (p) onPrint({ kind: 'refund', order: n, payment: p }) }} />
    <GarmentModal state={garment} previous={previous} onClose={() => setGarment(null)} onDone={(n) => { setGarment(null); applied(n); notifications.show({ color: 'green', message: 'Garment saved' }) }} />
    <BillDetailsModal bill={bill} onClose={() => { setBill(null); if (refundAfterBill) { setRefundAfterBill(false); setModal('refund') } }} />
  </Modal>
}
