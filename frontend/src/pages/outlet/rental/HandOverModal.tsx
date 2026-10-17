import { useEffect, useState } from 'react'
import { Alert, Badge, Button, Card, Checkbox, Group, Modal, Stack, Text, Title } from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { useMediaQuery } from '@mantine/hooks'
import { IconHandFinger } from '@tabler/icons-react'
import { rentalApi, type RentalBooking } from '../../../api/outletApi'
import { getAuthorName } from '../../../components/authorName'
import { money, todayIso } from '../../../components/BillDetailsModal'
import { fmtDate } from '../../../config/dateFormat'
import { AddPieceSelect, PieceLines, addPiece, perDay, type PickedPiece } from './PiecePicker'
import { daysText, fail, rentalDays } from './shared'

/**
 * The customer takes the pre-booked pieces today. Tick each booked piece as it is given (or "Not
 * taking this one"), add more jewellery, set the return date; the estimate updates live. The server
 * checks every piece again for [today, return date] before handing over and printing the challan.
 */
export function HandOverModal({ booking, onClose, onDone }: { booking: RentalBooking | null; onClose: () => void; onDone: (b: RentalBooking) => void }) {
  const mobile = useMediaQuery('(max-width: 48em)')
  const [given, setGiven] = useState<Record<number, boolean>>({})
  const [removed, setRemoved] = useState<number[]>([])
  const [added, setAdded] = useState<PickedPiece[]>([])
  const [end, setEnd] = useState<string | null>(null)
  const [addedFree, setAddedFree] = useState(true)
  const [saving, setSaving] = useState(false)
  useEffect(() => { setGiven({}); setRemoved([]); setAdded([]); setEnd(booking ? (booking.returnDate < todayIso() ? todayIso() : booking.returnDate) : null) }, [booking])
  if (!booking) return null

  const kept = booking.items.filter((i) => !removed.includes(i.itemId))
  const allTicked = kept.every((i) => given[i.itemId])
  const days = end ? rentalDays(todayIso(), end) : 0
  const estimate = (kept.reduce((s, i) => s + i.pricePerDay * i.quantity, 0) + perDay(added)) * Math.max(days, 1)
  const valid = Boolean(end && end >= todayIso()) && kept.length + added.length > 0 && allTicked && addedFree
  const save = async () => {
    setSaving(true)
    try { onDone(await rentalApi.handOver(booking.id, { returnDate: end!, removeItemIds: removed, addItems: added.map((p) => ({ itemId: p.itemId, quantity: p.quantity })), authorName: getAuthorName() })) }
    catch (e) { fail('Could not hand over')(e) } finally { setSaving(false) }
  }

  return <Modal opened onClose={onClose} title={`Hand over · ${booking.bookingNumber}`} size="lg" fullScreen={mobile} centered>
    <Stack>
      <Alert variant="light" color="violet" title={`${booking.customerName} · ${booking.customerMobile}`}>Booked {fmtDate(booking.startDate)} → {fmtDate(booking.returnDate)}. Tick each piece as you give it.</Alert>
      <Card withBorder padding="md" radius="md">
        <Title order={5} mb="sm">Pieces booked</Title>
        <Stack gap="sm">{booking.items.map((i) => {
          const out = removed.includes(i.itemId)
          return <Group key={i.itemId} justify="space-between" wrap="nowrap" style={{ opacity: out ? 0.5 : 1 }}>
            <Checkbox size="lg" disabled={out} checked={Boolean(given[i.itemId])} onChange={(e) => { const on = e.currentTarget.checked; setGiven((g) => ({ ...g, [i.itemId]: on })) }}
              label={<div><Text fw={600}>{i.name}{i.quantity > 1 ? ` × ${i.quantity}` : ''}</Text><Text size="xs" c="dimmed">{i.itemCode ?? ''} · {money(i.pricePerDay)} per day</Text></div>} />
            {out ? <Button size="xs" variant="subtle" onClick={() => setRemoved(removed.filter((x) => x !== i.itemId))}>Undo</Button>
              : <Button size="xs" variant="subtle" color="red" onClick={() => setRemoved([...removed, i.itemId])}>Not taking this one</Button>}
          </Group>
        })}</Stack>
        {!allTicked && <Text size="sm" c="orange" mt="sm">Tick every piece you hand over.</Text>}
      </Card>
      <Card withBorder padding="md" radius="md">
        <Title order={5} mb="sm">Add more jewellery</Title>
        <PieceLines value={added} onChange={setAdded} from={todayIso()} to={end} empty="Nothing added." onAvailability={setAddedFree} />
        <div style={{ marginTop: 12 }}><AddPieceSelect onPick={(p) => setAdded(addPiece(added, p, true))} /></div>
      </Card>
      <Card withBorder padding="md" radius="md"><Stack gap="xs">
        <DateInput label="Return date" value={end} onChange={setEnd} minDate={todayIso()} />
        <Group justify="space-between"><Text>Estimated rent · {daysText(days)} {added.length > 0 && <Badge size="sm" variant="light" color="violet">incl. added</Badge>}</Text><Text fw={800} size="lg">{money(estimate)}</Text></Group>
        <Text size="xs" c="dimmed">A delivery challan (no amount) is printed now. The bill is made on return.</Text>
      </Stack></Card>
      <Group justify="flex-end"><Button variant="default" size="md" onClick={onClose}>Back</Button><Button size="md" leftSection={<IconHandFinger size={18} />} loading={saving} disabled={!valid} onClick={() => void save()}>Hand over &amp; print challan</Button></Group>
    </Stack>
  </Modal>
}
