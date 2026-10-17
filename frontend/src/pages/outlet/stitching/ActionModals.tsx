import { useEffect, useState } from 'react'
import { Alert, Button, Card, Checkbox, Divider, Group, Modal, NumberInput, Select, Stack, Text, TextInput, Textarea } from '@mantine/core'
import { IconCash, IconCheck, IconFileInvoice, IconReceiptRefund } from '@tabler/icons-react'
import { stitchApi, type StitchItem, type StitchMeasurement, type StitchOrder } from '../../../api/outletApi'
import { money } from '../../../components/BillDetailsModal'
import { fmtDate } from '../../../config/dateFormat'
import { GarmentFields, blankGarment, garmentPayload, garmentValid, type GarmentDraft } from './GarmentFields'
import { advanceUsedFor, cancelReasons, fail, getAuthorName, openItems } from './shared'

const Line = ({ label, value, strong }: { label: string; value: string; strong?: boolean }) => <Group justify="space-between"><Text fw={strong ? 800 : undefined}>{label}</Text><Text fw={strong ? 800 : 600} size={strong ? 'lg' : undefined}>{value}</Text></Group>

export function AdvanceModal({ order, onClose, onDone }: { order: StitchOrder | null; onClose: () => void; onDone: (o: StitchOrder) => void }) {
  const [amount, setAmount] = useState<number | string>('')
  const [saving, setSaving] = useState(false)
  useEffect(() => setAmount(''), [order])
  if (!order) return null
  const max = order.unpricedCount === 0 ? Math.max(0, order.total - order.advancePaid) : undefined
  const save = async () => {
    setSaving(true)
    try { onDone(await stitchApi.addAdvance(order.id, Number(amount), getAuthorName())) } catch (e) { fail('Could not save the advance')(e) } finally { setSaving(false) }
  }
  return <Modal opened onClose={onClose} title={`Add advance · ${order.orderNumber}`} centered>
    <Stack>
      <Text>{order.customerName} · advance paid so far <b>{money(order.advancePaid)}</b></Text>
      <NumberInput label="Advance received now" prefix="₹" min={0.01} max={max} decimalScale={2} thousandSeparator="," value={amount} onChange={setAmount} data-autofocus description={max !== undefined ? `Up to ${money(max)} (order total ${money(order.total)})` : 'Some prices are not added yet'} />
      <Group justify="flex-end"><Button variant="default" onClick={onClose}>Back</Button><Button leftSection={<IconCash size={17} />} loading={saving} disabled={!(Number(amount) > 0) || (max !== undefined && Number(amount) > max)} onClick={() => void save()}>Save &amp; print receipt</Button></Group>
    </Stack>
  </Modal>
}

/** Deliver the ticked finished garments: prices can be filled in here; the advance left is used first. */
export function DeliverModal({ order, itemIds, onClose, onDone }: { order: StitchOrder | null; itemIds: number[]; onClose: () => void; onDone: (o: StitchOrder) => void }) {
  const [prices, setPrices] = useState<Record<number, number | string>>({})
  const [discount, setDiscount] = useState<number | string>(0)
  const [saving, setSaving] = useState(false)
  const selected: StitchItem[] = order ? order.items.filter((i) => itemIds.includes(i.id)) : []
  useEffect(() => { setPrices(Object.fromEntries(selected.map((i) => [i.id, i.amount ?? '']))); setDiscount(0) }, [order, itemIds.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!order) return null
  const subtotal = selected.reduce((s, i) => s + (Number(prices[i.id]) || 0), 0)
  const disc = Math.min(Number(discount) || 0, subtotal)
  const billTotal = subtotal - disc
  const used = advanceUsedFor(order, billTotal)
  const left = openItems(order).length - selected.length
  const allPriced = selected.every((i) => prices[i.id] !== '' && Number(prices[i.id]) >= 0)
  const save = async () => {
    setSaving(true)
    try { onDone(await stitchApi.deliver(order.id, { itemIds: selected.map((i) => i.id), prices: selected.map((i) => ({ itemId: i.id, amount: Number(prices[i.id]) })), discount: disc, authorName: getAuthorName() })) }
    catch (e) { fail('Could not make the bill')(e) } finally { setSaving(false) }
  }
  return <Modal opened onClose={onClose} title={`Deliver & bill · ${order.orderNumber}`} centered size="lg">
    <Stack>
      <Text>{order.customerName} · {order.customerMobile}</Text>
      <Card withBorder padding="sm" radius="md"><Stack gap="xs">{selected.map((i) => <Group key={i.id} justify="space-between" wrap="nowrap">
        <div><Text fw={600}>{i.garment}</Text><Text size="xs" c="dimmed">Delivery {fmtDate(i.deliveryDate)}</Text></div>
        <NumberInput w={140} prefix="₹" min={0} decimalScale={2} thousandSeparator="," placeholder="Price" value={prices[i.id] ?? ''} onChange={(v) => setPrices({ ...prices, [i.id]: v })} error={prices[i.id] === '' ? 'Enter price' : undefined} aria-label={`Price of ${i.garment}`} />
      </Group>)}</Stack></Card>
      <NumberInput label="Discount" prefix="₹" min={0} max={subtotal} decimalScale={2} thousandSeparator="," value={discount} onChange={setDiscount} />
      <Card withBorder padding="sm" radius="md" bg="var(--mantine-color-gray-light)"><Stack gap={4}>
        <Line label="Subtotal" value={money(subtotal)} />
        {disc > 0 && <Line label="Discount" value={`− ${money(disc)}`} />}
        <Line label="Bill total" value={money(billTotal)} />
        {used > 0 && <Line label="Advance used" value={`− ${money(used)}`} />}
        <Divider my={4} />
        <Line label="Balance to pay now" value={money(billTotal - used)} strong />
        <Text size="xs" c="dimmed">{left > 0 ? `Still to deliver: ${left} garment${left === 1 ? '' : 's'} · advance left ${money(order.advanceAvailable - used)}` : 'This completes the order.'}</Text>
      </Stack></Card>
      <Group justify="flex-end"><Button variant="default" onClick={onClose}>Back</Button><Button leftSection={<IconFileInvoice size={17} />} loading={saving} disabled={!selected.length || !allPriced} onClick={() => void save()}>Generate bill</Button></Group>
    </Stack>
  </Modal>
}

export function CancelModal({ order, onClose, onDone }: { order: StitchOrder | null; onClose: () => void; onDone: (o: StitchOrder) => void }) {
  const [picked, setPicked] = useState<string[]>([])
  const [reason, setReason] = useState<string | null>(cancelReasons[0])
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => { setPicked(order ? openItems(order).map((i) => String(i.id)) : []); setReason(cancelReasons[0]); setComment('') }, [order])
  if (!order) return null
  const all = picked.length === openItems(order).length
  const save = async () => {
    setSaving(true)
    try { onDone(await stitchApi.cancel(order.id, { itemIds: all ? [] : picked.map(Number), reason: reason!, comment: comment.trim() || undefined, authorName: getAuthorName() })) }
    catch (e) { fail('Could not cancel')(e) } finally { setSaving(false) }
  }
  return <Modal opened onClose={onClose} title={`Cancel · ${order.orderNumber}`} centered>
    <Stack>
      <Checkbox.Group label="Which garments are cancelled?" value={picked} onChange={setPicked}><Stack gap="xs" mt="xs">{openItems(order).map((i) => <Checkbox key={i.id} size="md" value={String(i.id)} label={`${i.garment} · ${fmtDate(i.deliveryDate)}`} />)}</Stack></Checkbox.Group>
      <Select label="Reason" data={cancelReasons} value={reason} onChange={setReason} allowDeselect={false} />
      <Textarea label="Comment" placeholder={reason === 'Other' ? 'Please explain' : 'Optional'} autosize minRows={2} value={comment} onChange={(e) => setComment(e.currentTarget.value)} maxLength={500} />
      {order.advanceAvailable > 0 && <Alert variant="light" color="orange">{money(order.advanceAvailable)} advance was paid. You can decide how much to return next.</Alert>}
      <Group justify="flex-end"><Button variant="default" onClick={onClose}>Back</Button><Button color="red" loading={saving} disabled={!picked.length || !reason || (reason === 'Other' && !comment.trim())} onClick={() => void save()}>{all ? 'Cancel order' : `Cancel ${picked.length} garment${picked.length === 1 ? '' : 's'}`}</Button></Group>
    </Stack>
  </Modal>
}

/** The outlet decides how much of the advance left goes back; the rest is kept by the shop. */
export function RefundModal({ order, onClose, onDone }: { order: StitchOrder | null; onClose: () => void; onDone: (o: StitchOrder) => void }) {
  const [amount, setAmount] = useState<number | string>(0)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => { setAmount(order?.advanceAvailable ?? 0); setReason(order?.items.find((i) => i.status === 'CANCELLED')?.cancelReason ?? '') }, [order])
  if (!order) return null
  const back = Math.min(Number(amount) || 0, order.advanceAvailable)
  const save = async () => {
    setSaving(true)
    try { onDone(await stitchApi.refund(order.id, { amount: back, reason: reason.trim() || undefined, authorName: getAuthorName() })) }
    catch (e) { fail('Could not save the refund')(e) } finally { setSaving(false) }
  }
  return <Modal opened onClose={onClose} title={`Return advance · ${order.orderNumber}`} centered>
    <Stack>
      <Card withBorder padding="sm" radius="md"><Stack gap={4}>
        <Line label="Advance paid" value={money(order.advancePaid)} />
        {order.advanceUsed > 0 && <Line label="Already used on bills" value={money(order.advanceUsed)} />}
        {order.refunded + order.kept > 0 && <Line label="Already settled" value={money(order.refunded + order.kept)} />}
        <Line label="Available to return" value={money(order.advanceAvailable)} strong />
      </Stack></Card>
      <NumberInput label="Amount to return" description={`Between ₹0 and ${money(order.advanceAvailable)}`} prefix="₹" min={0} max={order.advanceAvailable} decimalScale={2} thousandSeparator="," value={amount} onChange={setAmount} data-autofocus />
      <Line label="Kept by shop (cancellation charge)" value={money(order.advanceAvailable - back)} />
      <TextInput label="Reason" placeholder="Optional" value={reason} onChange={(e) => setReason(e.currentTarget.value)} maxLength={200} />
      <Group justify="flex-end"><Button variant="default" onClick={onClose}>Not now</Button><Button leftSection={<IconReceiptRefund size={17} />} loading={saving} disabled={Number(amount) < 0 || Number(amount) > order.advanceAvailable} onClick={() => void save()}>Save &amp; print refund challan</Button></Group>
    </Stack>
  </Modal>
}

/** Add a garment to an open order, or edit one not yet delivered. */
export function GarmentModal({ state, previous, onClose, onDone }: { state: { order: StitchOrder; item: StitchItem | null } | null; previous: StitchMeasurement[]; onClose: () => void; onDone: (o: StitchOrder) => void }) {
  const [draft, setDraft] = useState<GarmentDraft>(blankGarment())
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    const i = state?.item
    setDraft(i ? { garment: i.garment, measurements: i.measurements ?? '', notes: i.notes ?? '', deliveryDate: i.deliveryDate, amount: i.amount ?? '', copiedFromItemId: null, measureMode: 'fresh' } : blankGarment(state?.order.estimatedDeliveryDate ?? null))
  }, [state])
  if (!state) return null
  const save = async () => {
    setSaving(true)
    const payload = { ...garmentPayload(draft), authorName: getAuthorName() }
    try { onDone(state.item ? await stitchApi.updateItem(state.order.id, state.item.id, payload) : await stitchApi.addItem(state.order.id, payload)) }
    catch (e) { fail('Could not save the garment')(e) } finally { setSaving(false) }
  }
  return <Modal opened onClose={onClose} title={state.item ? `Edit ${state.item.garment}` : 'Add garment'} centered size="lg">
    <Stack>
      <GarmentFields value={draft} onChange={setDraft} previous={previous.filter((m) => m.itemId !== state.item?.id)} allowPastDate={Boolean(state.item)} />
      <Group justify="flex-end"><Button variant="default" onClick={onClose}>Back</Button><Button leftSection={<IconCheck size={17} />} loading={saving} disabled={!garmentValid(draft)} onClick={() => void save()}>Save</Button></Group>
    </Stack>
  </Modal>
}
