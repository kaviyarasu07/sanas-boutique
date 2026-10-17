import { useEffect, useState } from 'react'
import { Alert, Badge, Button, Card, Group, Loader, Modal, SimpleGrid, Stack, Switch, Table, Text, TextInput, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconEdit } from '@tabler/icons-react'
import { billingModuleApi, extractErrorMessage, type BillingModule } from '../../api/catalogApi'
import { BILLING_ICONS, billingIcon } from '../../config/modules'

/**
 * Franchisor: the simple billing modules created from the Services screen ("＋ Create a separate
 * billing module…"). Rename, change the icon, or switch one off (hidden at every outlet; its bills
 * stay). The bill code never changes.
 */
export function BillingModulesPage() {
  const [list, setList] = useState<BillingModule[] | null>(null)
  const [error, setError] = useState(false)
  const [editing, setEditing] = useState<BillingModule | null>(null)
  const load = () => { setError(false); billingModuleApi.list().then(setList).catch(() => setError(true)) }
  useEffect(load, [])

  const toggle = async (m: BillingModule) => {
    try { await billingModuleApi.setActive(m.id, !m.active); load() }
    catch (e) { notifications.show({ color: 'red', title: 'Could not update', message: extractErrorMessage(e) }) }
  }

  return <Stack gap="lg">
    <div><Title order={2}>Billing modules</Title><Text c="dimmed" size="sm">Separate billing modules you created for new services. Create one from Services → Add service → Module.</Text></div>
    <Card withBorder radius="md">
      {error && <Alert color="red" title="Could not load the list">Please try again. <Button size="xs" variant="light" ml="sm" onClick={load}>Try again</Button></Alert>}
      {!error && list === null && <Group justify="center" py="lg"><Loader size="sm" /><Text c="dimmed">Loading…</Text></Group>}
      {list && !list.length && <Text c="dimmed" ta="center" py="lg">No billing modules yet. When you add a service, choose “＋ Create a separate billing module…” in Module.</Text>}
      {list && list.length > 0 && <Table verticalSpacing="sm"><Table.Thead><Table.Tr><Table.Th>Module</Table.Th><Table.Th>Bill code</Table.Th><Table.Th>Services</Table.Th><Table.Th>Active</Table.Th><Table.Th /></Table.Tr></Table.Thead><Table.Tbody>{list.map((m) => {
        const Icon = billingIcon(m.icon)
        return <Table.Tr key={m.id}>
          <Table.Td><Group gap="xs"><Icon size={18} /><Text fw={600}>{m.name}</Text></Group></Table.Td>
          <Table.Td><Badge variant="light">{m.code}</Badge></Table.Td>
          <Table.Td>{m.serviceCount}</Table.Td>
          <Table.Td><Switch checked={m.active} onChange={() => void toggle(m)} aria-label={`${m.name} active`} /></Table.Td>
          <Table.Td><Button size="xs" variant="subtle" leftSection={<IconEdit size={14} />} onClick={() => setEditing(m)}>Edit</Button></Table.Td>
        </Table.Tr>
      })}</Table.Tbody></Table>}
    </Card>
    <EditModal module={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />
  </Stack>
}

function EditModal({ module, onClose, onSaved }: { module: BillingModule | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('bag')
  const [saving, setSaving] = useState(false)
  useEffect(() => { setName(module?.name ?? ''); setIcon(module?.icon ?? 'bag') }, [module])
  if (!module) return null
  const save = async () => {
    setSaving(true)
    try { await billingModuleApi.update(module.id, { name: name.trim(), icon }); notifications.show({ color: 'green', message: 'Saved' }); onSaved() }
    catch (e) { notifications.show({ color: 'red', title: 'Could not save', message: extractErrorMessage(e) }) } finally { setSaving(false) }
  }
  return <Modal opened onClose={onClose} title={`Edit ${module.name}`} centered>
    <Stack>
      <TextInput label="Module name" maxLength={60} value={name} onChange={(e) => setName(e.currentTarget.value)} />
      <div><Text size="sm" fw={500} mb={4}>Icon</Text><SimpleGrid cols={6} spacing="xs">{BILLING_ICONS.map((i) => <Button key={i.value} variant={icon === i.value ? 'filled' : 'light'} onClick={() => setIcon(i.value)} aria-label={i.label} px={0}><i.icon size={20} /></Button>)}</SimpleGrid></div>
      <Text size="sm" c="dimmed">Bill code <b>{module.code}</b> stays the same.</Text>
      <Group justify="flex-end"><Button variant="default" onClick={onClose}>Cancel</Button><Button loading={saving} disabled={!name.trim()} onClick={() => void save()}>Save</Button></Group>
    </Stack>
  </Modal>
}
