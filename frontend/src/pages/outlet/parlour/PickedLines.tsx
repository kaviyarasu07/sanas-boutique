import { ActionIcon, Group, Stack, Text } from '@mantine/core'
import { IconMinus, IconPlus, IconTrash } from '@tabler/icons-react'
import { money } from '../../../components/BillDetailsModal'
import type { PickedService } from './ServiceGrid'

/** Add one of a service (or a new line). */
export const addPick = (list: PickedService[], s: { itemId: number; name: string; price: number }): PickedService[] =>
  list.some((p) => p.itemId === s.itemId) ? list.map((p) => (p.itemId === s.itemId ? { ...p, quantity: p.quantity + 1 } : p)) : [...list, { ...s, quantity: 1 }]

export const pickedTotal = (list: PickedService[]) => list.reduce((s, p) => s + p.price * p.quantity, 0)

/** The chosen services with big +/− and remove buttons. */
export function PickedLines({ value, onChange, empty }: { value: PickedService[]; onChange: (v: PickedService[]) => void; empty: string }) {
  if (!value.length) return <Text c="dimmed" size="sm">{empty}</Text>
  const set = (id: number, q: number) => onChange(q <= 0 ? value.filter((p) => p.itemId !== id) : value.map((p) => (p.itemId === id ? { ...p, quantity: Math.min(100, q) } : p)))
  return <Stack gap="xs">{value.map((p) => <Group key={p.itemId} justify="space-between" wrap="nowrap">
    <div style={{ minWidth: 0 }}><Text fw={600}>{p.name}</Text><Text size="xs" c="dimmed">{money(p.price)} each</Text></div>
    <Group gap={6} wrap="nowrap">
      <ActionIcon variant="default" size="lg" onClick={() => set(p.itemId, p.quantity - 1)} aria-label={`One less ${p.name}`}><IconMinus size={16} /></ActionIcon>
      <Text fw={700} w={24} ta="center">{p.quantity}</Text>
      <ActionIcon variant="default" size="lg" onClick={() => set(p.itemId, p.quantity + 1)} aria-label={`One more ${p.name}`}><IconPlus size={16} /></ActionIcon>
      <Text fw={600} w={86} ta="right">{money(p.price * p.quantity)}</Text>
      <ActionIcon variant="subtle" color="red" size="lg" onClick={() => set(p.itemId, 0)} aria-label={`Remove ${p.name}`}><IconTrash size={16} /></ActionIcon>
    </Group>
  </Group>)}</Stack>
}
