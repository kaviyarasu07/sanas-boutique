import { useEffect, useState } from 'react'
import { Alert, Button, Select } from '@mantine/core'
import { IconPlus } from '@tabler/icons-react'
import { parlourApi, type ParlourServiceGroup } from '../../../api/outletApi'
import { money } from '../../../components/BillDetailsModal'

/**
 * "Add a service" for a bill: search-and-select from this outlet's parlour services, grouped by
 * service, price shown. Picking one adds it to the bill (or one more of it) and clears the box.
 */
export function AddServiceSelect({ onPick }: { onPick: (s: { itemId: number; name: string; price: number }) => void }) {
  const [groups, setGroups] = useState<ParlourServiceGroup[] | null>(null)
  const [error, setError] = useState(false)
  const load = () => { setError(false); parlourApi.services().then(setGroups).catch(() => setError(true)) }
  useEffect(load, [])

  if (error) return <Alert color="red" p="xs">Could not load the services. <Button size="compact-sm" variant="light" ml="xs" onClick={load}>Try again</Button></Alert>
  const data = (groups ?? []).map((g) => ({ group: g.serviceName, items: g.items.map((i) => ({ value: String(i.id), label: `${i.name} · ${money(i.price)}` })) }))
  const pick = (id: string | null) => {
    for (const g of groups ?? []) {
      const i = g.items.find((x) => String(x.id) === id)
      if (i) { onPick({ itemId: i.id, name: i.name, price: i.price }); return }
    }
  }
  return <Select
    size="md"
    leftSection={<IconPlus size={18} />}
    placeholder={groups === null ? 'Loading services…' : groups.length ? 'Add a service (type to search)' : 'No parlour services yet. Add them on the Products page.'}
    data={data}
    value={null}
    onChange={pick}
    searchable
    clearable={false}
    disabled={!groups?.length}
    nothingFoundMessage="No service with that name"
    maxDropdownHeight={320}
    comboboxProps={{ withinPortal: true }}
    aria-label="Add a service"
  />
}
