import { useState } from 'react'
import { Button, Card, Group, MultiSelect, SimpleGrid, Stack, Table, Text, Title } from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { notifications } from '@mantine/notifications'
import { IconDownload, IconFileAnalytics } from '@tabler/icons-react'
import { extractErrorMessage } from '../api/catalogApi'
import type { ReportCriteria, SalesReport } from '../api/outletApi'
import { money } from './BillDetailsModal'
import { fmtDate, fmtDateTime } from '../config/dateFormat'

const PREVIEW_ROWS = 100
type Option = { value: string; label: string }
type Criterion = { label: string; value: string }

// Spreadsheet apps run cells starting with = + - @ as formulas; prefix them so customer-entered text stays text.
const cell = (v: string | number | null) => { const s = v === null ? '' : String(v); const safe = /^[=+\-@\t\r]/.test(s) && typeof v === 'string' ? `'${s}` : s; return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe }

function toCsv(report: SalesReport, showOutlet: boolean, criteria: Criterion[]) {
  const head = ['Date', 'Bill no.', ...(showOutlet ? ['Outlet'] : []), 'Customer', 'Mobile', 'Service', 'Item', 'Item code', 'Qty', 'Unit price', 'Line total']
  const lines = report.rows.map((r) => [fmtDateTime(r.createdAt), r.billNumber, ...(showOutlet ? [r.outlet] : []), r.customerName, r.customerMobile, r.service, r.item, r.itemCode, r.quantity, r.unitPrice.toFixed(2), r.lineTotal.toFixed(2)].map((v) => cell(v as string | number | null)).join(','))
  const foot = ['', 'Total', ...(showOutlet ? [''] : []), '', '', '', '', '', report.units, '', report.totalSales.toFixed(2)].join(',')
  const intro = ['Sales report', ...criteria.map((c) => `${c.label}: ${c.value}`), ''].map((l) => cell(l)).join('\r\n')
  return '\uFEFF' + intro + '\r\n' + [head.join(','), ...lines, foot].join('\r\n')
}

function download(name: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
}

const iso = (d: Date | string | null) => { if (!d) return undefined; const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}` }

/**
 * Criteria form + generated report, shared by admin and outlet. Pass outletOptions only where the
 * user may pick outlets (admin); the outlet module omits it and the server pins the report to that outlet.
 */
export function ReportBuilder({ outletOptions, serviceOptions, generate }: { outletOptions?: Option[]; serviceOptions: Option[]; generate: (c: ReportCriteria) => Promise<SalesReport> }) {
  const [outlets, setOutlets] = useState<string[]>([])
  const [services, setServices] = useState<string[]>([])
  const [from, setFrom] = useState<string | null>(null)
  const [to, setTo] = useState<string | null>(null)
  const [report, setReport] = useState<SalesReport | null>(null)
  const [applied, setApplied] = useState<Criterion[]>([])
  const [loading, setLoading] = useState(false)
  const showOutlet = outletOptions !== undefined

  const run = async () => {
    setLoading(true)
    const names = (ids: string[], options: Option[] | undefined, all: string) => ids.length ? ids.map((id) => options?.find((o) => o.value === id)?.label ?? id).join(', ') : all
    const snapshot: Criterion[] = [...(showOutlet ? [{ label: 'Outlets', value: names(outlets, outletOptions, 'All outlets') }] : []), { label: 'Services', value: names(services, serviceOptions, 'All services') }, { label: 'From date', value: from ? fmtDate(from) : 'Any' }, { label: 'To date', value: to ? fmtDate(to) : 'Any' }]
    try { const result = await generate({ outletIds: outlets.map(Number), serviceIds: services.map(Number), from: iso(from), to: iso(to) }); setReport(result); setApplied(snapshot) }
    catch (error) { setReport(null); notifications.show({ color: 'red', title: 'Could not generate report', message: extractErrorMessage(error) }) }
    finally { setLoading(false) }
  }
  const stamp = new Date().toISOString().slice(0, 10)

  return <Stack gap="lg">
    <Card withBorder>
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        {showOutlet && <MultiSelect label="Outlets" placeholder={outlets.length ? undefined : 'All outlets'} data={outletOptions} value={outlets} onChange={setOutlets} searchable clearable />}
        <MultiSelect label="Services" placeholder={services.length ? undefined : 'All services'} data={serviceOptions} value={services} onChange={setServices} searchable clearable />
        <DateInput label="From date" placeholder="Any" value={from} onChange={setFrom} maxDate={to ?? undefined} clearable />
        <DateInput label="To date" placeholder="Any" value={to} onChange={setTo} minDate={from ?? undefined} clearable />
      </SimpleGrid>
      <Group mt="md"><Button leftSection={<IconFileAnalytics size={17} />} loading={loading} onClick={() => void run()}>Generate report</Button></Group>
    </Card>
    {report && <Card withBorder>
      <Card bg="var(--mantine-color-gray-light)" padding="sm" mb="md"><Text size="xs" fw={700} c="dimmed" tt="uppercase" mb={4}>Criteria applied</Text><Group gap="lg">{applied.map((c) => <div key={c.label}><Text size="xs" c="dimmed">{c.label}</Text><Text size="sm" fw={500}>{c.value}</Text></div>)}</Group></Card>
      <Group justify="space-between" mb="md"><div><Title order={4}>Sales report</Title><Text size="xs" c="dimmed">Generated {fmtDateTime(report.generatedAt)} · {report.from ? fmtDate(report.from) : 'start'} to {report.to ? fmtDate(report.to) : 'today'}</Text></div>
        <Button variant="light" leftSection={<IconDownload size={17} />} disabled={!report.rows.length} onClick={() => download(`sales-report-${stamp}.csv`, toCsv(report, showOutlet, applied))}>Download CSV</Button></Group>
      <SimpleGrid cols={{ base: 1, sm: 3 }} mb="md">
        <div><Text size="sm" c="dimmed">Total sales</Text><Text size="xl" fw={700}>{money(report.totalSales)}</Text></div>
        <div><Text size="sm" c="dimmed">Bills</Text><Text size="xl" fw={700}>{report.billCount}</Text></div>
        <div><Text size="sm" c="dimmed">Units sold</Text><Text size="xl" fw={700}>{report.units}</Text></div>
      </SimpleGrid>
      {!report.rows.length ? <Text c="dimmed">No sales match these criteria.</Text> : <Stack>
        <SimpleGrid cols={{ base: 1, md: showOutlet ? 2 : 1 }}>
          <div><Text fw={600} mb={4}>By service</Text><Table><Table.Tbody>{report.byService.map((g) => <Table.Tr key={g.name}><Table.Td>{g.name}</Table.Td><Table.Td>{g.units} units</Table.Td><Table.Td ta="right">{money(g.sales)}</Table.Td></Table.Tr>)}</Table.Tbody></Table></div>
          {showOutlet && <div><Text fw={600} mb={4}>By outlet</Text><Table><Table.Tbody>{report.byOutlet.map((g) => <Table.Tr key={g.name}><Table.Td>{g.name}</Table.Td><Table.Td>{g.units} units</Table.Td><Table.Td ta="right">{money(g.sales)}</Table.Td></Table.Tr>)}</Table.Tbody></Table></div>}
        </SimpleGrid>
        <Text fw={600}>Lines{report.rows.length > PREVIEW_ROWS ? ` (first ${PREVIEW_ROWS} of ${report.rows.length}; the CSV has all)` : ''}</Text>
        <div style={{ overflowX: 'auto' }}><Table striped><Table.Thead><Table.Tr><Table.Th>Date</Table.Th><Table.Th>Bill</Table.Th>{showOutlet && <Table.Th>Outlet</Table.Th>}<Table.Th>Customer</Table.Th><Table.Th>Item</Table.Th><Table.Th>Qty</Table.Th><Table.Th ta="right">Total</Table.Th></Table.Tr></Table.Thead><Table.Tbody>{report.rows.slice(0, PREVIEW_ROWS).map((r, i) => <Table.Tr key={i}><Table.Td>{fmtDate(r.createdAt)}</Table.Td><Table.Td>{r.billNumber}</Table.Td>{showOutlet && <Table.Td>{r.outlet}</Table.Td>}<Table.Td>{r.customerName}</Table.Td><Table.Td>{r.item}<Text size="xs" c="dimmed">{r.service}</Text></Table.Td><Table.Td>{r.quantity}</Table.Td><Table.Td ta="right">{money(r.lineTotal)}</Table.Td></Table.Tr>)}</Table.Tbody></Table></div>
        <Text size="xs" c="dimmed">Totals are item line totals before bill-level discounts.</Text>
      </Stack>}
    </Card>}
  </Stack>
}
