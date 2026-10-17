import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Alert, Badge, Button, Card, Group, Loader, Pagination, SegmentedControl, SimpleGrid, Stack, Table, Tabs, Text, TextInput, ThemeIcon, Title, UnstyledButton } from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { useDebouncedValue } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { IconCalendarPlus, IconCash, IconChevronLeft, IconChevronRight, IconClockHour4, IconFileInvoice, IconScan, IconSearch } from '@tabler/icons-react'
import { parlourApi, type Bill, type BillPage, type ParlourAppointment, type ParlourAppointmentPage, type ParlourFilter } from '../../api/outletApi'
import { BillDetailsModal, money, todayIso } from '../../components/BillDetailsModal'
import { PaperPreviewModal } from '../../components/receipt/ReceiptParts'
import { useShop } from '../../components/receipt/useShop'
import { ScanModal } from '../../components/ScanModal'
import { fmtDate, fmtDateTime, fmtDateWithDay } from '../../config/dateFormat'
import { AppointmentDetailsModal } from './parlour/AppointmentDetailsModal'
import { BookModal } from './parlour/BookModal'
import { ParlourBillModal } from './parlour/ParlourBillModal'
import { ParlourSlip } from './parlour/ParlourSlip'
import { canBillToday, isOverdueToday, servicesText, statusColor, statusLabel, timeLabel } from './parlour/shared'

type View = 'TODAY' | 'FIND' | 'BILLS'
const filters: { value: ParlourFilter; label: string }[] = [{ value: 'BOOKED', label: 'Booked' }, { value: 'DONE', label: 'Done' }, { value: 'CANCELLED', label: 'Cancelled' }, { value: 'NOT_DONE', label: 'Not done' }, { value: 'ALL', label: 'All' }]
const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T00:00:00`); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

/**
 * Parlour module: walk-in bills, bookings for a day and time, billing a booked customer on the day
 * (services added/removed), cancel or cancel & reschedule. Bookings of earlier days not done are
 * cancelled by the system (6:00 AM job, and on first use of the day).
 */
export function ParlourPage() {
  const shop = useShop()
  const [view, setView] = useState<View>('TODAY')
  const [day, setDay] = useState(todayIso())
  const [dayList, setDayList] = useState<ParlourAppointment[] | null>(null)
  const [todayCount, setTodayCount] = useState(0)
  const [filter, setFilter] = useState<ParlourFilter>('BOOKED')
  const [search, setSearch] = useState('')
  const [debounced] = useDebouncedValue(search.trim(), 300)
  const [found, setFound] = useState<ParlourAppointmentPage | null>(null)
  const [billSearch, setBillSearch] = useState('')
  const [bills, setBills] = useState<BillPage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<number | null>(null)
  const [billFor, setBillFor] = useState<{ booking: ParlourAppointment | null } | null>(null)
  const [booking, setBooking] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [slip, setSlip] = useState<ParlourAppointment | null>(null)
  const [shownBill, setShownBill] = useState<Bill | null>(null)
  // Bumped after a bill is made, so an open booking window reloads and shows it as Done.
  const [detailsVersion, setDetailsVersion] = useState(0)

  // Only the newest request may update the list, so a slow old response cannot overwrite a newer one.
  const latest = useRef(0)
  const load = (page = 0) => {
    const id = ++latest.current
    const ok = () => id === latest.current
    setError(null)
    const failed = () => { if (ok()) setError('We could not load this list. Please check the internet and try again.') }
    if (view === 'TODAY') { setDayList(null); parlourApi.day(day).then((r) => { if (ok()) { setDayList(r); if (day === todayIso()) setTodayCount(r.filter((a) => a.status === 'BOOKED').length) } }).catch(failed) }
    else if (view === 'FIND') parlourApi.search({ status: filter, search: debounced, page }).then((r) => { if (ok()) setFound(r) }).catch(failed)
    else parlourApi.bills({ search: billSearch.trim(), page }).then((r) => { if (ok()) setBills(r) }).catch(failed)
  }
  useEffect(() => { load() }, [view, day, filter, debounced]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { parlourApi.day(todayIso()).then((r) => setTodayCount(r.filter((a) => a.status === 'BOOKED').length)).catch(() => undefined) }, [])
  const refresh = () => load()

  const openByCode = async (code: string) => {
    try { const a = await parlourApi.lookup(code); setOpenId(a.id) }
    catch { notifications.show({ color: 'orange', title: 'Not found', message: "We couldn't find a booking with that number." }) }
  }

  return <Stack gap="lg">
    <div><Title order={2}>Parlour</Title><Text c="dimmed" size="sm">Walk-in bills, bookings, and billing booked customers on the day.</Text></div>

    <SimpleGrid cols={{ base: 2, sm: 4 }}>
      <Tile icon={<IconCash size={26} />} color="violet" label="New bill" onClick={() => setBillFor({ booking: null })} />
      <Tile icon={<IconCalendarPlus size={26} />} color="blue" label="Book" onClick={() => setBooking(true)} />
      <Tile icon={<IconClockHour4 size={26} />} color="orange" label="Today" count={todayCount} active={view === 'TODAY' && day === todayIso()} onClick={() => { setView('TODAY'); setDay(todayIso()) }} />
      <Tile icon={<IconScan size={26} />} color="teal" label="Scan slip" onClick={() => setScanning(true)} />
    </SimpleGrid>

    <Card withBorder radius="md">
      <Tabs value={view} onChange={(v) => setView((v ?? 'TODAY') as View)}><Tabs.List>
        <Tabs.Tab value="TODAY">Bookings by day</Tabs.Tab><Tabs.Tab value="FIND">Find booking</Tabs.Tab><Tabs.Tab value="BILLS">Bills</Tabs.Tab>
      </Tabs.List></Tabs>

      {error && <Alert mt="md" color="red" title="Something went wrong">{error} <Button size="xs" variant="light" ml="sm" onClick={refresh}>Try again</Button></Alert>}

      {view === 'TODAY' && <>
        <Group mt="md" align="flex-end" wrap="wrap">
          <Button variant="default" size="md" onClick={() => setDay(addDays(day, -1))} aria-label="Previous day"><IconChevronLeft size={18} /></Button>
          <DateInput value={day} onChange={(v) => v && setDay(v)} aria-label="Day" w={150} />
          <Button variant="default" size="md" onClick={() => setDay(addDays(day, 1))} aria-label="Next day"><IconChevronRight size={18} /></Button>
          {day !== todayIso() && <Button variant="light" size="md" onClick={() => setDay(todayIso())}>Today</Button>}
        </Group>
        <Text fw={700} mt="sm">{fmtDateWithDay(day)}</Text>
        {!error && (dayList === null ? <Group justify="center" py="xl"><Loader size="sm" /><Text c="dimmed">Loading bookings…</Text></Group>
          : !dayList.length ? <Text c="dimmed" ta="center" py="xl">No bookings on this day.</Text>
          : <SimpleGrid mt="sm" cols={{ base: 1, sm: 2, lg: 3 }}>{dayList.map((a) => <AppointmentCard key={a.id} a={a} onOpen={() => setOpenId(a.id)} onBill={() => setBillFor({ booking: a })} />)}</SimpleGrid>)}
      </>}

      {view === 'FIND' && <>
        <form onSubmit={(e) => { e.preventDefault(); if (/^\w{3}-BK-\d+$/i.test(search.trim())) void openByCode(search) }}>
          <TextInput mt="md" size="md" placeholder="Booking number, mobile or name" leftSection={<IconSearch size={18} />} value={search} onChange={(e) => setSearch(e.currentTarget.value)} />
        </form>
        <SegmentedControl mt="sm" fullWidth data={filters} value={filter} onChange={(v) => setFilter(v as ParlourFilter)} />
        {found && !found.content.length && <Text c="dimmed" ta="center" py="xl">No bookings match.</Text>}
        {found && found.content.length > 0 && <SimpleGrid mt="sm" cols={{ base: 1, sm: 2, lg: 3 }}>{found.content.map((a) => <AppointmentCard key={a.id} a={a} showDate onOpen={() => setOpenId(a.id)} onBill={() => setBillFor({ booking: a })} />)}</SimpleGrid>}
        {found && found.totalPages > 1 && <Group justify="center" mt="md"><Pagination value={found.page + 1} total={found.totalPages} onChange={(n) => load(n - 1)} /></Group>}
      </>}

      {view === 'BILLS' && <>
        <form onSubmit={(e) => { e.preventDefault(); load() }}><Group mt="md" align="flex-end"><TextInput style={{ flex: 1 }} size="md" placeholder="Bill number, e.g. ABC-P-000123" leftSection={<IconSearch size={18} />} value={billSearch} onChange={(e) => setBillSearch(e.currentTarget.value)} /><Button size="md" type="submit">Search</Button></Group></form>
        {bills && !bills.content.length && <Text c="dimmed" ta="center" py="xl">No parlour bills yet.</Text>}
        {bills && bills.content.length > 0 && <div style={{ overflowX: 'auto' }}><Table mt="sm" highlightOnHover verticalSpacing="sm"><Table.Thead><Table.Tr><Table.Th>Bill</Table.Th><Table.Th>Customer</Table.Th><Table.Th>When</Table.Th><Table.Th ta="right">Total</Table.Th></Table.Tr></Table.Thead><Table.Tbody>{bills.content.map((b) => <Table.Tr key={b.id} onClick={() => setShownBill(b)} style={{ cursor: 'pointer' }}>
          <Table.Td><Group gap={6}><IconFileInvoice size={16} /><Text fw={600}>{b.billNumber}</Text></Group></Table.Td><Table.Td>{b.customerName}<Text size="xs" c="dimmed">{b.customerMobile}</Text></Table.Td><Table.Td>{fmtDateTime(b.createdAt)}</Table.Td><Table.Td ta="right">{money(b.total)}</Table.Td>
        </Table.Tr>)}</Table.Tbody></Table></div>}
        {bills && bills.totalPages > 1 && <Group justify="center" mt="md"><Pagination value={bills.page + 1} total={bills.totalPages} onChange={(n) => load(n - 1)} /></Group>}
      </>}
    </Card>

    <AppointmentDetailsModal key={detailsVersion} id={openId} onClose={() => setOpenId(null)} onChanged={refresh} onOpen={setOpenId} onBill={(a) => setBillFor({ booking: a })} onOpenBill={setShownBill} onPrintSlip={setSlip} />
    <ParlourBillModal opened={billFor !== null} booking={billFor?.booking ?? null} onClose={() => setBillFor(null)} onDone={(b) => { setBillFor(null); refresh(); notifications.show({ color: 'green', title: 'Bill completed', message: b.billNumber }); setShownBill(b); setDetailsVersion((v) => v + 1) }} />
    <BookModal opened={booking} onClose={() => setBooking(false)} onSaved={(a) => { setBooking(false); notifications.show({ color: 'green', title: 'Booked', message: `${a.bookingNumber} · ${fmtDate(a.date)} ${timeLabel(a.time)}` }); setView('TODAY'); setDay(a.date); refresh(); setSlip(a) }} />
    <ScanModal opened={scanning} onClose={() => setScanning(false)} onCode={(c) => { setScanning(false); void openByCode(c) }} />
    <PaperPreviewModal title="Appointment slip" opened={slip !== null} onClose={() => setSlip(null)}>{slip && <ParlourSlip a={slip} shop={shop} />}</PaperPreviewModal>
    <BillDetailsModal bill={shownBill} onClose={() => setShownBill(null)} />
  </Stack>
}

function Tile({ icon, color, label, count, active, onClick }: { icon: ReactNode; color: string; label: string; count?: number; active?: boolean; onClick: () => void }) {
  return <UnstyledButton onClick={onClick} aria-label={label}>
    <Card withBorder radius="md" padding="md" style={{ borderColor: active ? `var(--mantine-color-${color}-5)` : undefined, borderWidth: active ? 2 : undefined, minHeight: 96 }}>
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <ThemeIcon size={44} radius="md" variant="light" color={color}>{icon}</ThemeIcon>
        {count !== undefined && <Text fw={800} size="xl" c={count ? color : 'dimmed'}>{count}</Text>}
      </Group>
      <Text fw={700} mt="sm">{label}</Text>
    </Card>
  </UnstyledButton>
}

function AppointmentCard({ a, showDate, onOpen, onBill }: { a: ParlourAppointment; showDate?: boolean; onOpen: () => void; onBill: () => void }) {
  const late = isOverdueToday(a)
  return <Card withBorder radius="md" padding="md" style={late ? { borderColor: 'var(--mantine-color-orange-5)' } : undefined}>
    <UnstyledButton onClick={onOpen} style={{ width: '100%' }} aria-label={`Open booking ${a.bookingNumber}`}>
      <Group justify="space-between" wrap="nowrap">
        <Text fw={800} size="lg">{showDate ? `${fmtDate(a.date)} · ` : ''}{timeLabel(a.time)}</Text>
        <Group gap={6}>{late && <Badge color="orange" variant="light">Not done yet</Badge>}<Badge color={statusColor(a)} variant="light">{statusLabel(a)}</Badge></Group>
      </Group>
      <Text fw={600} mt={4}>{a.customerName} <Text span size="sm" c="dimmed" fw={400}>{a.customerMobile}</Text></Text>
      <Text size="sm" lineClamp={2}>{servicesText(a)}</Text>
      <Text size="sm" c="dimmed" mt={2}>{a.bill ? `Billed ${money(a.bill.total)} · ${a.bill.billNumber}` : `Estimate ${money(a.estimate)}`} · {a.bookingNumber}</Text>
    </UnstyledButton>
    {canBillToday(a) && <Button mt="sm" fullWidth color="teal" leftSection={<IconCash size={18} />} onClick={onBill}>Customer arrived → Bill</Button>}
  </Card>
}
