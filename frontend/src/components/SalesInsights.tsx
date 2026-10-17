import { Card, Group, SimpleGrid, Stack, Table, Text, Title } from '@mantine/core'
import type { OutletRank, PeriodSales, ServiceSales } from '../api/outletApi'
import { money } from './BillDetailsModal'

function TopCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return <Card withBorder><Text size="sm" c="dimmed">{label}</Text><Text size="xl" fw={700}>{value}</Text>{sub && <Text size="xs" c="dimmed" mt={4}>{sub}</Text>}</Card>
}

const topServiceText = (s: ServiceSales | null) => s ? { value: s.name, sub: `${money(s.sales)} · ${s.units} unit${s.units === 1 ? '' : 's'} sold` } : { value: '—', sub: 'No sales yet' }

function ServiceTable({ title, services }: { title: string; services: ServiceSales[] }) {
  return <Card withBorder><Title order={5} mb="sm">{title}</Title>{services.length ? <Table><Table.Thead><Table.Tr><Table.Th>Service</Table.Th><Table.Th>Units</Table.Th><Table.Th ta="right">Sales</Table.Th></Table.Tr></Table.Thead><Table.Tbody>{services.map((s) => <Table.Tr key={s.serviceId}><Table.Td>{s.name}</Table.Td><Table.Td>{s.units}</Table.Td><Table.Td ta="right">{money(s.sales)}</Table.Td></Table.Tr>)}</Table.Tbody></Table> : <Text c="dimmed" size="sm">No sales yet.</Text>}</Card>
}

function OutletTable({ title, outlets }: { title: string; outlets: OutletRank[] }) {
  return <Card withBorder><Title order={5} mb="sm">{title}</Title>{outlets.length ? <Table><Table.Thead><Table.Tr><Table.Th>#</Table.Th><Table.Th>Outlet</Table.Th><Table.Th>Bills</Table.Th><Table.Th ta="right">Sales</Table.Th></Table.Tr></Table.Thead><Table.Tbody>{outlets.map((o, i) => <Table.Tr key={o.outletId}><Table.Td>{i + 1}</Table.Td><Table.Td>{o.name}</Table.Td><Table.Td>{o.bills}</Table.Td><Table.Td ta="right">{money(o.sales)}</Table.Td></Table.Tr>)}</Table.Tbody></Table> : <Text c="dimmed" size="sm">No sales yet.</Text>}</Card>
}

/**
 * Today / this-month sales with the top service, shared by the admin analytics page,
 * the admin's per-outlet dashboard and the outlet's own dashboard. Pass the outlet
 * rankings only where they apply (all-outlet view).
 */
export function SalesInsights({ today, month, topOutletsToday, topOutletsMonth }: { today?: PeriodSales; month?: PeriodSales; topOutletsToday?: OutletRank[]; topOutletsMonth?: OutletRank[] }) {
  const ts = topServiceText(today?.topService ?? null), ms = topServiceText(month?.topService ?? null)
  const showOutlets = topOutletsToday !== undefined && topOutletsMonth !== undefined
  const topT = topOutletsToday?.[0], topM = topOutletsMonth?.[0]
  return <Stack gap="md">
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
      <TopCard label="Today's sales" value={today ? money(today.total) : '…'} sub={`${today?.bills ?? 0} bills`} />
      <TopCard label="This month's sales" value={month ? money(month.total) : '…'} sub={`${month?.bills ?? 0} bills`} />
      <TopCard label="Top service today" value={ts.value} sub={ts.sub} />
      <TopCard label="Top service this month" value={ms.value} sub={ms.sub} />
      {showOutlets && <TopCard label="Top outlet today" value={topT?.name ?? '—'} sub={topT ? `${money(topT.sales)} · ${topT.bills} bills` : 'No sales yet'} />}
      {showOutlets && <TopCard label="Top outlet this month" value={topM?.name ?? '—'} sub={topM ? `${money(topM.sales)} · ${topM.bills} bills` : 'No sales yet'} />}
    </SimpleGrid>
    <SimpleGrid cols={{ base: 1, md: 2 }}>
      <ServiceTable title="Service sales today" services={today?.services ?? []} />
      <ServiceTable title="Service sales this month" services={month?.services ?? []} />
    </SimpleGrid>
    {showOutlets && <SimpleGrid cols={{ base: 1, md: 2 }}><OutletTable title="Outlet ranking today" outlets={topOutletsToday} /><OutletTable title="Outlet ranking this month" outlets={topOutletsMonth} /></SimpleGrid>}
    <Group><Text size="xs" c="dimmed">Service sales are item totals before bill-level discounts. Days and months follow IST.</Text></Group>
  </Stack>
}
