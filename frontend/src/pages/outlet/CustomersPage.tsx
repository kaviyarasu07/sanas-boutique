import { useEffect, useState } from 'react'
import { Card, Group, Pagination, Stack, Table, Text, TextInput, Title } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { IconSearch } from '@tabler/icons-react'
import { useNavigate } from 'react-router-dom'
import { extractErrorMessage } from '../../api/catalogApi'
import { outletServiceApi, type CustomerPage } from '../../api/outletApi'
import { money } from '../../components/BillDetailsModal'
import { fmtDate } from '../../config/dateFormat'

/** Customers of the signed-in outlet only (the API scopes by the login's outlet). */
export function CustomersPage() {
  const navigate = useNavigate()
  const [data, setData] = useState<CustomerPage | null>(null)
  const [search, setSearch] = useState('')
  const [debounced] = useDebouncedValue(search.trim(), 300)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => { setPage(0) }, [debounced])
  useEffect(() => {
    setLoading(true)
    outletServiceApi.customers({ page, search: debounced }).then(setData)
      .catch((error) => notifications.show({ color: 'red', title: 'Could not load customers', message: extractErrorMessage(error) }))
      .finally(() => setLoading(false))
  }, [page, debounced])

  return <Stack gap="lg">
    <div><Title order={2}>Customers</Title><Text c="dimmed" size="sm">Customers of this outlet, 50 per page. Select one to see their details and bills.</Text></div>
    <Card withBorder>
      <TextInput label="Search" placeholder="Name or mobile number" leftSection={<IconSearch size={16} />} value={search} onChange={(e) => setSearch(e.currentTarget.value)} />
      {data?.content.length ? <Table highlightOnHover mt="md"><Table.Thead><Table.Tr><Table.Th>Name</Table.Th><Table.Th>Mobile</Table.Th><Table.Th>Bills</Table.Th><Table.Th>Total spent</Table.Th><Table.Th>Last bill</Table.Th></Table.Tr></Table.Thead><Table.Tbody>{data.content.map((c) => <Table.Tr key={c.id} onClick={() => navigate(`/outlet/customers/${c.id}`)} style={{ cursor: 'pointer' }}><Table.Td fw={600}>{c.name}</Table.Td><Table.Td>{c.mobileNumber}</Table.Td><Table.Td>{c.billCount}</Table.Td><Table.Td>{money(c.totalSpent)}</Table.Td><Table.Td>{c.lastBillAt ? fmtDate(c.lastBillAt) : '—'}</Table.Td></Table.Tr>)}</Table.Tbody></Table> : <Text c="dimmed" mt="md">{loading ? 'Loading customers…' : 'No customers found.'}</Text>}
      {data && data.totalPages > 1 && <Group justify="center" mt="md"><Pagination value={page + 1} total={data.totalPages} onChange={(n) => setPage(n - 1)} /></Group>}
      {data && data.totalElements > 0 && <Text size="xs" c="dimmed" ta="center" mt="xs">{data.totalElements} customer{data.totalElements === 1 ? '' : 's'}</Text>}
    </Card>
  </Stack>
}
