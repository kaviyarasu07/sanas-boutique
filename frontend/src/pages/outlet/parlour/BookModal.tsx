import { useEffect, useState } from 'react'
import { Button, Card, Chip, Group, Modal, Select, SimpleGrid, Stack, Text, TextInput, Title } from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { useMediaQuery } from '@mantine/hooks'
import { IconCalendarPlus } from '@tabler/icons-react'
import { parlourApi, type ParlourAppointment } from '../../../api/outletApi'
import { getAuthorName } from '../../../components/authorName'
import { money, todayIso } from '../../../components/BillDetailsModal'
import { CustomerPicker, emptyCustomer, type PickedCustomer } from '../../../components/CustomerPicker'
import { PickedLines, addPick, pickedTotal } from './PickedLines'
import { ServiceGrid, type PickedService } from './ServiceGrid'
import { fail, quickTimes, timeLabel, timeOptions } from './shared'

/** Book parlour services for a day and time (picked, never typed). No limit per time slot; the number already booked at that time is shown. */
export function BookModal({ opened, onClose, onSaved }: { opened: boolean; onClose: () => void; onSaved: (a: ParlourAppointment) => void }) {
  const mobile = useMediaQuery('(max-width: 48em)')
  const [customer, setCustomer] = useState<PickedCustomer>(emptyCustomer)
  const [lines, setLines] = useState<PickedService[]>([])
  const [date, setDate] = useState<string | null>(todayIso())
  const [time, setTime] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [dayList, setDayList] = useState<ParlourAppointment[]>([])
  const [saving, setSaving] = useState(false)
  useEffect(() => { if (opened) { setCustomer(emptyCustomer); setLines([]); setDate(todayIso()); setTime(null); setNotes('') } }, [opened])
  useEffect(() => {
    if (!opened || !date) { setDayList([]); return }
    let cancelled = false
    parlourApi.day(date).then((r) => { if (!cancelled) setDayList(r) }).catch(() => { if (!cancelled) setDayList([]) })
    return () => { cancelled = true }
  }, [opened, date])

  const sameTime = time ? dayList.filter((a) => a.status === 'BOOKED' && a.time?.slice(0, 5) === time).length : 0
  const valid = /^\d{10}$/.test(customer.mobile) && customer.name.trim().length > 0 && lines.length > 0 && Boolean(date) && Boolean(time)
  const save = async () => {
    setSaving(true)
    try { onSaved(await parlourApi.book({ customerName: customer.name.trim(), customerMobile: customer.mobile, date: date!, time: time!, lines: lines.map((l) => ({ itemId: l.itemId, quantity: l.quantity })), notes: notes.trim() || undefined, authorName: getAuthorName() })) }
    catch (e) { fail('Could not save the booking')(e) } finally { setSaving(false) }
  }

  return <Modal opened={opened} onClose={onClose} title="Book parlour services" size="xl" fullScreen={mobile} centered>
    <Stack>
      <Card withBorder padding="sm" radius="md"><CustomerPicker value={customer} onChange={setCustomer} /></Card>
      <Card withBorder padding="md" radius="md"><Title order={5} mb="sm">Tap services</Title><ServiceGrid picked={lines} onPick={(s) => setLines(addPick(lines, s))} /></Card>
      <Card withBorder padding="md" radius="md">
        <PickedLines value={lines} onChange={setLines} empty="Tap services above to add them." />
        {lines.length > 0 && <Group justify="space-between" mt="sm"><Text>Estimated amount</Text><Text fw={700}>{money(pickedTotal(lines))}</Text></Group>}
      </Card>
      <Card withBorder padding="md" radius="md"><Stack gap="sm">
        <SimpleGrid cols={{ base: 1, xs: 2 }}>
          <DateInput label="Date" value={date} onChange={setDate} minDate={todayIso()} required />
          <Select label="Time" placeholder="Pick a time" data={timeOptions} value={time} onChange={setTime} searchable required comboboxProps={{ withinPortal: true }} />
        </SimpleGrid>
        <Chip.Group value={time ?? ''} onChange={(v) => setTime(typeof v === 'string' ? v : null)}><Group gap="xs">{quickTimes.map((t) => <Chip key={t} value={t} size="md">{timeLabel(t)}</Chip>)}</Group></Chip.Group>
        {time && <Text size="sm" c={sameTime ? 'orange' : 'dimmed'}>{sameTime ? `${sameTime} other booking${sameTime === 1 ? '' : 's'} at ${timeLabel(time)} on this day.` : `No other bookings at ${timeLabel(time)}.`}</Text>}
        <TextInput label="Note" placeholder="Optional" value={notes} onChange={(e) => setNotes(e.currentTarget.value)} maxLength={500} />
      </Stack></Card>
      <Group justify="flex-end"><Button variant="default" size="md" onClick={onClose}>Cancel</Button><Button size="md" leftSection={<IconCalendarPlus size={18} />} loading={saving} disabled={!valid} onClick={() => void save()}>Save &amp; print slip</Button></Group>
    </Stack>
  </Modal>
}
