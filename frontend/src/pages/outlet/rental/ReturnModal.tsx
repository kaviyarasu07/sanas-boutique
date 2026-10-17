import { useEffect, useState } from 'react'
import { Alert, Button, Card, Chip, Divider, Group, Modal, NumberInput, SegmentedControl, SimpleGrid, Stack, Text, TextInput, Title } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { IconAlertTriangle, IconCircleCheck, IconCircleX, IconFileInvoice } from '@tabler/icons-react'
import { rentalApi, type RentalBooking, type RentalItem } from '../../../api/outletApi'
import { getAuthorName } from '../../../components/authorName'
import { money, todayIso } from '../../../components/BillDetailsModal'
import { fmtDate } from '../../../config/dateFormat'
import { damageNotes, daysText, fail, rentalDays } from './shared'

/** What came back for one piece; checked = every piece given is counted. */
interface Check { ok: number; damaged: number; repair: number; missing: number; damageCharge: number | string; damageNote: string; missingCharge: number | string; missingTouched: boolean; checked: boolean }
const blank = (): Check => ({ ok: 0, damaged: 0, repair: 0, missing: 0, damageCharge: '', damageNote: '', missingCharge: '', missingTouched: false, checked: false })
const num = (v: number | string) => Number(v) || 0

/**
 * Return check: every piece given is marked OK / Damaged / Missing (counters for several of the same
 * piece). Damaged → charge, note, back to stock or send for repair. Missing → charge pre-filled from
 * "Value if lost". The bill preview builds itself; Generate unlocks only when every piece is checked,
 * then asks once more in plain words.
 */
export function ReturnModal({ booking, onClose, onDone }: { booking: RentalBooking | null; onClose: () => void; onDone: (b: RentalBooking) => void }) {
  const mobile = useMediaQuery('(max-width: 48em)')
  const [checks, setChecks] = useState<Record<number, Check>>({})
  const [discount, setDiscount] = useState<number | string>(0)
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)
  useEffect(() => { setChecks(Object.fromEntries((booking?.items ?? []).map((i) => [i.itemId, blank()]))); setDiscount(0); setConfirming(false) }, [booking])
  if (!booking) return null

  const days = rentalDays(booking.handedOverOn ?? booking.startDate, todayIso())
  const set = (i: RentalItem, patch: Partial<Check>) => setChecks((all) => {
    const c = { ...all[i.itemId], ...patch }
    c.repair = Math.min(c.repair, c.damaged)
    // Missing charge follows "Value if lost" × missing until staff type their own amount.
    if (!c.missingTouched) c.missingCharge = c.missing > 0 && i.replacementValue != null ? i.replacementValue * c.missing : ''
    c.checked = c.ok + c.damaged + c.missing === i.quantity
    return { ...all, [i.itemId]: c }
  })
  const rent = booking.items.reduce((s, i) => s + i.pricePerDay * i.quantity * days, 0)
  const damage = booking.items.reduce((s, i) => s + (checks[i.itemId]?.damaged ? num(checks[i.itemId].damageCharge) : 0), 0)
  const missing = booking.items.reduce((s, i) => s + (checks[i.itemId]?.missing ? num(checks[i.itemId].missingCharge) : 0), 0)
  const subtotal = rent + damage + missing
  const disc = Math.min(num(discount), subtotal)
  const allChecked = booking.items.every((i) => checks[i.itemId]?.checked)
  const chargesOk = booking.items.every((i) => { const c = checks[i.itemId]; return !c || ((c.damaged === 0 || c.damageCharge !== '') && (c.missing === 0 || c.missingCharge !== '')) })
  const given = booking.items.reduce((s, i) => s + i.quantity, 0)
  const totals = booking.items.reduce((t, i) => { const c = checks[i.itemId] ?? blank(); return { ok: t.ok + c.ok, damaged: t.damaged + c.damaged, missing: t.missing + c.missing, repair: t.repair + c.repair } }, { ok: 0, damaged: 0, missing: 0, repair: 0 })

  const save = async () => {
    setSaving(true)
    try {
      onDone(await rentalApi.returnRental(booking.id, {
        discount: disc,
        items: booking.items.map((i) => { const c = checks[i.itemId]; return { itemId: i.itemId, okQty: c.ok, damagedQty: c.damaged, repairQty: c.repair, missingQty: c.missing, damageCharge: c.damaged ? num(c.damageCharge) : null, damageNote: c.damageNote.trim() || undefined, missingCharge: c.missing ? num(c.missingCharge) : null } }),
        authorName: getAuthorName(),
      }))
    } catch (e) { fail('Could not make the bill')(e); setConfirming(false) } finally { setSaving(false) }
  }

  return <Modal opened onClose={onClose} title={`Return & bill · ${booking.bookingNumber}`} size="xl" fullScreen={mobile} centered>
    <Stack>
      <Alert variant="light" color="violet" title={`${booking.customerName} · ${booking.customerMobile}`}>
        Given {given} piece{given === 1 ? '' : 's'} on {fmtDate(booking.handedOverOn ?? booking.startDate)} · due back {fmtDate(booking.returnDate)} · {booking.items.filter((i) => checks[i.itemId]?.checked).length} of {booking.items.length} checked
      </Alert>

      {booking.items.map((i) => {
        const c = checks[i.itemId] ?? blank()
        const single = i.quantity === 1
        return <Card key={i.itemId} withBorder padding="md" radius="md" style={{ borderColor: c.checked ? 'var(--mantine-color-teal-5)' : undefined }}>
          <Group justify="space-between" mb="sm"><div><Text fw={700} size="lg">{i.name}{i.quantity > 1 ? ` × ${i.quantity}` : ''}</Text><Text size="xs" c="dimmed">{i.itemCode ?? ''} · {money(i.pricePerDay)} per day</Text></div>{c.checked && <IconCircleCheck color="var(--mantine-color-teal-6)" />}</Group>
          {single
            ? <SimpleGrid cols={3} spacing="xs">
              <Button size="md" variant={c.checked && c.ok ? 'filled' : 'light'} color="teal" leftSection={<IconCircleCheck size={18} />} onClick={() => set(i, { ok: 1, damaged: 0, repair: 0, missing: 0 })}>Returned OK</Button>
              <Button size="md" variant={c.damaged ? 'filled' : 'light'} color="orange" leftSection={<IconAlertTriangle size={18} />} onClick={() => set(i, { ok: 0, damaged: 1, missing: 0 })}>Damaged</Button>
              <Button size="md" variant={c.missing ? 'filled' : 'light'} color="red" leftSection={<IconCircleX size={18} />} onClick={() => set(i, { ok: 0, damaged: 0, repair: 0, missing: 1 })}>Missing</Button>
            </SimpleGrid>
            : <><SimpleGrid cols={3} spacing="xs">
              <NumberInput label="Returned OK" min={0} max={i.quantity} allowDecimal={false} value={c.ok} onChange={(v) => set(i, { ok: num(v) })} />
              <NumberInput label="Damaged" min={0} max={i.quantity} allowDecimal={false} value={c.damaged} onChange={(v) => set(i, { damaged: num(v) })} />
              <NumberInput label="Missing" min={0} max={i.quantity} allowDecimal={false} value={c.missing} onChange={(v) => set(i, { missing: num(v) })} />
            </SimpleGrid>
              <Group mt="xs" justify="space-between"><Button size="xs" variant="subtle" onClick={() => set(i, { ok: i.quantity, damaged: 0, repair: 0, missing: 0 })}>All {i.quantity} returned OK</Button>{!c.checked && <Text size="xs" c="orange">{c.ok + c.damaged + c.missing} of {i.quantity} counted</Text>}</Group></>}

          {c.damaged > 0 && <Card withBorder mt="sm" padding="sm" radius="md" bg="var(--mantine-color-orange-light)"><Stack gap="xs">
            <NumberInput label={`Damage charge${c.damaged > 1 ? ` (for ${c.damaged})` : ''}`} description="0 to waive it" prefix="₹" min={0} decimalScale={2} thousandSeparator="," value={c.damageCharge} onChange={(v) => set(i, { damageCharge: v })} />
            <Chip.Group value={c.damageNote} onChange={(v) => set(i, { damageNote: typeof v === 'string' ? v : '' })}><Group gap={6}>{damageNotes.map((n) => <Chip key={n} value={n} size="sm">{n}</Chip>)}</Group></Chip.Group>
            <TextInput placeholder="Or type a note" value={c.damageNote} onChange={(e) => set(i, { damageNote: e.currentTarget.value })} maxLength={200} />
            {c.damaged === 1
              ? <SegmentedControl fullWidth value={c.repair ? 'repair' : 'stock'} onChange={(v) => set(i, { repair: v === 'repair' ? 1 : 0 })} data={[{ value: 'stock', label: 'Back to stock' }, { value: 'repair', label: '🔧 Send for repair' }]} />
              : <NumberInput label="How many go for repair?" description={`The other ${c.damaged - c.repair} go back to stock`} min={0} max={c.damaged} allowDecimal={false} value={c.repair} onChange={(v) => set(i, { repair: num(v) })} />}
          </Stack></Card>}
          {c.missing > 0 && <Card withBorder mt="sm" padding="sm" radius="md" bg="var(--mantine-color-red-light)">
            <NumberInput label={`Missing charge${c.missing > 1 ? ` (for ${c.missing})` : ''}`} description={i.replacementValue != null ? `Value if lost: ${money(i.replacementValue)} per piece` : 'No "Value if lost" set for this piece'} prefix="₹" min={0} decimalScale={2} thousandSeparator="," value={c.missingCharge} onChange={(v) => set(i, { missingCharge: v, missingTouched: true })} />
            <Text size="xs" c="dimmed" mt={4}>Missing pieces are removed from stock.</Text>
          </Card>}
        </Card>
      })}

      <Card withBorder padding="md" radius="md">
        <Title order={5} mb="xs">Bill</Title>
        <Group justify="space-between"><Text>Rent · {daysText(days)}</Text><Text fw={600}>{money(rent)}</Text></Group>
        {damage > 0 && <Group justify="space-between"><Text>Damage</Text><Text fw={600}>{money(damage)}</Text></Group>}
        {missing > 0 && <Group justify="space-between"><Text>Missing</Text><Text fw={600}>{money(missing)}</Text></Group>}
        <Group justify="space-between" mt={6}><Text>Discount</Text><NumberInput w={140} prefix="₹" min={0} max={subtotal} decimalScale={2} thousandSeparator="," value={discount} onChange={setDiscount} aria-label="Discount" /></Group>
        <Divider my="sm" />
        <Group justify="space-between"><Text fw={800}>Total</Text><Text fw={800} size="xl">{money(subtotal - disc)}</Text></Group>
        <Text size="xs" c="dimmed">Rent = price per day × {daysText(days)} (taken {fmtDate(booking.handedOverOn ?? booking.startDate)}, returned today){booking.returnDate < todayIso() ? '. Late days are charged at the same price.' : ''}</Text>
      </Card>

      {confirming
        ? <Alert color="blue" title="Is this correct?">
          Given {given} · Returned {totals.ok + totals.damaged}{totals.damaged ? ` (${totals.damaged} damaged${totals.repair ? `, ${totals.repair} to repair` : ''})` : ''} · Missing {totals.missing}. Total {money(subtotal - disc)}.
          <Group mt="sm" justify="flex-end"><Button variant="default" onClick={() => setConfirming(false)}>Go back</Button><Button leftSection={<IconFileInvoice size={17} />} loading={saving} onClick={() => void save()}>Yes, generate bill</Button></Group>
        </Alert>
        : <Group justify="flex-end"><Button variant="default" size="md" onClick={onClose}>Back</Button><Button size="md" leftSection={<IconFileInvoice size={18} />} disabled={!allChecked || !chargesOk} onClick={() => setConfirming(true)}>{allChecked ? (chargesOk ? 'Generate bill' : 'Enter the charges') : 'Check every piece first'}</Button></Group>}
    </Stack>
  </Modal>
}
