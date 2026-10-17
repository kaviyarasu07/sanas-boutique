import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Alert, Badge, Button, Card, Group, Loader, Pagination, SegmentedControl, SimpleGrid, Stack, Table, Tabs, Text, TextInput, ThemeIcon, Title, UnstyledButton } from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { useDebouncedValue } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { IconAlertTriangle, IconArrowBackUp, IconCalendarPlus, IconChevronLeft, IconChevronRight, IconDiamond, IconFileInvoice, IconHandFinger, IconScan, IconSearch, IconTool } from '@tabler/icons-react'
import { rentalApi, type Bill, type BillPage, type RentalBooking, type RentalBookingPage, type RentalDashboard, type RentalFilter } from '../../api/outletApi'
import { BillDetailsModal, money, todayIso } from '../../components/BillDetailsModal'
import { PaperPreviewModal } from '../../components/receipt/ReceiptParts'
import { useShop } from '../../components/receipt/useShop'
import { ScanModal } from '../../components/ScanModal'
import { fmtDate, fmtDateTime, fmtDateWithDay } from '../../config/dateFormat'
import { BookModal } from './rental/BookModal'
import { HandOverModal } from './rental/HandOverModal'
import { RentalDetailsModal } from './rental/RentalDetailsModal'
import { RentalPaperContent, paperTitle, type RentalPaper } from './rental/RentalPrint'
import { RepairsModal } from './rental/RepairsModal'
import { ReturnModal } from './rental/ReturnModal'
import { daysText, piecesText, statusColor, statusLabel } from './rental/shared'

type View = 'DAY' | 'FIND' | 'BILLS' | 'COLLECT' | 'DUE' | 'LATE'
const filters: { value: RentalFilter; label: string }[] = [{ value: 'BOOKED', label: 'Booked' }, { value: 'WITH_CUSTOMER', label: 'With customer' }, { value: 'RETURNED', label: 'Returned' }, { value: 'CANCELLED', label: 'Cancelled' }, { value: 'NOT_COLLECTED', label: 'Not collected' }, { value: 'ALL', label: 'All' }]
const listTitle: Partial<Record<View, string>> = { COLLECT: 'To hand over today', DUE: 'Due back today', LATE: 'Late returns' }
const listEmpty: Partial<Record<View, string>> = { COLLECT: 'Nothing to hand over today.', DUE: 'No returns due today.', LATE: 'Nothing is late. Everything is on track.' }
const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T00:00:00`); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

/**
 * Jewellery rental module: Rent now or book, hand over (add / remove pieces, return date, challan),
 * return (check every piece, damage / missing charges, bill for the days), repairs, cancel or cancel
 * & reschedule. Pre-bookings not collected by their date are cancelled at login (no scheduler).
 */
export function RentalPage() {
  const shop = useShop()
  const [view, setView] = useState<View>('COLLECT')
  const [dash, setDash] = useState<RentalDashboard | null>(null)
  const [day, setDay] = useState(todayIso())
  const [dayList, setDayList] = useState<RentalBooking[] | null>(null)
  const [filter, setFilter] = useState<RentalFilter>('BOOKED')
  const [search, setSearch] = useState('')
  const [debounced] = useDebouncedValue(search.trim(), 300)
  const [found, setFound] = useState<RentalBookingPage | null>(null)
  const [billSearch, setBillSearch] = useState('')
  const [bills, setBills] = useState<BillPage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<number | null>(null)
  const [detailsVersion, setDetailsVersion] = useState(0)
  const [bookMode, setBookMode] = useState<'book' | 'rentNow' | null>(null)
  const [handOver, setHandOver] = useState<RentalBooking | null>(null)
  const [returning, setReturning] = useState<RentalBooking | null>(null)
  const [repairsOpen, setRepairsOpen] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [paper, setPaper] = useState<RentalPaper | null>(null)
  const [shownBill, setShownBill] = useState<Bill | null>(null)

  // Only the newest request may update the screen, so a slow old response cannot overwrite a newer one.
  const latest = useRef(0)
  const load = (page = 0) => {
    const id = ++latest.current
    const ok = () => id === latest.current
    setError(null)
    const failed = () => { if (ok()) setError('We could not load this list. Please check the internet and try again.') }
    rentalApi.dashboard().then((d) => { if (ok()) setDash(d) }).catch(failed)
    if (view === 'DAY') { setDayList(null); rentalApi.day(day).then((r) => { if (ok()) setDayList(r) }).catch(failed) }
    else if (view === 'FIND') rentalApi.search({ status: filter, search: debounced, page }).then((r) => { if (ok()) setFound(r) }).catch(failed)
    else if (view === 'BILLS') rentalApi.bills({ search: billSearch.trim(), page }).then((r) => { if (ok()) setBills(r) }).catch(failed)
  }
  useEffect(() => { load() }, [view, day, filter, debounced]) // eslint-disable-line react-hooks/exhaustive-deps
  /** After any change: refresh lists and reload an open details window. */
  const changed = () => { load(); setDetailsVersion((v) => v + 1) }

  const openByCode = async (code: string) => {
    try { const b = await rentalApi.lookup(code); setOpenId(b.id) }
    catch { notifications.show({ color: 'orange', title: 'Not found', message: "We couldn't find a booking with that number." }) }
  }
  const dashList = view === 'COLLECT' ? dash?.toCollect : view === 'DUE' ? dash?.dueBack : view === 'LATE' ? dash?.late : undefined
  const cardProps = { onOpen: (b: RentalBooking) => setOpenId(b.id), onHandOver: setHandOver, onReturn: setReturning }

  return <Stack gap="lg">
    <div><Title order={2}>Jewellery rental</Title><Text c="dimmed" size="sm">Rent or book jewellery, hand it over, take it back and bill.</Text></div>

    <SimpleGrid cols={{ base: 2, xs: 3, md: 4, lg: 7 }}>
      <Tile icon={<IconDiamond size={26} />} color="violet" label="Rent now" onClick={() => setBookMode('rentNow')} />
      <Tile icon={<IconCalendarPlus size={26} />} color="blue" label="Book" onClick={() => setBookMode('book')} />
      <Tile icon={<IconHandFinger size={26} />} color="orange" label="Hand over" count={dash?.toCollect.length} active={view === 'COLLECT'} onClick={() => setView('COLLECT')} />
      <Tile icon={<IconArrowBackUp size={26} />} color="teal" label="Due back" count={dash?.dueBack.length} active={view === 'DUE'} onClick={() => setView('DUE')} />
      <Tile icon={<IconAlertTriangle size={26} />} color="red" label="Late" count={dash?.late.length} active={view === 'LATE'} onClick={() => setView('LATE')} />
      <Tile icon={<IconTool size={26} />} color="grape" label="Under repair" count={dash?.underRepair} onClick={() => setRepairsOpen(true)} />
      <Tile icon={<IconScan size={26} />} color="cyan" label="Scan slip" onClick={() => setScanning(true)} />
    </SimpleGrid>

    <Card withBorder radius="md">
      <Tabs value={['DAY', 'FIND', 'BILLS'].includes(view) ? view : null} onChange={(v) => v && setView(v as View)}><Tabs.List>
        <Tabs.Tab value="DAY">Bookings by day</Tabs.Tab><Tabs.Tab value="FIND">Find booking</Tabs.Tab><Tabs.Tab value="BILLS">Bills</Tabs.Tab>
      </Tabs.List></Tabs>

      {error && <Alert mt="md" color="red" title="Something went wrong">{error} <Button size="xs" variant="light" ml="sm" onClick={() => load()}>Try again</Button></Alert>}

      {listTitle[view] && <>
        <Title order={4} mt="md">{listTitle[view]}</Title>
        {!error && (dash === null ? <Group justify="center" py="xl"><Loader size="sm" /><Text c="dimmed">Loading…</Text></Group>
          : !dashList?.length ? <Text c="dimmed" ta="center" py="xl">{listEmpty[view]}</Text>
          : <SimpleGrid mt="sm" cols={{ base: 1, sm: 2, lg: 3 }}>{dashList.map((b) => <RentalCard key={b.id} b={b} {...cardProps} />)}</SimpleGrid>)}
      </>}

      {view === 'DAY' && <>
        <Group mt="md" align="flex-end" wrap="wrap">
          <Button variant="default" size="md" onClick={() => setDay(addDays(day, -1))} aria-label="Previous day"><IconChevronLeft size={18} /></Button>
          <DateInput value={day} onChange={(v) => v && setDay(v)} aria-label="Day" w={150} />
          <Button variant="default" size="md" onClick={() => setDay(addDays(day, 1))} aria-label="Next day"><IconChevronRight size={18} /></Button>
          {day !== todayIso() && <Button variant="light" size="md" onClick={() => setDay(todayIso())}>Today</Button>}
        </Group>
        <Text fw={700} mt="sm">{fmtDateWithDay(day)}</Text>
        {!error && (dayList === null ? <Group justify="center" py="xl"><Loader size="sm" /><Text c="dimmed">Loading…</Text></Group>
          : !dayList.length ? <Text c="dimmed" ta="center" py="xl">Nothing on this day.</Text>
          : <SimpleGrid mt="sm" cols={{ base: 1, sm: 2, lg: 3 }}>{dayList.map((b) => <RentalCard key={b.id} b={b} day={day} {...cardProps} />)}</SimpleGrid>)}
      </>}

      {view === 'FIND' && <>
        <form onSubmit={(e) => { e.preventDefault(); if (/^\w{3}-(BK|DC)-\d+$/i.test(search.trim())) void openByCode(search) }}>
          <TextInput mt="md" size="md" placeholder="Booking or challan number, mobile or name" leftSection={<IconSearch size={18} />} value={search} onChange={(e) => setSearch(e.currentTarget.value)} />
        </form>
        <SegmentedControl mt="sm" fullWidth data={filters} value={filter} onChange={(v) => setFilter(v as RentalFilter)} />
        {found && !found.content.length && <Text c="dimmed" ta="center" py="xl">No bookings match.</Text>}
        {found && found.content.length > 0 && <SimpleGrid mt="sm" cols={{ base: 1, sm: 2, lg: 3 }}>{found.content.map((b) => <RentalCard key={b.id} b={b} {...cardProps} />)}</SimpleGrid>}
        {found && found.totalPages > 1 && <Group justify="center" mt="md"><Pagination value={found.page + 1} total={found.totalPages} onChange={(n) => load(n - 1)} /></Group>}
      </>}

      {view === 'BILLS' && <>
        <form onSubmit={(e) => { e.preventDefault(); load() }}><Group mt="md" align="flex-end"><TextInput style={{ flex: 1 }} size="md" placeholder="Bill number, e.g. ABC-R-000123" leftSection={<IconSearch size={18} />} value={billSearch} onChange={(e) => setBillSearch(e.currentTarget.value)} /><Button size="md" type="submit">Search</Button></Group></form>
        {bills && !bills.content.length && <Text c="dimmed" ta="center" py="xl">No rental bills yet.</Text>}
        {bills && bills.content.length > 0 && <div style={{ overflowX: 'auto' }}><Table mt="sm" highlightOnHover verticalSpacing="sm"><Table.Thead><Table.Tr><Table.Th>Bill</Table.Th><Table.Th>Customer</Table.Th><Table.Th>When</Table.Th><Table.Th ta="right">Total</Table.Th></Table.Tr></Table.Thead><Table.Tbody>{bills.content.map((b) => <Table.Tr key={b.id} onClick={() => setShownBill(b)} style={{ cursor: 'pointer' }}>
          <Table.Td><Group gap={6}><IconFileInvoice size={16} /><Text fw={600}>{b.billNumber}</Text></Group></Table.Td><Table.Td>{b.customerName}<Text size="xs" c="dimmed">{b.customerMobile}</Text></Table.Td><Table.Td>{fmtDateTime(b.createdAt)}</Table.Td><Table.Td ta="right">{money(b.total)}</Table.Td>
        </Table.Tr>)}</Table.Tbody></Table></div>}
        {bills && bills.totalPages > 1 && <Group justify="center" mt="md"><Pagination value={bills.page + 1} total={bills.totalPages} onChange={(n) => load(n - 1)} /></Group>}
      </>}
    </Card>

    <RentalDetailsModal key={detailsVersion} id={openId} onClose={() => setOpenId(null)} onChanged={() => load()} onOpen={setOpenId} onHandOver={setHandOver} onReturn={setReturning} onOpenBill={setShownBill} onPrint={setPaper} />
    <BookModal mode={bookMode} onClose={() => setBookMode(null)} onSaved={(b) => {
      const rentNow = bookMode === 'rentNow'
      setBookMode(null); changed()
      notifications.show({ color: 'green', title: rentNow ? 'Handed over' : 'Booked', message: `${b.bookingNumber} · ${fmtDate(b.startDate)} → ${fmtDate(b.returnDate)}` })
      setPaper({ kind: rentNow ? 'challan' : 'slip', booking: b })
    }} />
    <HandOverModal booking={handOver} onClose={() => setHandOver(null)} onDone={(b) => { setHandOver(null); changed(); notifications.show({ color: 'green', title: 'Handed over', message: `Return by ${fmtDate(b.returnDate)}` }); setPaper({ kind: 'challan', booking: b }) }} />
    <ReturnModal booking={returning} onClose={() => setReturning(null)} onDone={(b) => { setReturning(null); changed(); notifications.show({ color: 'green', title: 'Returned & billed', message: b.bill?.billNumber ?? '' }); if (b.bill) setShownBill(b.bill) }} />
    <RepairsModal opened={repairsOpen} onClose={() => setRepairsOpen(false)} onChanged={() => load()} />
    <ScanModal opened={scanning} onClose={() => setScanning(false)} onCode={(c) => { setScanning(false); void openByCode(c) }} />
    <PaperPreviewModal title={paper ? paperTitle(paper) : ''} opened={paper !== null} onClose={() => setPaper(null)}>{paper && <RentalPaperContent paper={paper} shop={shop} />}</PaperPreviewModal>
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

/** One rental card; `day` adds what happens on that day (take-away / due back / returned). */
function RentalCard({ b, day, onOpen, onHandOver, onReturn }: { b: RentalBooking; day?: string; onOpen: (b: RentalBooking) => void; onHandOver: (b: RentalBooking) => void; onReturn: (b: RentalBooking) => void }) {
  const late = b.status === 'WITH_CUSTOMER' && b.returnDate < todayIso()
  const daysLate = late ? Math.round((new Date(`${todayIso()}T00:00:00`).getTime() - new Date(`${b.returnDate}T00:00:00`).getTime()) / 86400000) : 0
  const event = day && (b.returnedOn === day ? 'Returned' : b.handedOverOn === day ? 'Handed over' : b.startDate === day && b.status === 'BOOKED' ? 'Take-away' : b.returnDate === day && b.status === 'WITH_CUSTOMER' ? 'Due back' : null)
  return <Card withBorder radius="md" padding="md" style={late ? { borderColor: 'var(--mantine-color-red-5)' } : undefined}>
    <UnstyledButton onClick={() => onOpen(b)} style={{ width: '100%' }} aria-label={`Open booking ${b.bookingNumber}`}>
      <Group justify="space-between" wrap="nowrap">
        <Text fw={800}>{b.bookingNumber}</Text>
        <Group gap={6}>{event && <Badge variant="dot">{event}</Badge>}{late && <Badge color="red" variant="light">{daysLate} day{daysLate === 1 ? '' : 's'} late</Badge>}<Badge color={statusColor(b)} variant="light">{statusLabel(b)}</Badge></Group>
      </Group>
      <Text fw={600} mt={4}>{b.customerName} <Text span size="sm" c="dimmed" fw={400}>{b.customerMobile}</Text></Text>
      <Text size="sm" lineClamp={2}>{piecesText(b)}</Text>
      <Text size="sm" c="dimmed" mt={2}>{fmtDate(b.handedOverOn ?? b.startDate)} → {fmtDate(b.returnedOn ?? b.returnDate)} · {daysText(b.days)} · {b.bill ? `billed ${money(b.bill.total)}` : `est. ${money(b.estimate)}`}</Text>
    </UnstyledButton>
    {b.status === 'BOOKED' && b.startDate <= todayIso() && <Button mt="sm" fullWidth color="violet" leftSection={<IconHandFinger size={18} />} onClick={() => onHandOver(b)}>Hand over</Button>}
    {b.status === 'WITH_CUSTOMER' && <Button mt="sm" fullWidth color="teal" leftSection={<IconArrowBackUp size={18} />} onClick={() => onReturn(b)}>Return &amp; bill</Button>}
  </Card>
}
