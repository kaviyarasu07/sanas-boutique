import { useEffect, useState } from 'react'
import { Button, Group, Select } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { IconScan } from '@tabler/icons-react'
import { outletServiceApi, type OutletServiceItem } from '../api/outletApi'
import { ScanModal } from './ScanModal'

const ITEM_CODE = /^SB-\d+$/i

/**
 * Type to filter this outlet's products/services (name, ID or barcode) and pick one from the dropdown,
 * or scan its barcode: a USB/Bluetooth scanner types the code and presses Enter, the Scan button
 * uses the phone camera. A scanned item is added straight away.
 */
export function ItemPicker({ label = 'Add item', onPick, isDisabled }: { label?: string; onPick: (item: OutletServiceItem) => void; isDisabled?: (item: OutletServiceItem) => boolean }) {
  const [search, setSearch] = useState('')
  const [debounced] = useDebouncedValue(search.trim(), 250)
  const [found, setFound] = useState<OutletServiceItem[]>([])
  const [scanOpen, setScanOpen] = useState(false)

  useEffect(() => {
    if (!debounced) { setFound([]); return }
    let cancelled = false
    void outletServiceApi.searchItems(debounced).then((r) => { if (!cancelled) setFound(r.slice(0, 30)) }).catch(() => undefined)
    return () => { cancelled = true }
  }, [debounced])

  const pick = (item: OutletServiceItem) => { onPick(item); setSearch(''); setFound([]) }

  const scanned = async (code: string) => {
    try {
      const item = await outletServiceApi.itemByCode(code)
      if (!item.active || !item.allowed || isDisabled?.(item)) {
        notifications.show({ color: 'orange', title: 'Not available', message: `${item.name} cannot be added here.` })
        setSearch('')
        return
      }
      pick(item)
    } catch {
      notifications.show({ color: 'orange', title: 'Product not found', message: "We couldn't find a product with that code." })
    }
  }

  return <Group align="end" wrap="nowrap">
    <Select flex={1} label={label} placeholder="Type to search by name, ID or barcode" searchable data={found.map((i) => ({ value: String(i.id), label: `${i.name} · ${i.serviceName} · ₹${Number(i.price).toFixed(2)} ${i.priceUnitName}`, disabled: isDisabled?.(i) ?? false }))}
      filter={({ options }) => options} nothingFoundMessage={search.trim() ? 'No matching item' : 'Start typing…'} value={null} searchValue={search} onSearchChange={setSearch}
      onKeyDown={(e) => { if (e.key === 'Enter' && ITEM_CODE.test(search.trim())) { e.preventDefault(); void scanned(search) } }}
      onChange={(v) => { const item = found.find((i) => String(i.id) === v); if (item) pick(item) }} />
    <Button variant="light" leftSection={<IconScan size={16} />} onClick={() => setScanOpen(true)}>Scan</Button>
    <ScanModal opened={scanOpen} onClose={() => setScanOpen(false)} onCode={(c) => void scanned(c)} />
  </Group>
}
