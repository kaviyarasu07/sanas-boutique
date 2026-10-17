import { PaperPreviewModal, ReceiptHead as Head, ReceiptRow as Row, ReceiptRule as Rule, rs as s, type Shop } from '../../../components/receipt/ReceiptParts'
import type { StitchLogEntry, StitchOrder, StitchPayment } from '../../../api/outletApi'
import { money } from '../../../components/BillDetailsModal'
import { fabricLabel } from './shared'
import { fmtDate, fmtDateTime } from '../../../config/dateFormat'

export type { Shop }
/** What to print: the customer receipt, the tailor's work slip (with staff comments), an advance receipt or a refund challan. */
export type PrintJob =
  | { kind: 'receipt'; order: StitchOrder }
  | { kind: 'workslip'; order: StitchOrder; comments: StitchLogEntry[] }
  | { kind: 'both'; order: StitchOrder; comments: StitchLogEntry[] }
  | { kind: 'advance'; order: StitchOrder; payment: StitchPayment }
  | { kind: 'refund'; order: StitchOrder; payment: StitchPayment }

const titles: Record<PrintJob['kind'], string> = { receipt: 'Customer receipt', workslip: 'Work slip', both: 'Receipt and work slip', advance: 'Advance receipt', refund: 'Refund challan' }

const live = (o: StitchOrder) => o.items.filter((i) => i.status !== 'CANCELLED')

function Receipt({ order, shop }: { order: StitchOrder; shop: Shop }) {
  return <div style={s.paper}>
    <Head shop={shop} title="Stitching receipt" number={order.orderNumber} date={fmtDate(order.createdAt)} />
    <Rule />
    <div style={s.strong}>{order.customerName} · {order.customerMobile}</div>
    <div style={{ marginTop: 6 }}>{live(order).map((i, n) => <div key={i.id} style={{ marginBottom: 4 }}>
      <Row left={<span style={s.strong}>{n + 1}. {i.garment}</span>} right={i.amount != null ? money(i.amount) : <span style={s.muted}>price later</span>} />
      <div style={s.muted}>Delivery {fmtDate(i.deliveryDate)}{i.status === 'DELIVERED' ? ' · delivered' : ''}</div>
    </div>)}</div>
    <div style={s.box}>
      <Row left={order.unpricedCount ? 'Total so far' : 'Total'} right={money(order.total)} />
      <Row left="Advance paid" right={money(order.advancePaid)} />
      {order.unpricedCount === 0 && <Row style={s.big} left="Balance" right={money(Math.max(0, order.total - order.advancePaid))} />}
    </div>
    <div style={{ ...s.center, ...s.strong }}>★ Next delivery: {fmtDate(order.estimatedDeliveryDate)} ★</div>
    <div style={{ ...s.center, ...s.muted, marginTop: 4 }}>Please bring this receipt when you collect.</div>
  </div>
}

function WorkSlip({ order, shop, comments }: { order: StitchOrder; shop: Shop; comments: StitchLogEntry[] }) {
  return <div style={s.paper}>
    <Head shop={shop} title="Work slip" number={order.orderNumber} date={fmtDate(order.createdAt)} />
    <div style={s.strong}>{order.customerName}</div>
    <div style={s.muted}>Fabric: {fabricLabel(order)}</div>
    {live(order).filter((i) => i.status !== 'DELIVERED').map((i, n) => <div key={i.id}>
      <Rule />
      <Row left={<span style={s.big}>{n + 1}. {i.garment}</span>} right={<span style={s.big}>{fmtDate(i.deliveryDate)}</span>} />
      {i.measurements && <div style={{ whiteSpace: 'pre-wrap', marginTop: 2 }}>{i.measurements}</div>}
      {i.notes && <div style={{ marginTop: 2 }}>Note: {i.notes}</div>}
    </div>)}
    {order.notes && <><Rule /><div>Order note: {order.notes}</div></>}
    {comments.length > 0 && <><Rule /><div style={s.strong}>Staff comments</div>{comments.map((c) => <div key={c.id} style={{ marginTop: 3 }}>• {c.message} <span style={s.muted}>({c.authorName}, {fmtDate(c.createdAt)})</span></div>)}</>}
  </div>
}

function AdvanceReceipt({ order, payment, shop }: { order: StitchOrder; payment: StitchPayment; shop: Shop }) {
  return <div style={s.paper}>
    <Head shop={shop} title="Advance receipt" number={order.orderNumber} date={fmtDateTime(payment.createdAt)} />
    <Rule />
    <div style={s.strong}>{order.customerName} · {order.customerMobile}</div>
    <div style={s.box}><Row style={s.big} left="Advance received" right={money(payment.amount)} /></div>
    <Row left="Total advance paid" right={money(order.advancePaid)} />
    <Row left={order.unpricedCount ? 'Order total so far' : 'Order total'} right={money(order.total)} />
    <div style={{ ...s.center, ...s.muted, marginTop: 6 }}>Received by {payment.authorName}</div>
  </div>
}

function RefundCopy({ order, payment, shop, copy }: { order: StitchOrder; payment: StitchPayment; shop: Shop; copy: 'Customer copy' | 'Shop copy' }) {
  const cancelled = order.items.filter((i) => i.status === 'CANCELLED')
  return <div style={s.paper}>
    <Head shop={shop} title="Refund challan" number={payment.refundNumber ?? ''} date={fmtDateTime(payment.createdAt)} />
    <div style={{ ...s.center, ...s.muted }}>{copy} · Order {order.orderNumber}</div>
    <Rule />
    <div style={s.strong}>{order.customerName} · {order.customerMobile}</div>
    {cancelled.length > 0 && <div style={s.muted}>Cancelled: {cancelled.map((i) => i.garment).join(', ')}</div>}
    {payment.reason && <div style={s.muted}>Reason: {payment.reason}</div>}
    <div style={s.box}>
      <Row left="Advance paid" right={money(order.advancePaid)} />
      {order.advanceUsed > 0 && <Row left="Used on bills" right={money(order.advanceUsed)} />}
      <Row style={s.big} left="Returned to customer" right={money(payment.amount)} />
      <Row left="Kept by shop" right={money(payment.keptAmount ?? 0)} />
    </div>
    {copy === 'Shop copy' && <div style={{ marginTop: 22 }}><div style={{ borderTop: '1px solid #111', width: '70%' }} /><div style={s.muted}>Customer signature</div></div>}
  </div>
}

export function PrintContent({ job, shop }: { job: PrintJob; shop: Shop }) {
  switch (job.kind) {
    case 'receipt': return <Receipt order={job.order} shop={shop} />
    case 'workslip': return <WorkSlip order={job.order} shop={shop} comments={job.comments} />
    case 'both': return <><Receipt order={job.order} shop={shop} /><div style={s.cut}>✂ cut here</div><WorkSlip order={job.order} shop={shop} comments={job.comments} /></>
    case 'advance': return <AdvanceReceipt order={job.order} payment={job.payment} shop={shop} />
    case 'refund': return <><RefundCopy order={job.order} payment={job.payment} shop={shop} copy="Customer copy" /><div style={s.cut}>✂ cut here</div><RefundCopy order={job.order} payment={job.payment} shop={shop} copy="Shop copy" /></>
  }
}

/** Preview on screen first, then print. */
export function PrintPreviewModal({ job, shop, onClose }: { job: PrintJob | null; shop: Shop; onClose: () => void }) {
  return <PaperPreviewModal title={job ? titles[job.kind] : ''} opened={Boolean(job)} onClose={onClose}>{job && <PrintContent job={job} shop={shop} />}</PaperPreviewModal>
}
