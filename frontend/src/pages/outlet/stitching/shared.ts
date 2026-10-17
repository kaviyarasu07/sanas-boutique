import { notifications } from '@mantine/notifications'
import { extractErrorMessage } from '../../../api/catalogApi'
import type { StitchItem, StitchItemStatus, StitchOrder } from '../../../api/outletApi'
import { todayIso } from '../../../components/BillDetailsModal'

export const itemStatusLabel: Record<StitchItemStatus, string> = { NOT_STARTED: 'Not started', STARTED: 'Started', FINISHED: 'Finished', DELIVERED: 'Delivered', CANCELLED: 'Cancelled' }
export const itemStatusColor: Record<StitchItemStatus, string> = { NOT_STARTED: 'gray', STARTED: 'blue', FINISHED: 'teal', DELIVERED: 'violet', CANCELLED: 'red' }
/** Choices staff can pick for a garment still in the shop (moving back is allowed). */
export const progressOptions = [{ value: 'NOT_STARTED', label: 'Not started' }, { value: 'STARTED', label: 'Started' }, { value: 'FINISHED', label: 'Finished' }]
export const cancelReasons = ['Customer cancelled', 'Fabric problem', 'Other']

/** "Customer's own fabric" / "In-house purchase" (+ the linked shop bill, if any). */
export const fabricLabel = (o: StitchOrder) => o.fabricSource !== 'IN_HOUSE' ? "Customer's own fabric" : o.fabricBill ? `In-house purchase · ${o.fabricBill.summary} (bill ${o.fabricBill.billNumber})` : 'In-house purchase'

export const isOpen = (i: StitchItem) => i.status === 'NOT_STARTED' || i.status === 'STARTED' || i.status === 'FINISHED'
export const openItems = (o: StitchOrder) => o.items.filter(isOpen)
export const isLate = (i: StitchItem) => isOpen(i) && i.deliveryDate < todayIso()
export const isDueToday = (i: StitchItem) => isOpen(i) && i.deliveryDate === todayIso()

/** "5 garments · 1 delivered · 2 finished · 2 started" */
export function progressText(o: StitchOrder): string {
  const live = o.items.filter((i) => i.status !== 'CANCELLED')
  const parts = [`${live.length} garment${live.length === 1 ? '' : 's'}`]
  for (const s of ['DELIVERED', 'FINISHED', 'STARTED', 'NOT_STARTED'] as StitchItemStatus[]) {
    const n = live.filter((i) => i.status === s).length
    if (n && n !== live.length) parts.push(`${n} ${itemStatusLabel[s].toLowerCase()}`)
  }
  if (live.length && live.every((i) => i.status === live[0].status)) parts.push(`all ${itemStatusLabel[live[0].status].toLowerCase()}`)
  return parts.join(' · ')
}

/** Advance used by a new bill: as much of the advance left as the bill needs (same rule as the server). */
export const advanceUsedFor = (o: StitchOrder, billTotal: number) => Math.max(0, Math.min(o.advanceAvailable, billTotal))

export const fail = (title: string) => (e: unknown) => notifications.show({ color: 'red', title, message: extractErrorMessage(e) })

// "Your name" for the order log lives in one shared place (also used by Parlour).
export { getAuthorName, setAuthorName } from '../../../components/authorName'
