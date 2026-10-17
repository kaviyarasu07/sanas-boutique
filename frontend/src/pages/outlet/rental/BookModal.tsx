import { useEffect, useState } from 'react'
import { Alert, Button, Card, Group, Modal, SimpleGrid, Stack, Text, TextInput, Title } from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { useMediaQuery } from '@mantine/hooks'
import { IconCalendarPlus, IconDiamond } from '@tabler/icons-react'
import { rentalApi, type RentalBooking } from '../../../api/outletApi'
import { getAuthorName } from '../../../components/authorName'
import { money, todayIso } from '../../../components/BillDetailsModal'
import { CustomerPicker, emptyCustomer, type PickedCustomer } from '../../../components/CustomerPicker'
import { fmtDate } from '../../../config/dateFormat'
import { AddPieceSelect, PieceLines, addPiece, perDay, type PickedPiece } from './PiecePicker'
import { daysText, fail, rentalDays } from './shared'

/**
 * Book jewellery for dates (mode "book"), or Rent now: the customer takes it today, so saving also
 * hands it over and prints the delivery challan (mode "rentNow"). Every piece is checked free for the dates.
 */
export function BookModal({ mode, onClose, onSaved }: { mode: 'book' | 'rentNow' | null; onClose: () => void; onSaved: (b: RentalBooking) => void }) {
  const mobile = useMediaQuery('(max-width: 48em)')
  const rentNow = mode === 'rentNow'
  const [customer, setCustomer] = useState<PickedCustomer>(emptyCustomer)
  const [pieces, setPieces] = useState<PickedPiece[]>([])
  const [start, setStart] = useState<string | null>(todayIso())
  const [end, setEnd] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [allFree, setAllFree] = useState(true)
  const [saving, setSaving] = useState(false)
  useEffect(() => { if (mode) { setCustomer(emptyCustomer); setPieces([]); setStart(todayIso()); setEnd(null); setNotes('') } }, [mode])
  if (!mode) return null

  const from = rentNow ? todayIso() : start
  const datesOk = Boolean(from && end && end >= from)
  const days = datesOk ? rentalDays(from!, end!) : 0
  const valid = /^\d{10}$/.test(customer.mobile) && customer.name.trim().length > 0 && pieces.length > 0 && datesOk && allFree
  const save = async () => {
    setSaving(true)
    const payload = { customerName: customer.name.trim(), customerMobile: customer.mobile, startDate: rentNow ? undefined : start!, returnDate: end!, lines: pieces.map((p) => ({ itemId: p.itemId, quantity: p.quantity })), notes: notes.trim() || undefined, authorName: getAuthorName() }
    try { onSaved(rentNow ? await rentalApi.rentNow(payload) : await rentalApi.book(payload)) }
    catch (e) { fail(rentNow ? 'Could not rent' : 'Could not save the booking')(e) } finally { setSaving(false) }
  }

  return <Modal opened onClose={onClose} title={rentNow ? 'Rent now (customer takes it today)' : 'Book jewellery'} size="xl" fullScreen={mobile} centered>
    <Stack>
      <Card withBorder padding="sm" radius="md"><CustomerPicker value={customer} onChange={setCustomer} /></Card>
      <Card withBorder padding="md" radius="md"><Stack gap="sm">
        <SimpleGrid cols={{ base: 1, xs: 2 }}>
          {rentNow ? <div><Text size="sm" fw={500}>Take-away date</Text><Text fw={700} size="lg">Today, {fmtDate(todayIso())}</Text></div>
            : <DateInput label="Take-away date" value={start} onChange={setStart} minDate={todayIso()} required />}
          <DateInput label="Return date" placeholder="Pick from calendar" value={end} onChange={setEnd} minDate={from ?? todayIso()} required />
        </SimpleGrid>
        {datesOk && <Text size="sm" c="dimmed">{daysText(days)} (return date − take-away date)</Text>}
      </Stack></Card>
      <Card withBorder padding="md" radius="md">
        <Title order={5} mb="sm">Jewellery</Title>
        <PieceLines value={pieces} onChange={setPieces} from={from} to={end} empty="No pieces yet. Add them below." onAvailability={setAllFree} />
        <div style={{ marginTop: 12 }}><AddPieceSelect onPick={(p) => setPieces(addPiece(pieces, p))} /></div>
      </Card>
      {!datesOk && pieces.length > 0 && <Alert variant="light" color="blue">Pick the return date to check the pieces are free.</Alert>}
      <Card withBorder padding="md" radius="md" bg="var(--mantine-color-gray-light)">
        <Group justify="space-between"><Text>Estimated rent{datesOk ? ` · ${daysText(days)}` : ''}</Text><Text fw={800} size="lg">{money(perDay(pieces) * Math.max(days, 1))}</Text></Group>
        <Text size="xs" c="dimmed">Final amount on return: the days actually kept, plus any damage or missing charges.</Text>
      </Card>
      <TextInput label="Note" placeholder="Optional" value={notes} onChange={(e) => setNotes(e.currentTarget.value)} maxLength={500} />
      <Group justify="flex-end"><Button variant="default" size="md" onClick={onClose}>Cancel</Button>
        <Button size="md" leftSection={rentNow ? <IconDiamond size={18} /> : <IconCalendarPlus size={18} />} loading={saving} disabled={!valid} onClick={() => void save()}>{rentNow ? 'Hand over & print challan' : 'Save & print slip'}</Button></Group>
    </Stack>
  </Modal>
}
