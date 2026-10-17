import { Button, Divider, Group, Modal, Portal, Stack, Table, Text, Title } from '@mantine/core'
import { IconPrinter } from '@tabler/icons-react'
import type { Bill } from '../api/outletApi'
import { fmtDateTime } from '../config/dateFormat'

// Indian digit grouping, always 2 decimals: ₹4,49,944.00
const rupees = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const money = (n: number) => `₹${rupees.format(Number(n) || 0)}`

/** Today as yyyy-MM-dd in the browser's local calendar (not UTC, which flips the date near midnight IST). */
export const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Receipt view shared by the outlet and admin modules. */
/** A rental hand-over slip (no amount). Older responses without a type fall back to the line text. */
const isChallan = (bill: Bill | null) => Boolean(bill && (bill.type ? bill.type === 'CHALLAN' : bill.items.length > 0 && bill.items.every((i) => i.itemName.includes('(rental hand-over'))))

/** Stitching: advance already paid and the balance to pay now (only when an advance was used). */
const AdvanceLines = ({ bill, bold }: { bill: Bill; bold?: boolean }) => bill.advancePaid > 0 ? <><Group justify="space-between"><Text>Advance paid</Text><Text>− {money(bill.advancePaid)}</Text></Group><Group justify="space-between"><Text fw={800}>Balance to pay</Text><Text fw={800} size={bold ? 'lg' : undefined}>{money(bill.balance)}</Text></Group></> : null

export function BillDetailsModal({ bill, onClose }: { bill: Bill | null; onClose: () => void }) {
  return <Modal opened={Boolean(bill)} onClose={onClose} title={isChallan(bill) ? 'Delivery challan' : 'Bill details'} centered size="lg"><Stack>{bill && <><Group justify="space-between" align="start"><div><Title order={3}>{bill.shopName}</Title><Text size="sm" c="dimmed">{bill.shopAddress || 'Address not available'}</Text></div><div><Text fw={700}>Bill no. {bill.billNumber}</Text><Text size="xs" c="dimmed">{fmtDateTime(bill.createdAt)}</Text></div></Group><Divider /><Text>Customer: <b>{bill.customerName}</b></Text><Text size="sm">Mobile: {bill.customerMobile}</Text><Table><Table.Thead><Table.Tr><Table.Th>Product</Table.Th><Table.Th>Qty</Table.Th><Table.Th>Amount</Table.Th></Table.Tr></Table.Thead><Table.Tbody>{bill.items.map((item, index) => <Table.Tr key={`${index}-${item.itemName}`}><Table.Td>{item.itemName}</Table.Td><Table.Td>{item.quantity}</Table.Td><Table.Td>{money(item.lineTotal)}</Table.Td></Table.Tr>)}</Table.Tbody></Table><Divider /><Group justify="space-between"><Text>Subtotal</Text><Text>{money(bill.subtotal)}</Text></Group><Group justify="space-between"><Text>Discount</Text><Text>{money(bill.discount)}</Text></Group><Group justify="space-between"><Text fw={700}>Total</Text><Text fw={700}>{money(bill.total)}</Text></Group><AdvanceLines bill={bill} bold /><Group justify="flex-end"><Button variant="default" onClick={onClose}>Close</Button><Button leftSection={<IconPrinter size={17} />} onClick={() => window.print()}>Print bill</Button></Group><Portal><div className="print-bill"><Title order={2}>{bill.shopName}</Title><Text>{bill.shopAddress}</Text><Text>Bill no. {bill.billNumber}</Text><Text>Customer: {bill.customerName} · {bill.customerMobile}</Text><Divider my="sm" />{bill.items.map((item, index) => <Group key={`print-${index}-${item.itemName}`} justify="space-between"><Text>{item.itemName} × {item.quantity}</Text><Text>{money(item.lineTotal)}</Text></Group>)}<Divider my="sm" /><Group justify="space-between"><Text>Subtotal</Text><Text>{money(bill.subtotal)}</Text></Group><Group justify="space-between"><Text>Discount</Text><Text>{money(bill.discount)}</Text></Group><Group justify="space-between"><Text fw={700}>Total</Text><Text fw={700}>{money(bill.total)}</Text></Group><AdvanceLines bill={bill} /></div></Portal></>}</Stack></Modal>
}
