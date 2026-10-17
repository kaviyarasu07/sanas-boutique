import { ActionIcon, Card, Group, NumberInput, SegmentedControl, Select, SimpleGrid, Stack, Text, TextInput, Textarea } from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { IconScissors, IconTrash } from '@tabler/icons-react'
import type { StitchMeasurement } from '../../../api/outletApi'
import { todayIso } from '../../../components/BillDetailsModal'
import { fmtDate } from '../../../config/dateFormat'

/** One garment being entered. copiedFromItemId: the earlier garment whose measurements were reused. */
export interface GarmentDraft { garment: string; measurements: string; notes: string; deliveryDate: string | null; amount: number | string; copiedFromItemId: number | null; measureMode: 'fresh' | 'previous' }
export const blankGarment = (deliveryDate: string | null = null): GarmentDraft => ({ garment: '', measurements: '', notes: '', deliveryDate, amount: '', copiedFromItemId: null, measureMode: 'fresh' })
export const garmentValid = (g: GarmentDraft) => g.garment.trim().length > 0 && Boolean(g.deliveryDate)
export const garmentPayload = (g: GarmentDraft) => ({ garment: g.garment.trim(), measurements: g.measurements.trim() || undefined, notes: g.notes.trim() || undefined, deliveryDate: g.deliveryDate!, amount: g.amount === '' ? null : Number(g.amount), copiedFromItemId: g.copiedFromItemId })

/**
 * Garment name and price are typed by the outlet (every job is different). Measurements: "Use
 * previous" picks one of the customer's earlier measurements (copied in, still editable) or
 * "Enter fresh". Delivery date from the calendar. allowPastDate: editing an already-late garment.
 */
export function GarmentFields({ value, onChange, previous, title, onRemove, allowPastDate }: { value: GarmentDraft; onChange: (g: GarmentDraft) => void; previous: StitchMeasurement[]; title?: string; onRemove?: () => void; allowPastDate?: boolean }) {
  const set = (patch: Partial<GarmentDraft>) => onChange({ ...value, ...patch })
  const options = previous.map((m) => ({ value: String(m.itemId), label: `${m.garment} · ${m.measuredOn ? fmtDate(m.measuredOn) : 'earlier'} · ${m.orderNumber}` }))
  const pick = (id: string | null) => {
    const m = previous.find((p) => String(p.itemId) === id)
    set(m ? { copiedFromItemId: m.itemId, measurements: m.measurements } : { copiedFromItemId: null })
  }
  return <Card withBorder padding="md" radius="md">
    <Stack gap="sm">
      <Group justify="space-between">
        <Group gap={6}><IconScissors size={16} /><Text fw={700}>{title ?? 'Garment'}</Text></Group>
        {onRemove && <ActionIcon variant="subtle" color="red" size="lg" onClick={onRemove} aria-label="Remove garment"><IconTrash size={18} /></ActionIcon>}
      </Group>
      <TextInput label="Garment" placeholder="e.g. Blouse with boat neck" value={value.garment} onChange={(e) => set({ garment: e.currentTarget.value })} maxLength={150} required />
      <div>
        <Text size="sm" fw={500} mb={4}>Measurements</Text>
        {previous.length > 0 && <SegmentedControl fullWidth mb="xs" value={value.measureMode} onChange={(v) => set(v === 'fresh' ? { measureMode: 'fresh', copiedFromItemId: null, measurements: '' } : { measureMode: 'previous' })} data={[{ value: 'previous', label: 'Use previous measurements' }, { value: 'fresh', label: 'Enter fresh measurements' }]} />}
        {value.measureMode === 'previous' && previous.length > 0 && <Select mb="xs" placeholder="Pick earlier measurements" data={options} value={value.copiedFromItemId ? String(value.copiedFromItemId) : null} onChange={pick} searchable nothingFoundMessage="No earlier measurements" comboboxProps={{ withinPortal: true }} />}
        <Textarea placeholder="e.g. Bust 36, Waist 30, Length 15, Sleeve 12" autosize minRows={2} maxRows={8} value={value.measurements} onChange={(e) => set({ measurements: e.currentTarget.value })} maxLength={2000} />
      </div>
      <SimpleGrid cols={{ base: 1, xs: 2 }}>
        <DateInput label="Delivery date" placeholder="Pick from calendar" value={value.deliveryDate} onChange={(v) => set({ deliveryDate: v })} minDate={allowPastDate ? undefined : todayIso()} required />
        <NumberInput label="Price" placeholder="Add later" prefix="₹" min={0} decimalScale={2} thousandSeparator="," value={value.amount} onChange={(v) => set({ amount: v })} />
      </SimpleGrid>
      <TextInput label="Note for this garment" placeholder="Optional" value={value.notes} onChange={(e) => set({ notes: e.currentTarget.value })} maxLength={1000} />
    </Stack>
  </Card>
}
