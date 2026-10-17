import { useEffect, useState } from 'react'
import { Button, Card, Divider, Group, Modal, NumberInput, Select, Stack, Text, TextInput, Textarea } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { IconCheck, IconPlus } from '@tabler/icons-react'
import { stitchApi, type StitchFabricBill, type StitchMeasurement, type StitchOrder } from '../../../api/outletApi'
import { money } from '../../../components/BillDetailsModal'
import { CustomerPicker, emptyCustomer, type PickedCustomer } from '../../../components/CustomerPicker'
import { GarmentFields, blankGarment, garmentPayload, garmentValid, type GarmentDraft } from './GarmentFields'
import { fail, getAuthorName, setAuthorName } from './shared'

// Fabric choice: the customer's own, an in-house purchase, or an in-house purchase linked to one of today's shop bills.
const OWN_FABRIC = 'own'
const IN_HOUSE = 'in-house'
const fabricPayload = (v: string) => v === OWN_FABRIC ? { fabricSource: 'OWN' as const, fabricBillId: null } : v === IN_HOUSE ? { fabricSource: 'IN_HOUSE' as const, fabricBillId: null } : { fabricSource: 'IN_HOUSE' as const, fabricBillId: Number(v) }

/** Take a stitching order: customer, garments (own date / price each), fabric, advance received. */
export function NewOrderModal({ opened, onClose, onSaved }: { opened: boolean; onClose: () => void; onSaved: (o: StitchOrder) => void }) {
  const mobile = useMediaQuery('(max-width: 48em)')
  const [customer, setCustomer] = useState<PickedCustomer>(emptyCustomer)
  const [garments, setGarments] = useState<GarmentDraft[]>([blankGarment()])
  const [fabric, setFabric] = useState<string>(OWN_FABRIC)
  const [notes, setNotes] = useState('')
  const [advance, setAdvance] = useState<number | string>('')
  const [author, setAuthor] = useState(getAuthorName() ?? '')
  const [previous, setPrevious] = useState<StitchMeasurement[]>([])
  const [fabricBills, setFabricBills] = useState<StitchFabricBill[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (opened) { setCustomer(emptyCustomer); setGarments([blankGarment()]); setFabric(OWN_FABRIC); setNotes(''); setAdvance(''); setAuthor(getAuthorName() ?? '') } }, [opened])
  // A known customer: offer their earlier measurements and today's shop bills (fabric bought here).
  useEffect(() => {
    if (!/^\d{10}$/.test(customer.mobile)) { setPrevious([]); setFabricBills([]); return }
    let cancelled = false
    stitchApi.measurements(customer.mobile).then((r) => { if (!cancelled) setPrevious(r) }).catch(() => { if (!cancelled) setPrevious([]) })
    stitchApi.fabricBills(customer.mobile).then((r) => { if (!cancelled) setFabricBills(r) }).catch(() => { if (!cancelled) setFabricBills([]) })
    return () => { cancelled = true }
  }, [customer.mobile])

  const priced = garments.filter((g) => g.amount !== '')
  const total = priced.reduce((s, g) => s + (Number(g.amount) || 0), 0)
  const unpriced = garments.length - priced.length
  const advanceNum = Number(advance) || 0
  const advanceTooBig = unpriced === 0 && advanceNum > total
  const valid = /^\d{10}$/.test(customer.mobile) && customer.name.trim().length > 0 && garments.every(garmentValid) && !advanceTooBig

  const setG = (n: number, g: GarmentDraft) => setGarments(garments.map((x, i) => (i === n ? g : x)))
  const save = async () => {
    setSaving(true)
    setAuthorName(author)
    try {
      const o = await stitchApi.create({ customerName: customer.name.trim(), customerMobile: customer.mobile, notes: notes.trim() || undefined, items: garments.map(garmentPayload), advance: advanceNum || undefined, ...fabricPayload(fabric), authorName: author.trim() || undefined })
      notifications.show({ color: 'green', title: 'Order saved', message: `${o.orderNumber} for ${o.customerName}` })
      onSaved(o)
    } catch (e) { fail('Could not save the order')(e) } finally { setSaving(false) }
  }

  return <Modal opened={opened} onClose={onClose} title="New stitching order" size="xl" fullScreen={mobile} centered>
    <Stack>
      <Card withBorder padding="sm" radius="md"><CustomerPicker value={customer} onChange={setCustomer} /></Card>
      {garments.map((g, n) => <GarmentFields key={n} title={`Garment ${n + 1}`} value={g} onChange={(v) => setG(n, v)} previous={previous} onRemove={garments.length > 1 ? () => setGarments(garments.filter((_, i) => i !== n)) : undefined} />)}
      {/* The last garment's date is offered for the next one; change it when needed earlier or later. */}
      <Button variant="light" size="md" leftSection={<IconPlus size={18} />} onClick={() => setGarments([...garments, blankGarment(garments[garments.length - 1]?.deliveryDate ?? null)])}>Add another garment</Button>
      <Card withBorder padding="md" radius="md"><Stack gap="sm">
        <Select label="Fabric" data={[{ value: OWN_FABRIC, label: "Customer's own fabric" }, { value: IN_HOUSE, label: 'In-house purchase' }, ...fabricBills.map((b) => ({ value: String(b.id), label: `In-house purchase · ${b.summary} · ${money(b.total)} (${b.billNumber})` }))]} value={fabric} onChange={(v) => setFabric(v ?? OWN_FABRIC)} allowDeselect={false} description={fabricBills.length ? "Today's shop bills of this customer are listed so you can link the fabric bill." : undefined} />
        <Textarea label="Order note" placeholder="Optional" autosize minRows={1} maxRows={4} value={notes} onChange={(e) => setNotes(e.currentTarget.value)} maxLength={1000} />
        <NumberInput label="Advance received" placeholder="₹0" prefix="₹" min={0} decimalScale={2} thousandSeparator="," value={advance} onChange={setAdvance} error={advanceTooBig ? `Advance cannot be more than the total (${money(total)})` : undefined} />
        <Divider />
        <Group justify="space-between"><Text>{unpriced ? `Total so far (${unpriced} price${unpriced === 1 ? '' : 's'} to add)` : 'Total'}</Text><Text fw={700}>{money(total)}</Text></Group>
        <Group justify="space-between"><Text>Advance</Text><Text fw={700}>{money(advanceNum)}</Text></Group>
        {unpriced === 0 && <Group justify="space-between"><Text fw={800}>Balance on delivery</Text><Text fw={800} size="lg">{money(Math.max(0, total - advanceNum))}</Text></Group>}
      </Stack></Card>
      <TextInput label="Your name (for the order log)" placeholder="Optional, remembered on this device" value={author} onChange={(e) => setAuthor(e.currentTarget.value)} maxLength={150} />
      <Group justify="flex-end"><Button variant="default" size="md" onClick={onClose}>Cancel</Button><Button size="md" leftSection={<IconCheck size={18} />} loading={saving} disabled={!valid} onClick={() => void save()}>Save &amp; print</Button></Group>
    </Stack>
  </Modal>
}
