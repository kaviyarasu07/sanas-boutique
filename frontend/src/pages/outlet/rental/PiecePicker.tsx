import { useEffect, useState } from 'react'
import { ActionIcon, Alert, Badge, Button, Group, Select, Stack, Text } from '@mantine/core'
import { IconMinus, IconPlus, IconScan, IconTrash } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { rentalApi, type Availability, type RentalProduct } from '../../../api/outletApi'
import { money } from '../../../components/BillDetailsModal'
import { ScanModal } from '../../../components/ScanModal'

/** A piece chosen for a rental; `added` marks pieces added at hand-over. */
export interface PickedPiece { itemId: number; name: string; pricePerDay: number; quantity: number; added?: boolean }

export const addPiece = (list: PickedPiece[], p: RentalProduct, added = false): PickedPiece[] =>
  list.some((x) => x.itemId === p.id) ? list.map((x) => (x.itemId === p.id ? { ...x, quantity: x.quantity + 1 } : x)) : [...list, { itemId: p.id, name: p.name, pricePerDay: p.pricePerDay, quantity: 1, added }]
export const perDay = (list: PickedPiece[]) => list.reduce((s, p) => s + p.pricePerDay * p.quantity, 0)

/** "Add jewellery": search-and-select (or scan the product barcode). Picking adds it (or one more). */
export function AddPieceSelect({ onPick }: { onPick: (p: RentalProduct) => void }) {
  const [products, setProducts] = useState<RentalProduct[] | null>(null)
  const [error, setError] = useState(false)
  const [scanning, setScanning] = useState(false)
  const load = () => { setError(false); rentalApi.products().then(setProducts).catch(() => setError(true)) }
  useEffect(load, [])
  if (error) return <Alert color="red" p="xs">Could not load the jewellery list. <Button size="compact-sm" variant="light" ml="xs" onClick={load}>Try again</Button></Alert>
  const pick = (id: string | null) => { const p = products?.find((x) => String(x.id) === id); if (p) onPick(p) }
  const scanned = (code: string) => {
    const p = products?.find((x) => x.itemCode?.toLowerCase() === code.trim().toLowerCase())
    if (p) onPick(p); else notifications.show({ color: 'orange', title: 'Not found', message: "We couldn't find a rental piece with that code." })
  }
  return <Group align="flex-end" wrap="nowrap" gap="xs">
    <Select
      style={{ flex: 1 }}
      size="md"
      leftSection={<IconPlus size={18} />}
      placeholder={products === null ? 'Loading jewellery…' : products.length ? 'Add jewellery (type name or code)' : 'No rental pieces yet. Add them on the Products page.'}
      data={(products ?? []).map((p) => ({ value: String(p.id), label: `${p.name}${p.itemCode ? ` (${p.itemCode})` : ''} · ${money(p.pricePerDay)}/day${p.inStock != null ? ` · ${p.inStock} in stock` : ''}` }))}
      value={null}
      onChange={pick}
      searchable
      disabled={!products?.length}
      nothingFoundMessage="No piece with that name or code"
      maxDropdownHeight={320}
      comboboxProps={{ withinPortal: true }}
      aria-label="Add jewellery"
    />
    <Button size="md" variant="light" leftSection={<IconScan size={18} />} onClick={() => setScanning(true)} disabled={!products?.length}>Scan</Button>
    <ScanModal opened={scanning} onClose={() => setScanning(false)} onCode={(c) => { setScanning(false); scanned(c) }} />
  </Group>
}

/**
 * The chosen pieces with +/− and remove, and a live "Available / booked by …" badge for the dates.
 */
export function PieceLines({ value, onChange, from, to, empty, checkAvailability = true, onAvailability }: {
  value: PickedPiece[]; onChange: (v: PickedPiece[]) => void; from: string | null; to: string | null; empty: string; checkAvailability?: boolean
  onAvailability?: (allFree: boolean) => void
}) {
  const [avail, setAvail] = useState<Record<number, Availability | 'error'>>({})
  const key = value.map((p) => `${p.itemId}x${p.quantity}`).join(',')
  useEffect(() => {
    if (!checkAvailability || !from || !to || to < from || !value.length) { setAvail({}); onAvailability?.(true); return }
    let cancelled = false
    void Promise.all(value.map((p) => rentalApi.availability(p.itemId, from, to, p.quantity).then((a) => [p.itemId, a] as const).catch(() => [p.itemId, 'error' as const] as const)))
      .then((pairs) => { if (cancelled) return; const m = Object.fromEntries(pairs); setAvail(m); onAvailability?.(pairs.every(([, a]) => a !== 'error' && a.available)) })
    return () => { cancelled = true }
  }, [key, from, to, checkAvailability]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!value.length) return <Text c="dimmed" size="sm">{empty}</Text>
  const set = (id: number, q: number) => onChange(q <= 0 ? value.filter((p) => p.itemId !== id) : value.map((p) => (p.itemId === id ? { ...p, quantity: Math.min(1000, q) } : p)))
  return <Stack gap="xs">{value.map((p) => {
    const a = avail[p.itemId]
    return <div key={p.itemId}>
      <Group justify="space-between" wrap="nowrap">
        <div style={{ minWidth: 0 }}>
          <Text fw={600}>{p.name} {p.added && <Badge size="xs" variant="light" color="violet">added</Badge>}</Text>
          <Text size="xs" c="dimmed">{money(p.pricePerDay)} per day</Text>
        </div>
        <Group gap={6} wrap="nowrap">
          <ActionIcon variant="default" size="lg" onClick={() => set(p.itemId, p.quantity - 1)} aria-label={`One less ${p.name}`}><IconMinus size={16} /></ActionIcon>
          <Text fw={700} w={24} ta="center">{p.quantity}</Text>
          <ActionIcon variant="default" size="lg" onClick={() => set(p.itemId, p.quantity + 1)} aria-label={`One more ${p.name}`}><IconPlus size={16} /></ActionIcon>
          <ActionIcon variant="subtle" color="red" size="lg" onClick={() => set(p.itemId, 0)} aria-label={`Remove ${p.name}`}><IconTrash size={16} /></ActionIcon>
        </Group>
      </Group>
      {checkAvailability && from && to && (a === undefined ? <Text size="xs" c="dimmed">Checking…</Text> : a === 'error' ? <Badge color="gray" variant="light">Could not check</Badge> : a.available ? <Badge color="teal" variant="light">Available</Badge> : <Text size="xs" c="red" fw={600}>{a.reason}</Text>)}
    </div>
  })}</Stack>
}
