import type { ParlourAppointment } from '../../../api/outletApi'
import { money } from '../../../components/BillDetailsModal'
import { ReceiptHead, ReceiptRow, ReceiptRule, rs, type Shop } from '../../../components/receipt/ReceiptParts'
import { fmtDate } from '../../../config/dateFormat'
import { timeLabel } from './shared'

/** Appointment slip for the customer: booking number + barcode (scanned on the day), services, date and time. */
export function ParlourSlip({ a, shop }: { a: ParlourAppointment; shop: Shop }) {
  return <div style={rs.paper}>
    <ReceiptHead shop={shop} title="Parlour appointment" number={a.bookingNumber} date={fmtDate(a.createdAt)} />
    <ReceiptRule />
    <div style={rs.strong}>{a.customerName} · {a.customerMobile}</div>
    <div style={rs.box}>
      <div style={{ ...rs.center, ...rs.big }}>{fmtDate(a.date)} · {timeLabel(a.time)}</div>
    </div>
    {a.items.map((i) => <ReceiptRow key={i.itemId} left={i.quantity > 1 ? `${i.name} × ${i.quantity}` : i.name} right={money(i.price * i.quantity)} />)}
    <ReceiptRule />
    <ReceiptRow style={rs.strong} left="Estimated amount" right={money(a.estimate)} />
    {a.rescheduledFrom && <div style={{ ...rs.muted, marginTop: 4 }}>Rescheduled from {a.rescheduledFrom}</div>}
    <div style={{ ...rs.center, ...rs.muted, marginTop: 6 }}>Please come 5 minutes early and bring this slip.</div>
  </div>
}
