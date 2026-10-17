import { useEffect, useState } from 'react'
import { Badge, Button, Card, Group, Modal, Pagination, Stack, Table, Tabs, Text, TextInput, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconSearch } from '@tabler/icons-react'
import { useNavigate, useParams } from 'react-router-dom'
import { extractErrorMessage } from '../../../api/catalogApi'
import { adminBillApi, outletServiceApi, type AdminOutletDashboard, type SalesAnalytics, type OutletService, type OutletServiceItemPage } from '../../../api/outletApi'
import { money } from '../../../components/BillDetailsModal'
import { AdminBillsPage } from '../AdminBillsPage'
import { SalesInsights } from '../../../components/SalesInsights'

const emptyPage: OutletServiceItemPage = { content: [], number: 0, size: 10, totalPages: 0, totalElements: 0 }

/** Read-only outlet dashboard for the admin: nothing here edits the outlet, its stock or its bills. */
export function AdminOutletDashboardPage() {
  const { outletId } = useParams<{ outletId: string }>()
  const id = Number(outletId)
  const navigate = useNavigate()
  const [dashboard, setDashboard] = useState<AdminOutletDashboard | null>(null)
  const [analytics, setAnalytics] = useState<SalesAnalytics | null>(null)
  const [services, setServices] = useState<OutletService[]>([])
  const [viewing, setViewing] = useState<OutletService | null>(null)
  const [items, setItems] = useState<OutletServiceItemPage>(emptyPage)
  const [search, setSearch] = useState('')

  useEffect(() => {
    adminBillApi.outletDashboard(id).then(setDashboard).catch((error) => notifications.show({ color: 'red', title: 'Could not load outlet', message: extractErrorMessage(error) }))
    adminBillApi.outletAnalytics(id).then(setAnalytics).catch(() => undefined)
    outletServiceApi.list(id).then((all) => setServices(all.filter((service) => service.allowed))).catch(() => undefined)
  }, [id])

  const loadItems = async (service: OutletService, page = 0, q = search) => {
    try { setItems(await outletServiceApi.listItems(id, service.id, q, page, 10)) } catch (error) { notifications.show({ color: 'red', message: extractErrorMessage(error) }) }
  }
  const openItems = (service: OutletService) => { setViewing(service); setSearch(''); setItems(emptyPage); void loadItems(service, 0, '') }
  const outlet = dashboard?.outlet

  return <Stack gap="lg">
    <Group><Button variant="subtle" onClick={() => navigate('/dashboard/outlets')}>Outlets</Button><Text c="dimmed">/</Text><Text>{outlet?.name ?? 'Outlet dashboard'}</Text></Group>
    <Group justify="space-between" align="start"><div><Title order={2}>{outlet?.name ?? 'Outlet dashboard'}</Title><Text c="dimmed">View-only dashboard of this outlet.</Text></div>{outlet && <Badge size="lg" variant="light" color={outlet.active ? 'teal' : 'gray'}>{outlet.active ? 'Active' : 'Inactive'}</Badge>}</Group>
    <SalesInsights today={analytics?.today} month={analytics?.month} />
    <Tabs defaultValue="bills">
      <Tabs.List><Tabs.Tab value="bills">Bills</Tabs.Tab><Tabs.Tab value="services">Services &amp; stock</Tabs.Tab><Tabs.Tab value="details">Outlet details</Tabs.Tab></Tabs.List>
      <Tabs.Panel value="bills" pt="md"><AdminBillsPage outletId={id} /></Tabs.Panel>
      <Tabs.Panel value="services" pt="md"><Card withBorder>{services.length === 0 ? <Text c="dimmed">No services are enabled for this outlet.</Text> : <Table highlightOnHover><Table.Thead><Table.Tr><Table.Th>Service</Table.Th><Table.Th>Price unit</Table.Th><Table.Th>Items</Table.Th><Table.Th /></Table.Tr></Table.Thead><Table.Tbody>{services.map((service) => <Table.Tr key={service.id}><Table.Td><Text fw={500}>{service.name}</Text><Text size="xs" c="dimmed">{service.description}</Text></Table.Td><Table.Td>{service.priceUnitName}</Table.Td><Table.Td>{service.itemCount}</Table.Td><Table.Td><Button size="xs" variant="subtle" onClick={() => openItems(service)}>View items</Button></Table.Td></Table.Tr>)}</Table.Tbody></Table>}</Card></Tabs.Panel>
      <Tabs.Panel value="details" pt="md"><Card withBorder><Stack gap="xs"><Text><b>Owner:</b> {outlet?.ownerName ?? '—'}</Text><Text><b>Mobile:</b> {outlet?.mobileNumber ?? '—'}</Text><Text><b>Email:</b> {outlet?.email ?? '—'}</Text><Text><b>Address:</b> {outlet?.address || '—'}</Text></Stack></Card></Tabs.Panel>
    </Tabs>
    <Modal opened={viewing !== null} onClose={() => setViewing(null)} title={`Items — ${viewing?.name ?? ''}`} size="lg">
      <Stack>
        <TextInput leftSection={<IconSearch size={16} />} placeholder="Search by name, unique ID, or barcode" value={search} onChange={(e) => { setSearch(e.currentTarget.value); if (viewing) void loadItems(viewing, 0, e.currentTarget.value) }} />
        {items.content.length === 0 ? <Text c="dimmed" size="sm">No matching items.</Text> : <Table striped><Table.Thead><Table.Tr><Table.Th>Item</Table.Th><Table.Th>Price</Table.Th><Table.Th>Sold here</Table.Th><Table.Th>Outlet stock</Table.Th></Table.Tr></Table.Thead><Table.Tbody>{items.content.map((item) => <Table.Tr key={item.id}><Table.Td><Text size="sm" fw={500}>{item.name}</Text><Text size="xs" c="dimmed">{item.itemCode ?? '—'}</Text></Table.Td><Table.Td>{money(item.price)}</Table.Td><Table.Td><Badge variant="light" color={item.allowed ? 'teal' : 'gray'}>{item.allowed ? 'Yes' : 'No'}</Badge></Table.Td><Table.Td>{item.allocatedQuantity ?? (item.parentQuantity !== null ? item.parentQuantity : 'Not tracked')}</Table.Td></Table.Tr>)}</Table.Tbody></Table>}
        {items.totalPages > 1 && <Group justify="center"><Pagination value={items.number + 1} total={items.totalPages} onChange={(page) => viewing && void loadItems(viewing, page - 1)} /></Group>}
      </Stack>
    </Modal>
  </Stack>
}
