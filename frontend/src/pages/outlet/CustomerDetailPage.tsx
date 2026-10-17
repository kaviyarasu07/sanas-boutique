import { useEffect, useState } from 'react'
import { Button, Card, Group, Pagination, SimpleGrid, Stack, Table, Text, TextInput, Title } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { IconArrowLeft, IconSearch } from '@tabler/icons-react'
import { useNavigate, useParams } from 'react-router-dom'
import { extractErrorMessage } from '../../api/catalogApi'
import { outletServiceApi, type Bill, type BillPage, type CustomerDetail } from '../../api/outletApi'
import { BillDetailsModal, money } from '../../components/BillDetailsModal'
import { fmtDate, fmtDateTime } from '../../config/dateFormat'

export function CustomerDetailPage() {
  const id = Number(useParams<{ customerId: string }>().customerId)
  const navigate = useNavigate()
  const [customer, setCustomer] = useState<CustomerDetail | null>(null)
  const [bills, setBills] = useState<BillPage | null>(null)
  const [selected, setSelected] = useState<Bill | null>(null)
  const [search, setSearch] = useState('')
  const [debounced] = useDebouncedValue(search.trim(), 300)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const fail = (title: string) => (error: unknown) => notifications.show({ color: 'red', title, message: extractErrorMessage(error) })

  useEffect(() => { outletServiceApi.customer(id).then(setCustomer).catch(fail('Could not load customer')) }, [id])
  useEffect(() => { setPage(0) }, [debounced])
  useEffect(() => {
    setLoading(true)
    outletServiceApi.customerBills(id, { page, search: debounced }).then(setBills).catch(fail('Could not load bills')).finally(() => setLoading(false))
  }, [id, page, debounced])

  return <Stack gap="lg">
    <Group><Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={() => navigate('/outlet/customers')}>Customers</Button></Group>
    <Card withBorder>
      <Title order={3}>{customer?.name ?? '…'}</Title>
      <Text c="dimmed">{customer?.mobileNumber}</Text>
      <SimpleGrid cols={{ base: 1, sm: 4 }} mt="md">
        <div><Text size="sm" c="dimmed">Customer since</Text><Text fw={600}>{customer ? fmtDate(customer.createdAt) : '—'}</Text></div>
        <div><Text size="sm" c="dimmed">Total bills</Text><Text fw={600}>{customer?.billCount ?? 0}</Text></div>
        <div><Text size="sm" c="dimmed">Total spent</Text><Text fw={600}>{money(customer?.totalSpent ?? 0)}</Text></div>
        <div><Text size="sm" c="dimmed">Last bill</Text><Text fw={600}>{customer?.lastBillAt ? fmtDate(customer.lastBillAt) : '—'}</Text></div>
      </SimpleGrid>
    </Card>
    <Card withBorder>
      <Title order={4} mb="sm">Bills</Title>
      <TextInput label="Search by bill number" placeholder="e.g. ABC-000042" leftSection={<IconSearch size={16} />} value={search} onChange={(e) => setSearch(e.currentTarget.value)} />
      {bills?.content.length ? <Table highlightOnHover mt="md"><Table.Thead><Table.Tr><Table.Th>Bill no.</Table.Th><Table.Th>Date</Table.Th><Table.Th>Total</Table.Th></Table.Tr></Table.Thead><Table.Tbody>{bills.content.map((b) => <Table.Tr key={b.id} onClick={() => setSelected(b)} style={{ cursor: 'pointer' }}><Table.Td fw={600}>{b.billNumber}</Table.Td><Table.Td>{fmtDateTime(b.createdAt)}</Table.Td><Table.Td>{money(b.total)}</Table.Td></Table.Tr>)}</Table.Tbody></Table> : <Text c="dimmed" mt="md">{loading ? 'Loading bills…' : 'No bills found.'}</Text>}
      {bills && bills.totalPages > 1 && <Group justify="center" mt="md"><Pagination value={page + 1} total={bills.totalPages} onChange={(n) => setPage(n - 1)} /></Group>}
    </Card>
    <BillDetailsModal bill={selected} onClose={() => setSelected(null)} />
  </Stack>
}
