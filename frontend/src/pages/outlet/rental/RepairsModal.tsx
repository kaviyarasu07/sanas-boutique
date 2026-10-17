import { useEffect, useState } from 'react'
import { Alert, Button, Card, Group, Loader, Modal, Stack, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconPackageImport } from '@tabler/icons-react'
import { rentalApi, type RentalRepair } from '../../../api/outletApi'
import { getAuthorName } from '../../../components/authorName'
import { fmtDate } from '../../../config/dateFormat'
import { fail } from './shared'

/** Pieces sent for repair at a return. "Repaired, back in stock" puts them back so they can be rented again. */
export function RepairsModal({ opened, onClose, onChanged }: { opened: boolean; onClose: () => void; onChanged: () => void }) {
  const [list, setList] = useState<RentalRepair[] | null>(null)
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState<number | null>(null)
  const load = () => { setError(false); setList(null); rentalApi.repairs().then(setList).catch(() => setError(true)) }
  useEffect(() => { if (opened) load() }, [opened])
  const back = async (r: RentalRepair) => {
    setBusy(r.id)
    try { await rentalApi.backInStock(r.id, getAuthorName()); notifications.show({ color: 'green', message: `${r.itemName} is back in stock` }); load(); onChanged() }
    catch (e) { fail('Could not update')(e) } finally { setBusy(null) }
  }
  return <Modal opened={opened} onClose={onClose} title="Under repair" centered size="lg">
    {error && <Alert color="red" title="Could not load the list">Please try again. <Button size="xs" variant="light" ml="sm" onClick={load}>Try again</Button></Alert>}
    {!error && list === null && <Group justify="center" py="lg"><Loader size="sm" /><Text c="dimmed">Loading…</Text></Group>}
    {list && !list.length && <Text c="dimmed" ta="center" py="lg">Nothing is under repair.</Text>}
    {list && list.length > 0 && <Stack>{list.map((r) => <Card key={r.id} withBorder radius="md" padding="md">
      <Group justify="space-between" wrap="nowrap" align="flex-start">
        <div><Text fw={700}>{r.itemName}{r.quantity > 1 ? ` × ${r.quantity}` : ''}</Text><Text size="sm" c="dimmed">{r.itemCode ?? ''}{r.note ? ` · ${r.note}` : ''}</Text><Text size="xs" c="dimmed">Sent {fmtDate(r.sentOn)}{r.bookingNumber ? ` · from ${r.bookingNumber} (${r.customerName})` : ''}</Text></div>
        <Button color="teal" leftSection={<IconPackageImport size={17} />} loading={busy === r.id} onClick={() => void back(r)}>Repaired, back in stock</Button>
      </Group>
    </Card>)}</Stack>}
  </Modal>
}
