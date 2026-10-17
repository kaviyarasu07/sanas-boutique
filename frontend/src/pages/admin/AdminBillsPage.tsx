import { useEffect, useState } from 'react'
import { Button, Card, Group, Pagination, Stack, Table, Text, TextInput, Title } from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { notifications } from '@mantine/notifications'
import { IconSearch } from '@tabler/icons-react'
import { extractErrorMessage } from '../../api/catalogApi'
import { adminBillApi, type Bill, type BillPage } from '../../api/outletApi'
import { BillDetailsModal, money, todayIso } from '../../components/BillDetailsModal'
import { fmtDateTime } from '../../config/dateFormat'

/**
 * Read-only bill list for the admin: all outlets together (default) or one outlet
 * (outletId). Starts on today's bills; the date range can be changed or cleared.
 */
export function AdminBillsPage({ outletId }: { outletId?: number }) {
  const [data, setData] = useState<BillPage | null>(null)
  const [selected, setSelected] = useState<Bill | null>(null)
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState<string | null>(todayIso())
  const [to, setTo] = useState<string | null>(todayIso())
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)

  const load = async (nextPage = 0) => {
    setLoading(true)
    try {
      setData(await adminBillApi.bills({ outletId, page: nextPage, search: search.trim(), from: from || undefined, to: to || undefined }))
      setPage(nextPage)
    } catch (error) {
      notifications.show({ color: 'red', title: 'Could not load bills', message: extractErrorMessage(error) })
    } finally {
      setLoading(false)
    }
  }
  // Initial load (today's bills); later loads happen via the Filter button / pagination.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(0) }, [outletId])

  const embedded = outletId !== undefined
  const single = from && from === to
  const heading = embedded ? 'Bills' : single && from === todayIso() ? "Today's sales" : 'All outlet bills'

  return <Stack gap="lg">
    <div><Title order={embedded ? 3 : 2}>{heading}</Title><Text c="dimmed" size="sm">{embedded ? 'Bills of this outlet' : 'Bills from every outlet'}, 50 per page. Select a bill to view the complete receipt.</Text></div>
    <Card withBorder>
      <Group align="end" wrap="wrap">
        <TextInput flex={1} miw={180} label="Bill number" placeholder="Search bill number" leftSection={<IconSearch size={16} />} value={search} onChange={(event) => setSearch(event.currentTarget.value)} onKeyDown={(event) => { if (event.key === 'Enter') void load(0) }} />
        <DateInput label="From date" placeholder="Pick a date" value={from} onChange={setFrom} maxDate={to ?? undefined} clearable />
        <DateInput label="To date" placeholder="Pick a date" value={to} onChange={setTo} minDate={from ?? undefined} clearable />
        <Button loading={loading} onClick={() => void load(0)}>Filter</Button>
      </Group>
      {data?.content.length ? <Table highlightOnHover mt="md"><Table.Thead><Table.Tr><Table.Th>Bill</Table.Th>{!embedded && <Table.Th>Outlet</Table.Th>}<Table.Th>Customer</Table.Th><Table.Th>Date</Table.Th><Table.Th>Total</Table.Th></Table.Tr></Table.Thead><Table.Tbody>{data.content.map((bill) => <Table.Tr key={bill.id} onClick={() => setSelected(bill)} style={{ cursor: 'pointer' }}><Table.Td fw={600}>{bill.billNumber}</Table.Td>{!embedded && <Table.Td>{bill.shopName}</Table.Td>}<Table.Td>{bill.customerName}<Text size="xs" c="dimmed">{bill.customerMobile}</Text></Table.Td><Table.Td>{fmtDateTime(bill.createdAt)}</Table.Td><Table.Td>{money(bill.total)}</Table.Td></Table.Tr>)}</Table.Tbody></Table> : <Text c="dimmed" mt="md">{loading ? 'Loading bills…' : 'No bills found for this date range.'}</Text>}
      {data && data.totalPages > 1 && <Group justify="center" mt="md"><Pagination value={page + 1} total={data.totalPages} onChange={(value) => void load(value - 1)} /></Group>}
      {data && data.totalElements > 0 && <Text size="xs" c="dimmed" ta="center" mt="xs">{data.totalElements} bill{data.totalElements === 1 ? '' : 's'}</Text>}
    </Card>
    <BillDetailsModal bill={selected} onClose={() => setSelected(null)} />
  </Stack>
}
