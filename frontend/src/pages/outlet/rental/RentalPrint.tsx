import type { RentalBooking } from '../../../api/outletApi'
import { money } from '../../../components/BillDetailsModal'
import { ReceiptHead, ReceiptRow, ReceiptRule, rs, type Shop } from '../../../components/receipt/ReceiptParts'
import { fmtDate } from '../../../config/dateFormat'
import { daysText } from './shared'

export type RentalPaper = { kind: 'slip' | 'challan'; booking: RentalBooking }
export const paperTitle = (p: RentalPaper) => (p.kind === 'slip' ? 'Booking slip' : 'Delivery challan')

/** Booking slip: booking number + barcode (scanned on the take-away day), pieces, dates, estimate. */
function Slip({ b, shop }: { b: RentalBooking; shop: Shop }) {
  return <div style={rs.paper}>
    <ReceiptHead shop={shop} title="Jewellery booking" number={b.bookingNumber} date={fmtDate(b.createdAt)} />
    <ReceiptRule />
    <div style={rs.strong}>{b.customerName} · {b.customerMobile}</div>
    <div style={rs.box}><div style={{ ...rs.center, ...rs.big }}>{fmtDate(b.startDate)} → {fmtDate(b.returnDate)}</div><div style={{ ...rs.center, ...rs.muted }}>{daysText(b.days)}</div></div>
    {b.items.map((i) => <ReceiptRow key={i.itemId} left={`${i.name}${i.quantity > 1 ? ` × ${i.quantity}` : ''}`} right={`${money(i.pricePerDay)}/day`} />)}
    <ReceiptRule />
    <ReceiptRow style={rs.strong} left="Estimated rent" right={money(b.estimate)} />
    <div style={{ ...rs.center, ...rs.muted, marginTop: 6 }}>Please bring this slip on {fmtDate(b.startDate)}. Not collected on that day = booking cancelled.</div>
  </div>
}

/** One copy of the delivery challan: every piece given, the return date, the estimate (no amount charged yet). */
function ChallanCopy({ b, shop, copy }: { b: RentalBooking; shop: Shop; copy: 'Customer copy' | 'Shop copy' }) {
  return <div style={rs.paper}>
    <ReceiptHead shop={shop} title="Delivery challan" number={b.challan?.billNumber ?? b.bookingNumber} date={fmtDate(b.handedOverOn ?? b.startDate)} />
    <div style={{ ...rs.center, ...rs.muted }}>{copy} · Booking {b.bookingNumber}</div>
    <ReceiptRule />
    <div style={rs.strong}>{b.customerName} · {b.customerMobile}</div>
    {b.items.map((i) => <ReceiptRow key={i.itemId} left={<span><b>{i.name}</b>{i.itemCode ? ` (${i.itemCode})` : ''}</span>} right={`× ${i.quantity}`} />)}
    <div style={rs.box}>
      <ReceiptRow style={rs.big} left="Return by" right={fmtDate(b.returnDate)} />
      <ReceiptRow left={`Estimate · ${daysText(b.days)}`} right={money(b.estimate)} />
    </div>
    <div style={{ ...rs.center, ...rs.muted }}>Final amount on return: days kept + any damage or missing charges.</div>
    {copy === 'Shop copy' && <div style={{ marginTop: 22 }}><div style={{ borderTop: '1px solid #111', width: '70%' }} /><div style={rs.muted}>Customer signature (received all pieces above)</div></div>}
  </div>
}

export function RentalPaperContent({ paper, shop }: { paper: RentalPaper; shop: Shop }) {
  if (paper.kind === 'slip') return <Slip b={paper.booking} shop={shop} />
  return <><ChallanCopy b={paper.booking} shop={shop} copy="Customer copy" /><div style={rs.cut}>✂ cut here</div><ChallanCopy b={paper.booking} shop={shop} copy="Shop copy" /></>
}
