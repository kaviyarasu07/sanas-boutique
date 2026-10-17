import { useEffect, useState } from 'react'
import { Alert, Button, Card, Divider, Group, Modal, NumberInput, Stack, Text, Title } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { IconCheck } from '@tabler/icons-react'
import { parlourApi, type Bill, type ParlourAppointment } from '../../../api/outletApi'
import { getAuthorName } from '../../../components/authorName'
import { money } from '../../../components/BillDetailsModal'
import { CustomerPicker, emptyCustomer, type PickedCustomer } from '../../../components/CustomerPicker'
import { fmtDate } from '../../../config/dateFormat'
import { PickedLines, addPick, pickedTotal } from './PickedLines'
import { AddServiceSelect } from './AddServiceSelect'
import type { PickedService } from './ServiceGrid'
import { fail, timeLabel } from './shared'

/**
 * Parlour bill. Walk-in: pick the customer and services. Booked customer arrived (booking): starts
 * with the booked services; add or remove what was actually done. Fixed prices, discount only.
 */
export function ParlourBillModal({ opened, booking, onClose, onDone }: { opened: boolean; booking: ParlourAppointment | null; onClose: () => void; onDone: (bill: Bill) => void }) {
  const mobile = useMediaQuery('(max-width: 48em)')
  const [customer, setCustomer] = useState<PickedCustomer>(emptyCustomer)
  const [lines, setLines] = useState<PickedService[]>([])
  const [discount, setDiscount] = useState<number | string>(0)
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (!opened) return
    setCustomer(emptyCustomer); setDiscount(0)
    setLines(booking ? booking.items.map((i) => ({ itemId: i.itemId, name: i.name, price: i.price, quantity: i.quantity })) : [])
  }, [opened, booking])

  const subtotal = pickedTotal(lines)
  const disc = Math.min(Number(discount) || 0, subtotal)
  const customerOk = booking != null || (/^\d{10}$/.test(customer.mobile) && customer.name.trim().length > 0)
  const save = async () => {
    setSaving(true)
    try {
      const bill = await parlourApi.bill({ customerName: booking ? undefined : customer.name.trim(), customerMobile: booking ? undefined : customer.mobile, lines: lines.map((l) => ({ itemId: l.itemId, quantity: l.quantity })), discount: disc, bookingId: booking?.id, authorName: getAuthorName() })
      onDone(bill)
    } catch (e) { fail('Could not make the bill')(e) } finally { setSaving(false) }
  }

  return <Modal opened={opened} onClose={onClose} title={booking ? `Bill · ${booking.bookingNumber}` : 'New parlour bill'} size="xl" fullScreen={mobile} centered>
    <Stack>
      {booking
        ? <Alert variant="light" color="violet" title={`${booking.customerName} · ${booking.customerMobile}`}>Booked for {fmtDate(booking.date)} {timeLabel(booking.time)}. Add or remove services to match what was done.</Alert>
        : <Card withBorder padding="sm" radius="md"><CustomerPicker value={customer} onChange={setCustomer} /></Card>}
      <Card withBorder padding="md" radius="md">
        <Title order={5} mb="sm">Bill</Title>
        <PickedLines value={lines} onChange={setLines} empty="No services yet. Add one below." />
        <div style={{ marginTop: 12 }}><AddServiceSelect onPick={(s) => setLines(addPick(lines, s))} /></div>
        <Divider my="sm" />
        <Group justify="space-between"><Text>Subtotal</Text><Text fw={600}>{money(subtotal)}</Text></Group>
        <Group justify="space-between" mt={6}><Text>Discount</Text><NumberInput w={140} prefix="₹" min={0} max={subtotal} decimalScale={2} thousandSeparator="," value={discount} onChange={setDiscount} aria-label="Discount" /></Group>
        <Group justify="space-between" mt="sm"><Text fw={800}>Total</Text><Text fw={800} size="xl">{money(subtotal - disc)}</Text></Group>
      </Card>
      <Group justify="flex-end"><Button variant="default" size="md" onClick={onClose}>Cancel</Button><Button size="md" leftSection={<IconCheck size={18} />} loading={saving} disabled={!lines.length || !customerOk} onClick={() => void save()}>Complete bill</Button></Group>
    </Stack>
  </Modal>
}
