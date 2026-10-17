import { useEffect, useState } from 'react'
import { Group, Select, Text, TextInput } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { IconUserPlus } from '@tabler/icons-react'
import { outletServiceApi } from '../api/outletApi'

export interface PickedCustomer { mobile: string; name: string; isNew: boolean }
export const emptyCustomer: PickedCustomer = { mobile: '', name: '', isNew: false }
const NEW = 'new:'

/**
 * Type a name or mobile number, pick the customer from the dropdown. A 10-digit number that
 * is not an existing customer of this outlet offers "Add new customer", and the name is then typed in
 * (the customer is created when the booking/bill is saved, as in billing).
 */
export function CustomerPicker({ value, onChange }: { value: PickedCustomer; onChange: (c: PickedCustomer) => void }) {
  const [search, setSearch] = useState('')
  const [debounced] = useDebouncedValue(search.trim(), 250)
  const [found, setFound] = useState<{ mobile: string; name: string }[]>([])

  useEffect(() => {
    if (!debounced) { setFound([]); return }
    let cancelled = false
    void outletServiceApi.customers({ search: debounced }).then((p) => { if (!cancelled) setFound(p.content.slice(0, 20).map((c) => ({ mobile: c.mobileNumber, name: c.name }))) }).catch(() => undefined)
    return () => { cancelled = true }
  }, [debounced])

  const digits = /^\d{10}$/.test(search.trim()) ? search.trim() : ''
  const options = found.map((c) => ({ value: c.mobile, label: `${c.mobile} · ${c.name}` }))
  if (digits && !found.some((c) => c.mobile === digits)) options.push({ value: NEW + digits, label: `＋ Add new customer ${digits}` })
  if (value.mobile && !options.some((o) => o.value === (value.isNew ? NEW : '') + value.mobile)) options.push({ value: (value.isNew ? NEW : '') + value.mobile, label: value.isNew ? `${value.mobile} · new customer` : `${value.mobile} · ${value.name}` })

  const pick = (v: string | null) => {
    if (!v) { onChange(emptyCustomer); return }
    if (v.startsWith(NEW)) { onChange({ mobile: v.slice(NEW.length), name: '', isNew: true }); return }
    const c = found.find((x) => x.mobile === v)
    onChange({ mobile: v, name: c?.name ?? value.name, isNew: false })
  }

  return <div>
    <Select label="Customer" placeholder="Search by name or mobile number" searchable clearable data={options} filter={({ options: all }) => all} nothingFoundMessage={search.trim() ? 'No customer found - type the full 10-digit number to add a new one' : 'Start typing…'}
      value={value.mobile ? (value.isNew ? NEW : '') + value.mobile : null} searchValue={search} onSearchChange={setSearch} onChange={pick} />
    {value.mobile && value.isNew && <Group align="end" mt="xs" wrap="nowrap"><TextInput flex={1} label="New customer name" placeholder="Enter customer name" value={value.name} onChange={(e) => onChange({ ...value, name: e.currentTarget.value })} /></Group>}
    {value.mobile && value.isNew && <Text size="xs" c="dimmed" mt={4}><IconUserPlus size={14} /> {value.mobile} will be added as a new customer.</Text>}
    {value.mobile && !value.isNew && <Text size="xs" c="dimmed" mt={4}>{value.name} · {value.mobile}</Text>}
  </div>
}
