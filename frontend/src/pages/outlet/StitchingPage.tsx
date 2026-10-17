import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Alert, Badge, Button, Card, Group, Loader, Pagination, SimpleGrid, Stack, Tabs, Text, TextInput, ThemeIcon, Title, UnstyledButton } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { IconAlertTriangle, IconCalendarDue, IconChevronRight, IconPlus, IconScan, IconSearch } from '@tabler/icons-react'
import { outletServiceApi, stitchApi, type StitchOrder, type StitchView } from '../../api/outletApi'
import { money, todayIso } from '../../components/BillDetailsModal'
import { ScanModal } from '../../components/ScanModal'
import { brand } from '../../config/brand'
import { fmtDate } from '../../config/dateFormat'
import { NewOrderModal } from './stitching/NewOrderModal'
import { OrderDetailsModal } from './stitching/OrderDetailsModal'
import { PrintPreviewModal, type PrintJob, type Shop } from './stitching/StitchPrint'
import { isDueToday, isLate, openItems, progressText } from './stitching/shared'

type Mode = StitchView | 'DUE' | 'LATE'
const tabs: { value: StitchView; label: string }[] = [{ value: 'OPEN', label: 'Open' }, { value: 'READY', label: 'Ready to deliver' }, { value: 'DELIVERED', label: 'Delivered' }, { value: 'CANCELLED', label: 'Cancelled' }]
const empty: Record<Mode, string> = { OPEN: 'No open orders. Tap "New order" to take one.', READY: 'Nothing is ready to deliver yet.', DELIVERED: 'No delivered orders yet.', CANCELLED: 'No cancelled orders.', DUE: 'No garments due today.', LATE: 'Nothing is late. Everything is on track.' }
const RECEIPT = /^STC-\d+$/i

/**
 * Stitching module: take orders (garments with their own date and price, advance), move each garment
 * Not started → Started → Finished, deliver some or all and bill (advance taken off), refund on cancel,
 * and keep a timeline with staff comments per order.
 */
export function StitchingPage() {
  const [mode, setMode] = useState<Mode>('OPEN')
  const [orders, setOrders] = useState<StitchOrder[]>([])
  const [pages, setPages] = useState({ page: 0, total: 1 })
  const [search, setSearch] = useState('')
  const [debounced] = useDebouncedValue(search.trim(), 300)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [counts, setCounts] = useState({ due: 0, late: 0 })
  const [creating, setCreating] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [openId, setOpenId] = useState<number | null>(null)
  const [print, setPrint] = useState<PrintJob | null>(null)
  const [shop, setShop] = useState<Shop>({ name: brand.name, address: null })

  useEffect(() => { outletServiceApi.current().then((o) => setShop({ name: brand.name, address: [o.name, o.address].filter(Boolean).join(' · ') })).catch(() => undefined) }, [])

  // Only the newest request may update the list, so a slow old response cannot overwrite a newer one.
  const latest = useRef(0)
  const load = (page = pages.page) => {
    const id = ++latest.current
    setLoading(true); setError(null)
    const done = (list: StitchOrder[], total = 1, p = 0) => { if (id !== latest.current) return; setOrders(list); setPages({ page: p, total }); setLoading(false) }
    const failed = () => { if (id !== latest.current) return; setError('We could not load the orders. Please check the internet and try again.'); setLoading(false) }
    if (mode === 'DUE') stitchApi.due(todayIso()).then((r) => done(r)).catch(failed)
    else if (mode === 'LATE') stitchApi.overdue().then((r) => done(r)).catch(failed)
    else stitchApi.list({ view: mode, search: debounced, page }).then((r) => done(r.content, r.totalPages, r.page)).catch(failed)
  }
  const loadCounts = () => Promise.all([stitchApi.due(todayIso()), stitchApi.overdue()]).then(([d, l]) => setCounts({ due: d.length, late: l.length })).catch(() => undefined)
  useEffect(() => { load(0) }, [mode, debounced]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void loadCounts() }, [])
  const refresh = () => { load(); void loadCounts() }

  /** A scanned or typed receipt number opens the order straight away. */
  const openByCode = async (code: string) => {
    try { const o = await stitchApi.lookup(code); setOpenId(o.id); setSearch('') }
    catch { notifications.show({ color: 'orange', title: 'Not found', message: "We couldn't find an order with that receipt number." }) }
  }

  return <Stack gap="lg">
    <Group justify="space-between">
      <div><Title order={2}>Stitching</Title><Text c="dimmed" size="sm">Take orders, track each garment, deliver and bill.</Text></div>
    </Group>

    <SimpleGrid cols={{ base: 2, sm: 4 }}>
      <Tile icon={<IconPlus size={26} />} color="violet" label="New order" onClick={() => setCreating(true)} />
      <Tile icon={<IconCalendarDue size={26} />} color="orange" label="Due today" count={counts.due} active={mode === 'DUE'} onClick={() => setMode('DUE')} />
      <Tile icon={<IconAlertTriangle size={26} />} color="red" label="Late" count={counts.late} active={mode === 'LATE'} onClick={() => setMode('LATE')} />
      <Tile icon={<IconScan size={26} />} color="blue" label="Scan receipt" onClick={() => setScanning(true)} />
    </SimpleGrid>

    <Card withBorder radius="md">
      <form onSubmit={(e) => { e.preventDefault(); if (RECEIPT.test(search.trim())) void openByCode(search) }}>
        <TextInput size="md" placeholder="Receipt number (STC-000045), mobile or name" leftSection={<IconSearch size={18} />} value={search} onChange={(e) => { setSearch(e.currentTarget.value); if (mode === 'DUE' || mode === 'LATE') setMode('OPEN') }} />
      </form>
      {mode === 'DUE' || mode === 'LATE'
        ? <Group justify="space-between" mt="md"><Title order={4}>{mode === 'DUE' ? 'Due today' : 'Late'}</Title><Button variant="subtle" onClick={() => setMode('OPEN')}>Show all orders</Button></Group>
        : <Tabs mt="md" value={mode} onChange={(v) => setMode((v ?? 'OPEN') as StitchView)}><Tabs.List>{tabs.map((t) => <Tabs.Tab key={t.value} value={t.value}>{t.label}</Tabs.Tab>)}</Tabs.List></Tabs>}

      {error ? <Alert mt="md" color="red" title="Something went wrong">{error} <Button size="xs" variant="light" ml="sm" onClick={() => load()}>Try again</Button></Alert>
        : loading && !orders.length ? <Group justify="center" py="xl"><Loader size="sm" /><Text c="dimmed">Loading orders…</Text></Group>
        : !orders.length ? <Text c="dimmed" ta="center" py="xl">{search ? 'No orders match your search.' : empty[mode]}</Text>
        : <SimpleGrid mt="md" cols={{ base: 1, sm: 2, lg: 3 }}>{orders.map((o) => <OrderCard key={o.id} order={o} onOpen={() => setOpenId(o.id)} />)}</SimpleGrid>}
      {pages.total > 1 && mode !== 'DUE' && mode !== 'LATE' && <Group justify="center" mt="md"><Pagination value={pages.page + 1} total={pages.total} onChange={(n) => load(n - 1)} /></Group>}
    </Card>

    <NewOrderModal opened={creating} onClose={() => setCreating(false)} onSaved={(o) => { setCreating(false); setMode('OPEN'); refresh(); setOpenId(o.id); setPrint({ kind: 'both', order: o, comments: [] }) }} />
    <OrderDetailsModal orderId={openId} onClose={() => setOpenId(null)} onChanged={refresh} onPrint={setPrint} />
    <ScanModal opened={scanning} onClose={() => setScanning(false)} onCode={(c) => { setScanning(false); void openByCode(c) }} />
    <PrintPreviewModal job={print} shop={shop} onClose={() => setPrint(null)} />
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

function OrderCard({ order: o, onOpen }: { order: StitchOrder; onOpen: () => void }) {
  const open = openItems(o)
  const late = open.some(isLate)
  const today = open.some(isDueToday)
  const ready = o.items.filter((i) => i.status === 'FINISHED').length
  return <UnstyledButton onClick={onOpen} aria-label={`Open order ${o.orderNumber}`}>
    <Card withBorder radius="md" padding="md" h="100%" style={late ? { borderColor: 'var(--mantine-color-red-5)' } : undefined}>
      <Group justify="space-between" wrap="nowrap">
        <Text fw={800}>{o.orderNumber}</Text>
        <Group gap={6}>
          {late && <Badge color="red" variant="light">Late</Badge>}
          {today && <Badge color="orange" variant="light">Today</Badge>}
          {ready > 0 && o.status === 'OPEN' && <Badge color="teal" variant="light">{ready} ready</Badge>}
          {o.status !== 'OPEN' && <Badge color={o.status === 'DELIVERED' ? 'violet' : 'red'} variant="light">{o.status === 'DELIVERED' ? 'Delivered' : 'Cancelled'}</Badge>}
        </Group>
      </Group>
      <Text fw={600} mt={6}>{o.customerName} <Text span size="sm" c="dimmed" fw={400}>{o.customerMobile}</Text></Text>
      <Text size="sm" lineClamp={1}>{o.items.filter((i) => i.status !== 'CANCELLED').map((i) => i.garment).join(', ')}</Text>
      <Text size="xs" c="dimmed" mt={2}>{progressText(o)}</Text>
      <Group justify="space-between" mt="sm" wrap="nowrap">
        <Text size="sm">{o.status === 'OPEN' ? <>Next delivery <b>{fmtDate(o.estimatedDeliveryDate)}</b></> : `Ordered ${fmtDate(o.createdAt)}`}</Text>
        <Group gap={4} wrap="nowrap"><Text size="sm" fw={600}>{o.unpricedCount ? `${money(o.total)}+` : money(o.total)}</Text><IconChevronRight size={18} color="var(--mantine-color-dimmed)" /></Group>
      </Group>
      {o.advanceAvailable > 0 && <Text size="xs" c="teal">Advance left {money(o.advanceAvailable)}</Text>}
    </Card>
  </UnstyledButton>
}
