import { useEffect, useState } from 'react'
import { Alert, Badge, Button, Card, Group, Loader, SimpleGrid, Stack, Text, TextInput, Title, UnstyledButton } from '@mantine/core'
import { IconSearch } from '@tabler/icons-react'
import { parlourApi, type ParlourServiceGroup } from '../../../api/outletApi'
import { money } from '../../../components/BillDetailsModal'

export interface PickedService { itemId: number; name: string; price: number; quantity: number }

/**
 * Parlour services as big buttons grouped by service; tapping adds one (tap again for one more).
 * A small filter box helps when the list is long. Prices are fixed (the outlet's service price).
 */
export function ServiceGrid({ picked, onPick }: { picked: PickedService[]; onPick: (s: { itemId: number; name: string; price: number }) => void }) {
  const [groups, setGroups] = useState<ParlourServiceGroup[] | null>(null)
  const [error, setError] = useState(false)
  const [filter, setFilter] = useState('')
  const load = () => { setError(false); parlourApi.services().then(setGroups).catch(() => setError(true)) }
  useEffect(load, [])

  if (error) return <Alert color="red" title="Could not load the services">Please check the internet. <Button size="xs" variant="light" ml="sm" onClick={load}>Try again</Button></Alert>
  if (!groups) return <Group justify="center" py="md"><Loader size="sm" /><Text c="dimmed">Loading services…</Text></Group>
  if (!groups.length) return <Text c="dimmed" ta="center" py="md">No parlour services yet. Add them on the Products page.</Text>

  const f = filter.trim().toLowerCase()
  const shown = groups.map((g) => ({ ...g, items: g.items.filter((i) => !f || i.name.toLowerCase().includes(f) || g.serviceName.toLowerCase().includes(f)) })).filter((g) => g.items.length)
  const qty = (id: number) => picked.find((p) => p.itemId === id)?.quantity ?? 0
  return <Stack gap="sm">
    {groups.reduce((n, g) => n + g.items.length, 0) > 12 && <TextInput placeholder="Find a service" leftSection={<IconSearch size={16} />} value={filter} onChange={(e) => setFilter(e.currentTarget.value)} />}
    {shown.map((g) => <div key={g.serviceId}>
      {groups.length > 1 && <Title order={6} c="dimmed" mb={6}>{g.serviceName}</Title>}
      <SimpleGrid cols={{ base: 2, xs: 3, md: 4 }} spacing="xs">{g.items.map((i) => {
        const n = qty(i.id)
        return <UnstyledButton key={i.id} onClick={() => onPick({ itemId: i.id, name: i.name, price: i.price })} aria-label={`Add ${i.name}`}>
          <Card withBorder radius="md" padding="sm" h="100%" style={{ borderColor: n ? 'var(--mantine-color-violet-5)' : undefined, borderWidth: n ? 2 : undefined, minHeight: 72 }}>
            <Group justify="space-between" align="flex-start" wrap="nowrap" gap={4}>
              <Text fw={600} size="sm" lh={1.25}>{i.name}</Text>
              {n > 0 && <Badge circle size="lg" color="violet">{n}</Badge>}
            </Group>
            <Text size="sm" c="dimmed" mt={4}>{money(i.price)}</Text>
          </Card>
        </UnstyledButton>
      })}</SimpleGrid>
    </div>)}
    {!shown.length && <Text c="dimmed" size="sm">No service matches "{filter}".</Text>}
  </Stack>
}
