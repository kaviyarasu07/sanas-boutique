import { useEffect, useState } from 'react'
import {
  Badge,
  Button,
  Card,
  Group,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Table,
  Text,
  ThemeIcon,
  Title,
  UnstyledButton,
} from '@mantine/core'
import { AreaChart } from '@mantine/charts'
import { notifications } from '@mantine/notifications'
import {
  IconBuildingStore,
  IconCash,
  IconPlus,
  IconShirt,
  IconWifi,
} from '@tabler/icons-react'
import { useNavigate } from 'react-router-dom'
import { extractErrorMessage, serviceApi } from '../../api/catalogApi'
import { adminBillApi, type AdminSalesSummary } from '../../api/outletApi'
import { money } from '../../components/BillDetailsModal'

type SalesPeriod = 'today' | 'month'

interface StatCardProps {
  label: string
  value: string
  hint?: string
  icon: typeof IconCash
  color: string
  onClick?: () => void
}

function StatCard({ label, value, hint, icon: Icon, color, onClick }: StatCardProps) {
  const card = (
    <Card withBorder radius="md" p="lg" h="100%">
      <Group justify="space-between" align="flex-start">
        <div>
          <Text size="sm" c="dimmed" fw={500}>
            {label}
          </Text>
          <Text size="xl" fw={700} mt={4}>
            {value}
          </Text>
          {hint && (
            <Text size="xs" c="dimmed" mt={4}>
              {hint}
            </Text>
          )}
        </div>
        <ThemeIcon size={40} radius="md" variant="light" color={color}>
          <Icon size={22} stroke={1.75} />
        </ThemeIcon>
      </Group>
    </Card>
  )
  return onClick ? <UnstyledButton onClick={onClick} style={{ display: 'block' }}>{card}</UnstyledButton> : card
}

export function OverviewPage() {
  const navigate = useNavigate()
  const [period, setPeriod] = useState<SalesPeriod>('today')
  const [summary, setSummary] = useState<AdminSalesSummary | null>(null)
  const [serviceCount, setServiceCount] = useState<number | null>(null)

  useEffect(() => {
    adminBillApi.summary().then(setSummary).catch((error) => notifications.show({ color: 'red', title: 'Could not load sales', message: extractErrorMessage(error) }))
    serviceApi.list().then((services) => setServiceCount(services.length)).catch(() => undefined)
  }, [])

  const rows = summary?.outlets ?? []
  const hasOutlets = rows.length > 0
  const isToday = period === 'today'

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="center">
        <div>
          <Title order={2}>Overview</Title>
          <Text c="dimmed" size="sm">
            A snapshot across every outlet.
          </Text>
        </div>
        <SegmentedControl
          value={period}
          onChange={(value) => setPeriod(value as SalesPeriod)}
          data={[
            { label: 'Today', value: 'today' },
            { label: 'This month', value: 'month' },
          ]}
        />
      </Group>

      <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing="md">
        <StatCard
          label={isToday ? "Today's sales" : "This month's sales"}
          value={summary ? money(isToday ? summary.todayTotal : summary.monthTotal) : '…'}
          hint={isToday ? `${summary?.todayBills ?? 0} bills across all outlets · click to view` : 'Across all outlets'}
          icon={IconCash}
          color="teal"
          onClick={isToday ? () => navigate('/dashboard/bills') : undefined}
        />
        <StatCard
          label="Active outlets"
          value={summary ? `${summary.activeOutlets} / ${summary.totalOutlets}` : '…'}
          hint="Outlets currently enabled"
          icon={IconWifi}
          color="blue"
        />
        <StatCard label="Total outlets" value={summary ? String(summary.totalOutlets) : '…'} icon={IconBuildingStore} color="violet" />
        <StatCard label="Total services" value={serviceCount === null ? '…' : String(serviceCount)} icon={IconShirt} color="grape" />
      </SimpleGrid>
      <Button variant="light" onClick={() => navigate('/dashboard/bills')}>View today&apos;s bills</Button>

      <Card withBorder radius="md" p="lg">
        <Group justify="space-between" mb="md">
          <Title order={4}>Sales trend</Title>
          <Badge variant="light" color="gray">
            Last 30 days
          </Badge>
        </Group>
        {/* Empty series until a daily-sales endpoint feeds real numbers in. */}
        <AreaChart
          h={220}
          data={[]}
          dataKey="date"
          series={[{ name: 'sales', color: `${'violet'}.6` }]}
          curveType="monotone"
          withGradient
          connectNulls
        />
        <Text size="sm" c="dimmed" ta="center" mt="xs">
          Sales trend will appear here once daily history is available.
        </Text>
      </Card>

      <Card withBorder radius="md" p="lg">
        <Group justify="space-between" mb="md">
          <Title order={4}>Outlets</Title>
          <Button
            size="xs"
            leftSection={<IconPlus size={16} />}
            onClick={() => navigate('/dashboard/outlets')}
          >
            Add outlet
          </Button>
        </Group>

        {hasOutlets ? (
          <Table striped highlightOnHover verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Outlet</Table.Th>
                <Table.Th>Today</Table.Th>
                <Table.Th>This month</Table.Th>
                <Table.Th>Status</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((row) => (
                <Table.Tr key={row.outletId} onClick={() => navigate(`/dashboard/outlets/${row.outletId}/dashboard`)} style={{ cursor: 'pointer' }}>
                  <Table.Td><Text fw={500}>{row.name}</Text></Table.Td>
                  <Table.Td>{money(row.todayTotal)}</Table.Td>
                  <Table.Td>{money(row.monthTotal)}</Table.Td>
                  <Table.Td>
                    <Badge color={row.active ? 'teal' : 'gray'} variant="light">
                      {row.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        ) : (
          <Stack align="center" py="xl" gap={4}>
            <Text c="dimmed" size="sm">
              No outlets yet.
            </Text>
            <Text c="dimmed" size="sm">
              Add your first outlet to start tracking sales here.
            </Text>
          </Stack>
        )}
      </Card>
    </Stack>
  )
}
