import { useEffect, useState } from 'react'
import { Badge, Card, Group, ScrollArea, SimpleGrid, Stack, Text, ThemeIcon, Title } from '@mantine/core'
import { Calendar } from '@mantine/dates'
import { IconAlertTriangle, IconCalendarEvent, IconCircleCheck, IconListCheck } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { extractErrorMessage } from '../../api/catalogApi'
import { bookingApi, outletServiceApi, stitchApi, type Booking, type OutletDashboardOutlet, type SalesAnalytics, type StitchOrder } from '../../api/outletApi'
import { money, todayIso } from '../../components/BillDetailsModal'
import { ScheduleList, scheduleCount } from '../../components/ScheduleList'
import { fmtDateWithDay } from '../../config/dateFormat'


/**
 * Operations home. 1) sales headline + create bill, 2) today's pending work next to anything overdue, 3) calendar.
 * Full sales detail lives under Analytics.
 */
export function OutletDashboardPage() {
  const today = todayIso()
  const [outlet, setOutlet] = useState<OutletDashboardOutlet | null>(null)
  const [sales, setSales] = useState<SalesAnalytics | null>(null)
  const [overdueBookings, setOverdueBookings] = useState<Booking[]>([])
  const [overdueStitch, setOverdueStitch] = useState<StitchOrder[]>([])
  const [todayBookings, setTodayBookings] = useState<Booking[]>([])
  const [todayStitch, setTodayStitch] = useState<StitchOrder[]>([])
  const [selected, setSelected] = useState(today)
  const [dayBookings, setDayBookings] = useState<Booking[]>([])
  const [dayStitch, setDayStitch] = useState<StitchOrder[]>([])

  useEffect(() => {
    outletServiceApi.current().then(setOutlet).catch((error) => notifications.show({ color: 'red', title: 'Could not load outlet', message: extractErrorMessage(error) }))
    outletServiceApi.analytics().then(setSales).catch(() => undefined)
    bookingApi.overdue().then(setOverdueBookings).catch(() => undefined)
    stitchApi.overdue().then(setOverdueStitch).catch(() => undefined)
    bookingApi.day(today).then(setTodayBookings).catch(() => undefined)
    stitchApi.day(today).then(setTodayStitch).catch(() => undefined)
  }, [today])
  useEffect(() => {
    bookingApi.day(selected).then(setDayBookings).catch(() => undefined)
    stitchApi.day(selected).then(setDayStitch).catch(() => undefined)
  }, [selected])

  const pendingMode = { pendingDay: today }
  const pendingCount = scheduleCount(todayBookings, todayStitch, pendingMode)
  const overdueCount = overdueBookings.length + overdueStitch.length

  return <Stack gap="lg">
    <div><Title order={2}>{outlet?.name ?? 'Dashboard'}</Title><Text c="dimmed" size="sm">{fmtDateWithDay(today)}</Text></div>

    <Card withBorder padding="lg">
      {/* Today on the left, this month on the right. */}
      <Group justify="space-between" align="flex-start" wrap="nowrap" gap="md">
        <div><Text size="sm" c="dimmed">Today&apos;s sales</Text><Text size="1.9rem" fw={700} lh={1.2}>{sales ? money(sales.today.total) : '…'}</Text><Text size="xs" c="dimmed">{sales?.today.bills ?? 0} bill{sales?.today.bills === 1 ? '' : 's'}</Text></div>
        <div style={{ textAlign: 'right' }}><Text size="sm" c="dimmed">This month&apos;s sales</Text><Text size="1.9rem" fw={700} lh={1.2}>{sales ? money(sales.month.total) : '…'}</Text><Text size="xs" c="dimmed">{sales?.month.bills ?? 0} bill{sales?.month.bills === 1 ? '' : 's'}</Text></div>
      </Group>
    </Card>

    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
      <Card withBorder padding="lg">
        <Group justify="space-between" mb="xs">
          <Group gap="sm"><ThemeIcon variant="light" size="lg" radius="xl"><IconListCheck size={20} /></ThemeIcon><div><Title order={4}>Today&apos;s pending</Title><Text size="sm" c="dimmed">Bookings and deliveries still to do</Text></div></Group>
          <Badge size="lg" variant="light">{pendingCount}</Badge>
        </Group>
        <ScrollArea.Autosize mah={420} type="auto" offsetScrollbars>
          <ScheduleList bookings={todayBookings} stitch={todayStitch} mode={pendingMode} empty="All done — nothing pending for today." />
        </ScrollArea.Autosize>
      </Card>

      <Card withBorder padding="lg" style={overdueCount ? { borderColor: 'var(--mantine-color-red-4)' } : undefined}>
        <Group justify="space-between" mb="xs">
          <Group gap="sm"><ThemeIcon variant="light" color={overdueCount ? 'red' : 'teal'} size="lg" radius="xl">{overdueCount ? <IconAlertTriangle size={20} /> : <IconCircleCheck size={20} />}</ThemeIcon><div><Title order={4}>Overdue</Title><Text size="sm" c="dimmed">Jewellery not returned, stitching not delivered</Text></div></Group>
          <Badge size="lg" variant="light" color={overdueCount ? 'red' : 'teal'}>{overdueCount}</Badge>
        </Group>
        <ScrollArea.Autosize mah={420} type="auto" offsetScrollbars>
          <ScheduleList bookings={overdueBookings} stitch={overdueStitch} mode="overdue" empty="Nothing overdue. Everything is on track." />
        </ScrollArea.Autosize>
      </Card>
    </SimpleGrid>

    <Card withBorder padding="lg">
      <Group gap="sm" mb="md"><ThemeIcon variant="light" size="lg" radius="xl"><IconCalendarEvent size={20} /></ThemeIcon><div><Title order={4}>Calendar</Title><Text size="sm" c="dimmed">Pick a day to see its bookings, returns and stitching deliveries.</Text></div></Group>
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
        <Group justify="center" align="flex-start"><Calendar size="md" getDayProps={(date) => ({ selected: date === selected, onClick: () => setSelected(date) })} /></Group>
        <div>
          <Group justify="space-between" mb="xs"><Text fw={600}>{fmtDateWithDay(selected)}</Text>{selected === today && <Badge variant="light">Today</Badge>}</Group>
          <ScrollArea.Autosize mah={360} type="auto" offsetScrollbars>
            <ScheduleList bookings={dayBookings} stitch={dayStitch} mode={{ day: selected }} empty="Nothing scheduled for this day." />
          </ScrollArea.Autosize>
        </div>
      </SimpleGrid>
    </Card>
  </Stack>
}
